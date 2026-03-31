/**
 * Visual Content Pipeline — AI Photo + Carousel Generation
 *
 * Stages:
 *   Stage 1: planning     — Claude generates per-slide content briefs
 *   Stage 2: generating   — Gemini generates images (concurrency=2, nano_banana_2)
 *   Stage 3: completed    — All done, slidesJson has final image URLs
 */

import * as db from "../db";
import { callClaude, withTimeout, VARIATION_TIMEOUT, runWithConcurrency, buildProductInfoContext } from "./_shared";
import { buildOrganicPhotoPrompt } from "./geminiPromptBuilder";
import { generateProductAdWithNanoBananaPro, type NanoBananaProResult } from "./nanoBananaPro";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VisualContentInput {
  pillar: string;
  purpose: string;
  topic: string;
  format: "single" | "carousel";
  slideCount: number;
  slides: Array<{
    source: "ai" | "upload";
    headline: string;
    body: string;
    uploadedImageUrl?: string;
  }>;
  product?: string;
  overlayProduct?: boolean;
  aspectRatio?: "1:1" | "4:5" | "9:16";
}

export interface SlideResult {
  index: number;
  source: "ai" | "upload";
  imageUrl: string | null;
  s3Key: string | null;
  headline: string;
  body: string;
  brief: string;
  status: "generated" | "failed" | "uploaded";
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function transitionStage(runId: number, stage: string): Promise<void> {
  console.log(`[VisualContent] Run #${runId} — Stage ${stage}`);
  await db.updateOrganicRun(runId, { stage, status: "running" });
}

async function failRun(runId: number, err: Error): Promise<void> {
  console.error(`[VisualContent] Run #${runId} — FAILED:`, err.message);
  await db.updateOrganicRun(runId, { status: "failed", errorMessage: err.message });
}

async function generateWithFallback(
  prompt: string,
  productRenderUrl: string | undefined,
  aspectRatio: string,
  label: string,
): Promise<NanoBananaProResult> {
  try {
    return await withTimeout(
      generateProductAdWithNanoBananaPro({
        prompt,
        productRenderUrl,
        aspectRatio: aspectRatio as any,
        model: "nano_banana_2",
      }),
      VARIATION_TIMEOUT,
      `${label} (nano_banana_2)`,
    );
  } catch (err: any) {
    console.warn(`[VisualContent] ${label} failed with nano_banana_2: ${err.message}. Retrying with nano_banana_pro...`);
    return await withTimeout(
      generateProductAdWithNanoBananaPro({
        prompt,
        productRenderUrl,
        aspectRatio: aspectRatio as any,
        model: "nano_banana_pro",
      }),
      VARIATION_TIMEOUT,
      `${label} (nano_banana_pro fallback)`,
    );
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export async function runVisualContentPipeline(
  runId: number,
  input: VisualContentInput,
): Promise<void> {
  try {
    const aspectRatio = input.aspectRatio || "1:1";

    // ── Stage 1: planning ─────────────────────────────────────────────
    await transitionStage(runId, "planning");

    // Get product context for briefs
    const productContext = input.product ? await buildProductInfoContext(input.product) : "";

    // Get product render URL if overlaying product
    let productRenderUrl: string | undefined;
    if (input.overlayProduct && input.product) {
      const render = await db.getDefaultProductRender(input.product);
      productRenderUrl = render?.url;
    }

    // Claude generates briefs for AI slides
    const slideBriefs = await generateSlideBriefs(input, productContext);

    // Build initial slide results (upload slides are immediately "done")
    const slideResults: SlideResult[] = input.slides.map((s, i) => ({
      index: i,
      source: s.source,
      imageUrl: s.source === "upload" ? (s.uploadedImageUrl || null) : null,
      s3Key: null,
      headline: s.headline,
      body: s.body,
      brief: slideBriefs[i] || "",
      status: s.source === "upload" ? "uploaded" as const : "generated" as const,
      ...(s.source === "upload" ? {} : { status: "failed" as const }), // AI slides start as "failed" until generated
    }));

    // Mark upload slides as done, AI slides as pending
    for (let i = 0; i < slideResults.length; i++) {
      if (input.slides[i].source === "upload") {
        slideResults[i].status = "uploaded";
        slideResults[i].imageUrl = input.slides[i].uploadedImageUrl || null;
      }
    }

    await db.updateOrganicRun(runId, { slidesJson: JSON.stringify(slideResults) });

    // ── Stage 2: generating ───────────────────────────────────────────
    await transitionStage(runId, "generating");

    // Build tasks for AI slides only
    const aiSlideIndices = input.slides
      .map((s, i) => (s.source === "ai" ? i : -1))
      .filter((i) => i >= 0);

    const tasks = aiSlideIndices.map((idx) => async () => {
      const slide = input.slides[idx];
      const brief = slideBriefs[idx] || "";

      const prompt = buildOrganicPhotoPrompt({
        topic: input.topic,
        pillar: input.pillar,
        purpose: input.purpose,
        product: input.product,
        overlayProduct: input.overlayProduct,
        slideIndex: idx,
        totalSlides: input.slideCount,
        slideBrief: brief,
        headline: slide.headline || undefined,
        body: slide.body || undefined,
        aspectRatio,
      });

      try {
        const result = await generateWithFallback(
          prompt,
          input.overlayProduct ? productRenderUrl : undefined,
          aspectRatio,
          `Slide ${idx + 1}`,
        );

        slideResults[idx] = {
          ...slideResults[idx],
          imageUrl: result.imageUrl,
          s3Key: result.s3Key || null,
          status: "generated",
        };
      } catch (err: any) {
        console.error(`[VisualContent] Run #${runId} — Slide ${idx + 1} failed:`, err.message);
        slideResults[idx] = {
          ...slideResults[idx],
          status: "failed",
          error: err.message,
        };
      }

      // Progressive update: write after each slide so frontend picks up partial results
      await db.updateOrganicRun(runId, { slidesJson: JSON.stringify(slideResults) });
    });

    // Run AI slides with concurrency=2
    if (tasks.length > 0) {
      await runWithConcurrency(tasks, 2);
    }

    // ── Stage 3: completed ────────────────────────────────────────────
    const allFailed = aiSlideIndices.length > 0 &&
      aiSlideIndices.every((i) => slideResults[i].status === "failed");

    if (allFailed) {
      await failRun(runId, new Error("All AI slides failed to generate"));
      return;
    }

    await db.updateOrganicRun(runId, {
      status: "completed",
      stage: "completed",
      slidesJson: JSON.stringify(slideResults),
      completedAt: new Date(),
    });

    console.log(`[VisualContent] Run #${runId} — Completed. ${aiSlideIndices.length} AI slides processed.`);
  } catch (err: any) {
    await failRun(runId, err);
  }
}

// ─── Claude Brief Generation ────────────────────────────────────────────────

async function generateSlideBriefs(
  input: VisualContentInput,
  productContext: string,
): Promise<string[]> {
  const isCarousel = input.format === "carousel" && input.slideCount > 1;

  const system = `You are a social media content strategist for a fitness/health brand.
Generate visual briefs for ${isCarousel ? "a carousel post" : "a single image post"}.
Each brief describes what the AI image generator should create: the scene, mood, composition, and subject.
${productContext ? `\nProduct context:\n${productContext}` : ""}
Respond with valid JSON only. No markdown code fences.`;

  const userPrompt = isCarousel
    ? `Create ${input.slideCount} slide briefs for an Instagram carousel post.

Topic: ${input.topic}
Content Pillar: ${input.pillar}
Purpose: ${input.purpose}
${input.product ? `Product: ${input.product}` : ""}

Carousel narrative arc:
- Slide 1: Hook — grab attention, create curiosity
- Middle slides: Value — deliver the key points, benefits, or story
- Last slide: CTA — call to action, next step

For each slide, provide a visual brief describing the scene to photograph/generate.

Respond as JSON: { "briefs": ["brief for slide 1", "brief for slide 2", ...] }`
    : `Create a visual brief for a single Instagram image post.

Topic: ${input.topic}
Content Pillar: ${input.pillar}
Purpose: ${input.purpose}
${input.product ? `Product: ${input.product}` : ""}

Describe the scene, mood, lighting, and composition for one compelling image.

Respond as JSON: { "briefs": ["brief for the image"] }`;

  try {
    const response = await callClaude([{ role: "user", content: userPrompt }], system, 2048);
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.briefs || [];
  } catch (err: any) {
    console.warn(`[VisualContent] Brief generation failed: ${err.message}. Using empty briefs.`);
    return new Array(input.slideCount).fill("");
  }
}
