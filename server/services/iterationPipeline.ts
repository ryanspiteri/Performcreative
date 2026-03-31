import * as db from "../db";
import { analyzeStaticAd } from "./claude";
import { pushIterationVariationToClickUp } from "./iterationClickUp";
import { generateProductAdWithNanoBananaPro, type ImageModel, type NanoBananaProResult } from "./nanoBananaPro";
import { buildReferenceBasedPrompt, type CreativityLevel } from "./geminiPromptBuilder";
import { withTimeout, claudeClient, STEP_TIMEOUT, VARIATION_TIMEOUT, buildProductInfoContext, runWithConcurrency } from "./_shared";
import axios from "axios";

/**
 * Generate a single variation with timeout + automatic fallback to nano_banana_pro if nano_banana_2 fails.
 */
async function generateVariationWithFallback(
  options: Parameters<typeof generateProductAdWithNanoBananaPro>[0],
  variationIndex: number
): Promise<NanoBananaProResult> {
  const label = `Variation ${variationIndex + 1}`;
  try {
    return await withTimeout(
      generateProductAdWithNanoBananaPro(options),
      VARIATION_TIMEOUT,
      `${label} (${options.model || 'nano_banana_pro'})`
    );
  } catch (err: any) {
    // If using nano_banana_2 and it failed, retry once with nano_banana_pro
    if (options.model === 'nano_banana_2') {
      console.warn(`[Iteration] ${label} failed with Nano Banana 2: ${err.message}. Retrying with Nano Banana Pro...`);
      return await withTimeout(
        generateProductAdWithNanoBananaPro({ ...options, model: 'nano_banana_pro' }),
        VARIATION_TIMEOUT,
        `${label} (nano_banana_pro fallback)`
      );
    }
    throw err;
  }
}

// ============================================================
// ITERATION PIPELINE — Iterate on your own winning ads
// ============================================================
// Flow:
// Stage 1: Claude Vision analyses the uploaded winning ad (extracts headline, copy, layout, colours, typography, product placement, background style)
// Stage 2: AI generates an iteration brief — 3 new copy angles keeping the same visual DNA
// Stage 2b: User reviews and approves/edits the brief
// Stage 3: System generates 3 variation images using the approved brief
// Stage 4: ClickUp tasks created for the variations

export type IterationSourceType = "own_ad" | "competitor_ad";
export type IterationAdaptationMode = "concept" | "style";

export interface IterationPipelineInput {
  product: string;
  priority: string;
  /** URL of source image: uploaded winning ad (own_ad) or competitor image (competitor_ad). */
  sourceImageUrl: string;
  sourceImageName?: string;
  /** own_ad = our winning ad; competitor_ad = Foreplay static, adapt for ONEST */
  sourceType?: IterationSourceType;
  /** When sourceType === "competitor_ad": concept = adapt angle; style = replicate style, swap product+copy */
  adaptationMode?: IterationAdaptationMode;
  /** Competitor metadata (when sourceType === "competitor_ad") */
  foreplayAdId?: string;
  foreplayAdTitle?: string;
  foreplayAdBrand?: string;
  creativityLevel?: "SAFE" | "BOLD" | "WILD";
  variationTypes?: string[];
  variationCount?: number;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  imageModel?: ImageModel;
}

/**
 * Stage 1 + 2: Analyse the winning ad and generate iteration brief.
 * Pauses at Stage 2b for user approval.
 */
export async function runIterationStages1to2(runId: number, input: IterationPipelineInput) {
  console.log(`[Iteration] Starting iteration pipeline run #${runId}`);

  // Fetch product info
  const productInfoContext = await buildProductInfoContext(input.product);
  if (productInfoContext) {
    console.log(`[Iteration] Loaded product info for ${input.product}`);
  }

  const sourceType: IterationSourceType = input.sourceType ?? "own_ad";
  const adaptationMode = input.adaptationMode;

  // ---- STAGE 1: Analyse the source ad ----
  try {
    await db.updatePipelineRun(runId, {
      iterationStage: "stage_1_analysis",
      iterationSourceType: sourceType,
      iterationAdaptationMode: adaptationMode ?? null,
    });
    console.log(`[Iteration] Stage 1: Analysing ${sourceType === "competitor_ad" ? "competitor" : "winning"} ad...`);

    const analysis = await withTimeout(
      sourceType === "competitor_ad"
        ? analyseCompetitorAd(input.sourceImageUrl, input.product, adaptationMode ?? "concept", input.foreplayAdBrand)
        : analyseWinningAd(input.sourceImageUrl, input.product),
      STEP_TIMEOUT,
      "Stage 1: Ad Analysis"
    );

    await db.updatePipelineRun(runId, {
      iterationAnalysis: analysis,
      iterationStage: "stage_2_brief",
    });
    console.log(`[Iteration] Stage 1 complete. Analysis: ${analysis.substring(0, 200)}...`);
  } catch (err: any) {
    console.error(`[Iteration] Stage 1 failed:`, err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 1 failed: ${err.message}`,
      iterationStage: "stage_1_analysis",
    });
    return;
  }

  // ---- STAGE 2: Generate iteration brief with 3 new copy angles ----
  try {
    console.log(`[Iteration] Stage 2: Generating iteration brief...`);
    const run = await db.getPipelineRun(runId);
    const analysis = run?.iterationAnalysis || "";
    const runSourceType = (run?.iterationSourceType as IterationSourceType) ?? sourceType;
    const runAdaptationMode = run?.iterationAdaptationMode as IterationAdaptationMode | null | undefined;

    const brief = await withTimeout(
      runSourceType === "competitor_ad"
        ? generateCompetitorIterationBrief(analysis, input.product, productInfoContext, runAdaptationMode ?? "concept", input.foreplayAdBrand)
        : generateIterationBrief(
            analysis,
            input.product,
            productInfoContext,
            input.variationCount || 3,
            input.variationTypes
          ),
      STEP_TIMEOUT,
      "Stage 2: Iteration Brief"
    );

    await db.updatePipelineRun(runId, {
      iterationBrief: brief,
      iterationStage: "stage_2b_approval",
    });
    console.log(`[Iteration] Stage 2 complete. Paused at approval gate.`);
  } catch (err: any) {
    console.error(`[Iteration] Stage 2 failed:`, err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 2 failed: ${err.message}`,
      iterationStage: "stage_2_brief",
    });
  }
}

/**
 * Stage 3: Generate 3 variation images after user approves the brief.
 */
export async function runIterationStage3(runId: number, run: any) {
  console.log(`[Iteration] Stage 3: Generating variation images for run #${runId}`);

  try {
    await db.updatePipelineRun(runId, { iterationStage: "stage_3_generation" });

    const brief = run.iterationBrief || "";
    const analysis = run.iterationAnalysis || "";
    const product = run.product;
    const sourceUrl = run.iterationSourceUrl || "";

    // Parse the brief to extract the 3 variations — fail if brief is not valid JSON
    let briefData: any;
    try {
      briefData = JSON.parse(brief);
    } catch {
      throw new Error(`[Iteration] Brief stored in DB is not valid JSON. Cannot generate variations without structured brief data.`);
    }

    // Read image model from run config (defaults to Nano Banana Pro for backwards compat)
    const imageModel: ImageModel = (run.imageModel as ImageModel) || "nano_banana_pro";
    const { MODEL_LABELS } = await import("./nanoBananaPro");
    console.log(`[Iteration] Using image model: ${MODEL_LABELS[imageModel]}`);

    // Get default product render from database
    const productRender = await db.getDefaultProductRender(product);
    if (!productRender) {
      throw new Error(`No product render found for ${product}`);
    }

    console.log(`[Iteration] Using product render: ${productRender.url}`);

    // Generate N variations using Gemini (respects variationCount from input)
    const geminiResults: any[] = [];
    
    // Get creativity level and aspect ratio from run config
    const creativityLevel: CreativityLevel = (run.creativityLevel as CreativityLevel) || "BOLD";
    const aspectRatio = run.aspectRatio || "1:1";
    const requestedCount = run.variationCount || briefData?.variations?.length || 3;
    const variationCount = (briefData?.variations && Array.isArray(briefData.variations))
      ? Math.min(requestedCount, briefData.variations.length)
      : requestedCount;

    if (requestedCount > variationCount) {
      console.warn(`[Iteration] Brief only contains ${variationCount} variations but ${requestedCount} were requested. Generating ${variationCount}.`);
    }

    console.log(`[Iteration] Using creativity level: ${creativityLevel}`);
    console.log(`[Iteration] Aspect ratio: ${aspectRatio}`);
    console.log(`[Iteration] Generating ${variationCount} variations`);

    if (briefData?.variations && Array.isArray(briefData.variations)) {
      // Generate variations concurrently (2 at a time to avoid API rate limits)
      const tasks = Array.from({ length: variationCount }, (_, i) => async () => {
        const v = briefData.variations[i] || {};

        const basePrompt = buildReferenceBasedPrompt({
          headline: v.headline || `${product.toUpperCase()} VARIATION ${i + 1}`,
          subheadline: v.subheadline || undefined,
          productName: `ONEST Health ${product}`,
          backgroundStyleDescription: v.backgroundNote || "Dramatic lighting with premium aesthetic",
          aspectRatio: aspectRatio as any,
          targetAudience: briefData.targetAudience || undefined,
        });

        const geminiPrompt = `${basePrompt}\n\n=== VARIATION ${i + 1} UNIQUENESS ===\nThis is variation #${i + 1} of ${variationCount}. Make this visually distinct from other variations by using unique:\n- Color combinations and lighting angles\n- Composition and framing choices\n- Background element arrangements\n- Visual effects and atmospheric details\n\nDo NOT create identical or near-identical outputs. Each variation must be recognizably different while maintaining the reference style.`;

        console.log(`[Iteration] Generating variation ${i + 1}/${variationCount} with Nano Banana Pro`);

        const result = await generateVariationWithFallback({
          prompt: geminiPrompt,
          controlImageUrl: sourceUrl,
          productRenderUrl: productRender.url,
          aspectRatio: aspectRatio as any,
          model: imageModel,
          useCompositing: false,
          productPosition: "center",
          productScale: 0.45,
        }, i);

        return {
          url: result.imageUrl,
          s3Key: result.imageUrl.split('/').pop() || '',
          headline: v.headline || `VARIATION ${i + 1}`,
          subheadline: v.subheadline || null,
          angle: v.angle || null,
          backgroundNote: v.backgroundNote || null,
          productImageUrl: productRender.url,
          controlImageUrl: sourceUrl,
        };
      });

      geminiResults.push(...await runWithConcurrency(tasks, 2));
    } else {
      // Fallback: generate variations with rotating headlines and backgrounds
      const fallbackHeadlineTemplates = [
        `${product.toUpperCase()} - MAXIMUM DOSE`,
        `${product.toUpperCase()} - FULLY DOSED`,
        `${product.toUpperCase()} - NO FILLERS`,
        `${product.toUpperCase()} - REAL RESULTS`,
        `${product.toUpperCase()} - CLINICALLY DOSED`,
      ];

      const fallbackBackgrounds = [
        "Dramatic warm crimson red accent lighting with energetic mood, subtle smoke particles",
        "Cool electric blue accent lighting with mysterious mood, geometric light rays",
        "Warm amber spotlight with premium luxury aesthetic, minimalist dark background",
        "Deep emerald green accent lighting with natural vitality feel, soft particle effects",
        "Bold magenta and orange gradient lighting with high-energy sport aesthetic",
      ];

      const tasks = Array.from({ length: variationCount }, (_, i) => async () => {
        console.log(`[Iteration] Generating fallback variation ${i + 1}/${variationCount}`);

        const headline = fallbackHeadlineTemplates[i % fallbackHeadlineTemplates.length];
        const bg = fallbackBackgrounds[i % fallbackBackgrounds.length];

        const fallbackPrompt = buildReferenceBasedPrompt({
          headline,
          productName: `ONEST Health ${product}`,
          backgroundStyleDescription: bg,
          aspectRatio: aspectRatio as any,
        });

        const result = await generateVariationWithFallback({
          prompt: fallbackPrompt,
          controlImageUrl: sourceUrl,
          productRenderUrl: productRender.url,
          aspectRatio: aspectRatio as any,
          model: imageModel,
          useCompositing: false,
          productPosition: "center",
          productScale: 0.45,
        }, i);

        return {
          url: result.imageUrl,
          s3Key: result.imageUrl.split('/').pop() || '',
          headline,
          subheadline: null,
          angle: null,
          backgroundNote: bg,
          productImageUrl: productRender.url,
          controlImageUrl: sourceUrl,
        };
      });

      geminiResults.push(...await runWithConcurrency(tasks, 2));
    }

    const results = geminiResults;

    await db.updatePipelineRun(runId, {
      iterationVariations: results,
      iterationStage: "stage_3b_variation_approval",
    });
    console.log(`[Iteration] Stage 3 complete. Generated ${results.length} variations. Paused at variation approval gate.`);
  } catch (err: any) {
    console.error(`[Iteration] Stage 3 failed:`, err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 3 failed: ${err.message}`,
      iterationStage: "stage_3_generation",
    });
  }
}

/**
 * Stage 4: Create ClickUp tasks (called after user approves variations).
 */
export async function runIterationStage4(runId: number, run: any) {
  console.log(`[Iteration] Stage 4: Creating ClickUp tasks for run #${runId}`);
  await db.updatePipelineRun(runId, { iterationStage: "stage_4_clickup" });

  const product = run.product;
  const sourceUrl = run.iterationSourceUrl || "";
  const analysis = run.iterationAnalysis || "";
  const variations: any[] = run.iterationVariations || [];

  let briefData: any = null;
  try { briefData = JSON.parse(run.iterationBrief || ""); } catch { /* ignore */ }

  try {
    const tasks: any[] = [];

    for (let i = 0; i < variations.length; i++) {
      const v = briefData?.variations?.[i] || {};
      const imageUrl = variations[i]?.url;
      
      if (!imageUrl) {
        console.warn(`[Iteration] Skipping variation ${i + 1}: no image URL`);
        continue;
      }

      try {
        const task = await pushIterationVariationToClickUp({
          runId,
          variationIndex: i,
          variation: {
            url: imageUrl,
            variation: {
              headline: v.headline || `Variation ${i + 1}`,
              subheadline: v.subheadline || "",
              benefits: [
                v.benefit1 || "",
                v.benefit2 || "",
                v.benefit3 || ""
              ].filter(Boolean),
              angle: v.angle || ""
            }
          },
          product
        });
        tasks.push({ name: v.headline || `Variation ${i + 1}`, taskId: task.taskId, url: task.taskUrl });
        console.log(`[Iteration] ClickUp task created: ${task.taskId}`);
      } catch (err: any) {
        console.warn(`[Iteration] ClickUp task ${i + 1} failed:`, err.message);
        tasks.push({ name: v.headline || `Variation ${i + 1}`, error: err.message });
      }
    }

    await db.updatePipelineRun(runId, {
      clickupTasksJson: tasks,
      status: "completed",
      iterationStage: "completed",
      completedAt: new Date(),
    });
    console.log(`[Iteration] Pipeline complete! ${tasks.length} ClickUp tasks created.`);
  } catch (err: any) {
    console.error(`[Iteration] Stage 4 failed:`, err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 4 (ClickUp) failed: ${err.message}`,
    });
  }
}

/**
 * Regenerate a single variation image with an optional new prompt/headline.
 */
export async function regenerateIterationVariation(
  runId: number,
  variationIndex: number,
  overrides?: { headline?: string; subheadline?: string; backgroundPrompt?: string }
) {
  const run = await db.getPipelineRun(runId);
  if (!run) throw new Error("Run not found");

  const variations: any[] = Array.isArray(run.iterationVariations) ? run.iterationVariations : [];
  if (variationIndex < 0 || variationIndex >= variations.length) {
    throw new Error(`Invalid variation index: ${variationIndex}`);
  }

  let briefData: any = null;
  try { briefData = JSON.parse(run.iterationBrief || ""); } catch { /* ignore */ }

  const v = briefData?.variations?.[variationIndex] || {};
  const product = run.product;
  const analysis = run.iterationAnalysis || "";

  // Build selections for just this one variation
  const headline = overrides?.headline || v.headline || `VARIATION ${variationIndex + 1}`;
  const subheadline = overrides?.subheadline || v.subheadline || null;
  
  // Check if user is only changing text (no background prompt override)
  const isTextOnlyChange = !overrides?.backgroundPrompt && (overrides?.headline || overrides?.subheadline);
  
  const bgPrompt = overrides?.backgroundPrompt
    || (v.backgroundNote
      ? `Premium background for health supplement ad. ${v.backgroundNote}. Dramatic lighting, premium aesthetic. No text, no product, no logos, no people.`
      : `Premium dark background for health supplement advertisement. Dramatic lighting, subtle atmospheric effects. No text, no product, no logos, no people.`);

  // Get default product render
  const productRender = await db.getDefaultProductRender(product);
  if (!productRender) {
    throw new Error(`No product render found for ${product}`);
  }

  // Get aspect ratio, creativity level, and image model from run config
  const aspectRatio = run.aspectRatio || "1:1";
  const creativityLevel: CreativityLevel = (run.creativityLevel as CreativityLevel) || "BOLD";
  const imageModel: ImageModel = (run.imageModel as ImageModel) || "nano_banana_pro";

  let finalUrl: string;
  
  // If only text is changing and we have the existing variation data, reuse the background
  if (isTextOnlyChange && variations[variationIndex]?.url) {
    console.log(`[Iteration] Text-only regeneration for variation ${variationIndex + 1} - reusing existing background`);
    console.log(`[Iteration] New headline: "${headline}"`);
    
    const geminiPrompt = buildReferenceBasedPrompt({
      headline,
      subheadline: subheadline || undefined,
      productName: `ONEST Health ${product}`,
      backgroundStyleDescription: bgPrompt,
      aspectRatio: aspectRatio as any,
      targetAudience: briefData?.targetAudience || "fitness-conscious adults",
    });

    const sourceUrl = run.iterationSourceUrl || "";
    const result = await generateProductAdWithNanoBananaPro({
      prompt: geminiPrompt,
      controlImageUrl: variations[variationIndex].url, // Use the EXISTING variation as control instead of source
      productRenderUrl: productRender.url,
      aspectRatio: aspectRatio as any,
      model: imageModel,
      useCompositing: false, // Single-pass: Gemini generates full scene including product
      productPosition: "center",
      productScale: 0.45,
    });
    
    finalUrl = result.imageUrl;
  } else {
    // Full regeneration with new background
    console.log(`[Iteration] Full regeneration for variation ${variationIndex + 1} with new background`);
    console.log(`[Iteration] Headline: "${headline}", BG prompt: "${bgPrompt.substring(0, 100)}..."`);
    
    const geminiPrompt = buildReferenceBasedPrompt({
      headline,
      subheadline: subheadline || undefined,
      productName: `ONEST Health ${product}`,
      backgroundStyleDescription: bgPrompt,
      aspectRatio: aspectRatio as any,
      targetAudience: briefData?.targetAudience || "fitness-conscious adults",
    });

    const sourceUrl = run.iterationSourceUrl || "";
    const result = await generateProductAdWithNanoBananaPro({
      prompt: geminiPrompt,
      controlImageUrl: sourceUrl, // Use original source as control
      productRenderUrl: productRender.url,
      aspectRatio: aspectRatio as any,
      model: imageModel,
      useCompositing: false, // Single-pass: Gemini generates full scene including product
      productPosition: "center",
      productScale: 0.45,
    });
    
    finalUrl = result.imageUrl;
  }

  // Update the specific variation in the array, preserving existing metadata
  const variationLabel = variationIndex === 0 ? "Control" : `Variation ${variationIndex + 1}`;
  variations[variationIndex] = {
    ...variations[variationIndex],
    url: finalUrl,
    variation: variationLabel,
    ...(overrides?.headline && { headline: overrides.headline }),
    ...(overrides?.subheadline && { subheadline: overrides.subheadline }),
  };

  await db.updatePipelineRun(runId, {
    iterationVariations: variations,
    iterationStage: "stage_3b_variation_approval",
  });

  console.log(`[Iteration] Variation ${variationIndex + 1} regenerated: ${finalUrl}`);
  return { url: finalUrl, variation: variationLabel };
}

// ============================================================
// CLAUDE CALLS
// ============================================================

/**
 * Analyse a winning ad — extracts everything about its visual design,
 * copy, layout, and what makes it work.
 */
async function analyseWinningAd(imageUrl: string, product: string): Promise<string> {
  const system = `You are an elite creative director and performance marketing analyst for ONEST Health, an Australian supplement brand. You are analysing one of ONEST's OWN winning ads — not a competitor's. Your job is to deconstruct exactly what makes this ad work so the team can create variations that keep the winning formula but test new angles.

Be extremely specific about every visual and copy element. The goal is to preserve the visual DNA while varying the messaging.`;

  const content: any[] = [];

  // Download and send image as base64
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      console.log(`[Iteration] Downloading winning ad for analysis...`);
      const imgRes = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      });
      const base64 = Buffer.from(imgRes.data).toString("base64");
      let mediaType = imgRes.headers["content-type"] || "image/jpeg";
      if (mediaType.includes(";")) mediaType = mediaType.split(";")[0].trim();
      if (!mediaType.startsWith("image/")) mediaType = "image/jpeg";

      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    } catch (imgErr: any) {
      console.error(`[Iteration] Failed to download image: ${imgErr.message}`);
      content.push({
        type: "text",
        text: `[Image could not be downloaded from ${imageUrl}]`,
      });
    }
  }

  content.push({
    type: "text",
    text: `Analyse this ONEST Health winning ad for ${product}. This ad is already performing well — I need to understand exactly why so we can create 3 new variations.

Provide your analysis in these sections:

## 1. HEADLINE & COPY
- Exact headline text (word for word)
- Exact subheadline/body copy text
- Tone of voice (casual, urgent, scientific, aspirational, etc.)
- Copy angle (benefit-driven, problem-solution, social proof, curiosity, etc.)
- Any benefit callouts, badges, or bullet points
- CTA text and style

## 2. VISUAL LAYOUT
- Overall composition (product left/centre/right, text position)
- Approximate element positions as percentages
- Visual hierarchy (what draws the eye first, second, third)
- Aspect ratio and orientation (square, portrait, landscape)

## 3. COLOUR PALETTE
- Background colour(s) with approximate hex values
- Text colour(s) with hex values
- Accent/highlight colours
- Gradient directions if present
- Overall colour temperature

## 4. TYPOGRAPHY
- Font style (bold, italic, condensed, serif, sans-serif)
- Headline font size relative to canvas (small, medium, large, massive)
- Text effects (shadow, outline, gradient fill)
- Letter spacing characteristics

## 5. PRODUCT PRESENTATION
- Product size relative to canvas
- Product angle/perspective
- Product position
- Any effects on product (shadow, glow, floating)

## 6. BACKGROUND & EFFECTS
- Background type (solid colour, gradient, photograph, texture)
- Any overlay effects, particles, decorative elements
- Lighting direction and mood

## 7. WHAT MAKES THIS AD WORK
- Why is this ad likely performing well?
- What emotional triggers does it use?
- What scroll-stopping elements does it have?
- What should be PRESERVED in variations?
- What can be VARIED without losing the winning formula?

## 8. BRAND ELEMENTS
- Logo placement and size
- Any badges, seals, disclaimers
- CTA button style`,
  });

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    system,
    messages: [{ role: "user", content }],
  };

  const res = await claudeClient.post("/messages", body);
  const resContent = res.data?.content;
  if (Array.isArray(resContent)) {
    return resContent.map((c: any) => c.text || "").join("\n");
  }
  return resContent?.text || JSON.stringify(resContent);
}

/**
 * Analyse a competitor ad — for "concept" mode extract concept/angle/emotional hook;
 * for "style" mode extract layout, colours, typography, composition (replicate style, swap product+copy).
 */
async function analyseCompetitorAd(
  imageUrl: string,
  product: string,
  adaptationMode: IterationAdaptationMode,
  competitorBrand?: string
): Promise<string> {
  const isConcept = adaptationMode === "concept";
  const system = isConcept
    ? `You are an elite creative strategist for ONEST Health. You are analysing a COMPETITOR's ad (${competitorBrand || "another brand"}) to extract the CONCEPT and angle — not to copy it. Your job is to identify the emotional hook, audience appeal, persuasion mechanism, and narrative framework so ONEST can ADAPT that concept for ${product} with our own visual style and messaging. Be specific about what makes the ad work conceptually.`
    : `You are an elite creative director for ONEST Health. You are analysing a COMPETITOR's ad (${competitorBrand || "another brand"}) to extract the exact VISUAL STYLE — layout, composition, colour palette, typography, product placement, and mood. Your job is to describe the style in enough detail that we can REPLICATE it for an ONEST ${product} ad, replacing only the product and copy. Be extremely specific about visual elements.`;

  const content: any[] = [];
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      const imgRes = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      });
      const base64 = Buffer.from(imgRes.data).toString("base64");
      let mediaType = imgRes.headers["content-type"] || "image/jpeg";
      if (mediaType.includes(";")) mediaType = mediaType.split(";")[0].trim();
      if (!mediaType.startsWith("image/")) mediaType = "image/jpeg";
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
    } catch (imgErr: any) {
      content.push({ type: "text", text: `[Image could not be downloaded from ${imageUrl}]` });
    }
  }

  const prompt = isConcept
    ? `Analyse this COMPETITOR ad (${competitorBrand || "other brand"}) and extract the CONCEPT we can adapt for ONEST Health's ${product}.

Focus on:
1. CONCEPT & ANGLE — What is the core idea or hook? (e.g. transformation, social proof, myth-busting, before/after)
2. EMOTIONAL TRIGGERS — What feelings does it target? (e.g. FOMO, belonging, achievement)
3. PERSUASION MECHANISM — How does it convince? (e.g. authority, scarcity, testimonials)
4. TARGET AUDIENCE — Who is this speaking to?
5. NARRATIVE FRAMEWORK — Hook → body → CTA structure
6. WHAT TO ADAPT — How should ONEST use this same concept with our own visual style and ${product} messaging?

Output a structured analysis so we can brief ONEST creatives that ADAPT the concept (not copy the competitor's look).`
    : `Analyse this COMPETITOR ad (${competitorBrand || "other brand"}) and extract the exact VISUAL STYLE so we can replicate it for ONEST Health's ${product}.

Focus on:
1. LAYOUT — Composition, product position, text zones, negative space (percentages)
2. COLOUR PALETTE — Background, text, accent colours (hex-like)
3. TYPOGRAPHY — Font weight, size, effects, placement
4. MOOD & LIGHTING — Tone, lighting direction, effects
5. PRODUCT PRESENTATION — Size, angle, placement
6. WHAT TO REPLICATE — Exact style notes so we generate an ONEST ad that LOOKS like this but with our product and copy.

Output a structured analysis so we can brief image generation to MATCH this style and swap in ONEST product + copy.`;

  content.push({ type: "text", text: prompt });
  const res = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    system,
    messages: [{ role: "user", content }],
  });
  const resContent = res.data?.content;
  if (Array.isArray(resContent)) return resContent.map((c: any) => c.text || "").join("\n");
  return resContent?.text || JSON.stringify(resContent);
}

/**
 * Generate an iteration brief — 3 new copy angles that keep the visual DNA
 * but test different headlines, subheadlines, and angles.
 */
async function generateIterationBrief(
  analysis: string,
  product: string,
  productInfo: string,
  variationCount: number = 3,
  variationTypes?: string[]
): Promise<string> {
  const system = `You are an elite DTC performance creative strategist. You specialise in iterating on winning ad creatives — keeping what works and testing new angles. You understand that the visual DNA (layout, colours, typography style, product placement) should be preserved while the COPY (headline, subheadline, angle) should be varied to find new winners.

Return ONLY valid JSON. No markdown, no code blocks, no explanation.`;

  // Build detailed variation type instructions
  let variationTypeInstructions = "";
  
  if (variationTypes && variationTypes.length > 0) {
    const typeConstraints: Record<string, string> = {
      headline_only: `**HEADLINE_ONLY**: Only vary the headline text. Keep EXACTLY the same:
- Background style, colours, and gradients
- Layout and composition
- Product placement and size
- Props and visual metaphors
- Typography style (only text changes)
- Subheadline and benefit callouts`,
      
      background_only: `**BACKGROUND_ONLY**: Only vary background colours/styles. Keep EXACTLY the same:
- Headline text (word-for-word)
- Layout and composition
- Product placement and size
- Props and visual metaphors
- Typography style
- All copy (headline, subheadline, benefits)
Test different: solid colours, gradients, colour schemes (warm/cool/high-contrast)`,
      
      layout_only: `**LAYOUT_ONLY**: Only vary product placement and text positioning. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Props and visual metaphors
- Typography style
- All copy
Test different: centered, asymmetric, split-screen, diagonal, grid compositions`,
      
      benefit_callouts_only: `**BENEFIT_CALLOUTS_ONLY**: Only vary subheadline and benefit copy. Keep EXACTLY the same:
- Main headline (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- Props and visual metaphors
Test different: benefit angles (speed, results, ingredients, science, guarantees)`,
      
      props_only: `**PROPS_ONLY**: Only vary visual metaphors and supporting elements. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- All copy
Test different: visual metaphors (fire, lightning, transformation, science, speed)`,
      
      talent_swap: `**TALENT_SWAP**: Only vary the person/model. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- Props and visual metaphors
- All copy
Test different: age groups, genders, ethnicities, body types`,
      
      full_remix: `**FULL_REMIX**: Change everything - headline, background, layout, props, benefits.
Maximum creative freedom. Only maintain product identity and core value proposition.`
    };
    
    const selectedConstraints = variationTypes
      .map(type => typeConstraints[type])
      .filter(Boolean)
      .join("\n\n");
    
    const variationsPerType = Math.ceil(variationCount / variationTypes.length);
    
    variationTypeInstructions = `VARIATION TYPE CONSTRAINTS:
${selectedConstraints}

DISTRIBUTION: Generate approximately ${variationsPerType} variation(s) for each selected type.
If multiple types selected, clearly label which type each variation tests.`;
  } else {
    variationTypeInstructions = "- KEEP the same visual layout, colour scheme, typography style, and product placement\n- TEST a different headline, subheadline, and copy angle";
  }

  const userPrompt = `Based on this analysis of an ONEST Health winning ad for ${product}:

${analysis}

${productInfo ? `\nProduct Information:\n${productInfo}` : ""}

Generate an iteration brief with ${variationCount} NEW variations. Each variation should:
${variationTypeInstructions}
- Be scroll-stopping and benefit-driven
- Be specific to ${product}'s actual benefits and ingredients
The ${variationCount} variations should test DIFFERENT angles across these categories:
- Benefit-driven (what the product does for you)
- Curiosity/intrigue (make them want to learn more)
- Social proof/authority (why they should trust this product)
- Problem-solution (pain point to solution)
- Transformation (before to after)
- Urgency/scarcity (limited time, don't miss out)

Return JSON in this exact format with ${variationCount} variations:
{
  "originalHeadline": "exact headline from the winning ad",
  "originalAngle": "description of the original ad's angle",
  "preserveElements": ["list of visual elements to keep exactly the same"],
  "targetAudience": "description of target audience",
  "variations": [
    {
      "number": 1,
      "variationType": "headline_only" | "background_only" | "layout_only" | "benefit_callouts_only" | "props_only" | "talent_swap" | "full_remix",
      "angle": "Benefit-Driven",
      "angleDescription": "Why this angle works and what it tests",
      "headline": "NEW HEADLINE TEXT (3-8 words, all caps)",
      "subheadline": "Supporting subheadline (5-12 words)",
      "benefitCallouts": ["Benefit 1", "Benefit 2", "Benefit 3"],
      "backgroundNote": "Specific instructions for background/layout/props based on variation type"
    }
    ... (generate ${variationCount} total variations, distributed across selected types)
  ]
}`;

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userPrompt }],
  };

  const res = await claudeClient.post("/messages", body);
  const resContent = res.data?.content;
  let text = "";
  if (Array.isArray(resContent)) {
    text = resContent.map((c: any) => c.text || "").join("\n");
  } else {
    text = resContent?.text || JSON.stringify(resContent);
  }

  // Clean up any markdown code blocks
  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Validate it's valid JSON — fail explicitly so the caller can retry or surface the error
  try {
    JSON.parse(text);
  } catch {
    throw new Error(`[Iteration] Claude returned invalid JSON for brief. Raw response: ${text.substring(0, 500)}`);
  }

  return text;
}

/**
 * Generate an iteration brief from a COMPETITOR ad analysis.
 * concept: adapt the concept/angle for ONEST with our own visual style.
 * style: replicate the visual style; use ONEST product and copy only.
 */
async function generateCompetitorIterationBrief(
  analysis: string,
  product: string,
  productInfo: string,
  adaptationMode: IterationAdaptationMode,
  competitorBrand?: string
): Promise<string> {
  const isConcept = adaptationMode === "concept";
  const system = `You are an elite DTC creative strategist for ONEST Health. You are creating an iteration brief based on a COMPETITOR ad analysis (${competitorBrand || "another brand"}). ${isConcept ? "ADAPT the concept and angle for ONEST — use our own visual style and messaging." : "REPLICATE the visual style for ONEST — same layout, colours, typography; use ONEST product and ONEST copy only."} Return ONLY valid JSON. No markdown, no code blocks.`;

  const userPrompt = `Based on this analysis of a COMPETITOR ad (${competitorBrand || "other brand"}):

${analysis}

${productInfo ? `\nONEST Product Information for ${product}:\n${productInfo}` : ""}

Generate an iteration brief with 3 variations for ONEST Health's ${product}.
${isConcept ? "Each variation should ADAPT the competitor's concept/angle for ONEST — our visual style, our messaging, our product. Test different ways to execute the same conceptual hook." : "Each variation should REPLICATE the competitor's visual style (layout, colours, typography, mood) but with ONEST product and ONEST-only copy. Test different headline/angle within that style."}

Return JSON in this exact format:
{
  "originalHeadline": "headline or concept from competitor ad",
  "originalAngle": "description of competitor's angle",
  "preserveElements": ["elements we are preserving or adapting"],
  "targetAudience": "target audience",
  "variations": [
    {
      "number": 1,
      "angle": "Angle name",
      "angleDescription": "Why this angle",
      "headline": "ONEST HEADLINE (3-8 words, all caps)",
      "subheadline": "Supporting subheadline",
      "benefitCallouts": ["Benefit 1", "Benefit 2"],
      "backgroundNote": "Background/style note for this variation"
    },
    { "number": 2, ... },
    { "number": 3, ... }
  ]
}`;

  const res = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });
  let text = "";
  const resContent = res.data?.content;
  if (Array.isArray(resContent)) text = resContent.map((c: any) => c.text || "").join("\n");
  else text = resContent?.text || JSON.stringify(resContent);
  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    JSON.parse(text);
  } catch {
    text = JSON.stringify({ raw: text, variations: [] });
  }
  return text;
}

