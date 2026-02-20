import * as db from "../db";
import { analyzeStaticAd } from "./claude";
import { generateStaticAdVariations, ImageSelections } from "./imageCompositing";
import { createScriptTask } from "./clickup";
import axios from "axios";
import { ENV } from "../_core/env";

const STEP_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
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

export interface IterationPipelineInput {
  product: string;
  priority: string;
  sourceImageUrl: string; // URL of the user's uploaded winning ad
  sourceImageName?: string;
}

/**
 * Stage 1 + 2: Analyse the winning ad and generate iteration brief.
 * Pauses at Stage 2b for user approval.
 */
export async function runIterationStages1to2(runId: number, input: IterationPipelineInput) {
  console.log(`[Iteration] Starting iteration pipeline run #${runId}`);

  // Fetch product info
  let productInfoContext = "";
  try {
    const info = await db.getProductInfo(input.product);
    if (info) {
      const parts: string[] = [];
      if (info.ingredients) parts.push(`Ingredients: ${info.ingredients}`);
      if (info.benefits) parts.push(`Benefits: ${info.benefits}`);
      if (info.claims) parts.push(`Claims: ${info.claims}`);
      if (info.targetAudience) parts.push(`Target Audience: ${info.targetAudience}`);
      if (info.keySellingPoints) parts.push(`Key Selling Points: ${info.keySellingPoints}`);
      if (info.flavourVariants) parts.push(`Flavour Variants: ${info.flavourVariants}`);
      if (info.pricing) parts.push(`Pricing: ${info.pricing}`);
      if (info.additionalNotes) parts.push(`Notes: ${info.additionalNotes}`);
      productInfoContext = parts.join("\n");
      console.log(`[Iteration] Loaded product info for ${input.product}`);
    }
  } catch (err: any) {
    console.warn("[Iteration] Failed to load product info:", err.message);
  }

  // ---- STAGE 1: Analyse the winning ad ----
  try {
    await db.updatePipelineRun(runId, { iterationStage: "stage_1_analysis" });
    console.log(`[Iteration] Stage 1: Analysing winning ad...`);

    const analysis = await withTimeout(
      analyseWinningAd(input.sourceImageUrl, input.product),
      STEP_TIMEOUT,
      "Stage 1: Winning Ad Analysis"
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

    const brief = await withTimeout(
      generateIterationBrief(analysis, input.product, productInfoContext),
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

    // Parse the brief to extract the 3 variations
    let briefData: any;
    try {
      briefData = JSON.parse(brief);
    } catch {
      console.warn("[Iteration] Brief is not JSON, using as plain text");
      briefData = null;
    }

    // Build selections from the brief — use Flux Pro for background generation
    const selections: ImageSelections = {
      images: [],
      benefits: briefData?.sharedBenefits || "Premium Formula | Clinically Dosed | Australian Made",
    };

    if (briefData?.variations && Array.isArray(briefData.variations)) {
      for (let i = 0; i < 3; i++) {
        const v = briefData.variations[i] || {};
        // Generate a Flux Pro background prompt based on the analysis + variation angle
        const bgPrompt = v.backgroundNote
          ? `Premium background for health supplement ad. ${v.backgroundNote}. Dramatic lighting, premium aesthetic. No text, no product, no logos, no people.`
          : `Premium dark background for health supplement advertisement. ${i === 0 ? "Warm crimson red accent lighting, energetic mood" : i === 1 ? "Cool electric blue accent lighting, mysterious mood" : "Warm amber spotlight, premium luxury mood"}. Dramatic lighting, subtle atmospheric effects. No text, no product, no logos, no people.`;

        selections.images.push({
          headline: v.headline || `VARIATION ${i + 1}`,
          subheadline: v.subheadline || null,
          background: {
            type: "flux" as const,
            title: v.backgroundNote || `Variation ${i + 1} Background`,
            prompt: bgPrompt,
          },
        });
      }
    } else {
      // Fallback: 3 Flux Pro generated backgrounds
      for (let i = 0; i < 3; i++) {
        selections.images.push({
          headline: `${product.toUpperCase()} VARIATION ${i + 1}`,
          subheadline: null,
          background: {
            type: "flux" as const,
            title: ["Dark Energy", "Electric Blue", "Minimal Premium"][i],
            prompt: [
              "Premium dark background for health supplement ad. Deep charcoal with dramatic crimson red accent lighting. Subtle smoke particles, energetic mood. No text, no product, no logos, no people.",
              "Bold energetic background for supplement ad. Deep navy with electric blue accent lighting from below. Geometric light rays, cool-toned. No text, no product, no logos, no people.",
              "Minimalist premium dark background for supplement ad. Matte black with soft warm spotlight from above. Clean, refined, luxury aesthetic. No text, no product, no logos, no people.",
            ][i],
          },
        });
      }
    }

    const results = await withTimeout(
      generateStaticAdVariations(
        analysis,
        sourceUrl,
        product,
        "ONEST Health",
        selections
      ),
      STEP_TIMEOUT,
      "Stage 3: Image Generation"
    );

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
      const taskName = `[Iteration] ${product} - ${v.headline || `Variation ${i + 1}`}`;
      const taskDesc = [
        `## Iteration Pipeline \u2014 ${product}`,
        `**Source Ad:** ${sourceUrl}`,
        `**Variation:** ${i + 1} of ${variations.length}`,
        `**Headline:** ${v.headline || "N/A"}`,
        `**Subheadline:** ${v.subheadline || "N/A"}`,
        `**Angle:** ${v.angle || "N/A"}`,
        `**Generated Image:** ${variations[i]?.url || "N/A"}`,
        "",
        `### Analysis`,
        analysis.substring(0, 500),
      ].join("\n");

      try {
        const task = await createScriptTask(
          taskName,
          "Iteration Variation",
          0,
          taskDesc,
          product,
          "Medium"
        );
        tasks.push({ name: taskName, taskId: task.id, url: task.url });
        console.log(`[Iteration] ClickUp task created: ${task.id}`);
      } catch (err: any) {
        console.warn(`[Iteration] ClickUp task ${i + 1} failed:`, err.message);
        tasks.push({ name: taskName, error: err.message });
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
  const bgPrompt = overrides?.backgroundPrompt
    || (v.backgroundNote
      ? `Premium background for health supplement ad. ${v.backgroundNote}. Dramatic lighting, premium aesthetic. No text, no product, no logos, no people.`
      : `Premium dark background for health supplement advertisement. Dramatic lighting, subtle atmospheric effects. No text, no product, no logos, no people.`);

  const selections: ImageSelections = {
    images: [
      {
        headline,
        subheadline,
        background: {
          type: "flux" as const,
          title: `Regenerated V${variationIndex + 1}`,
          prompt: bgPrompt,
        },
      },
      // Dummy entries for the other 2 slots (won't be used)
      { headline: "PLACEHOLDER", subheadline: null, background: { type: "flux" as const, title: "N/A", prompt: "" } },
      { headline: "PLACEHOLDER", subheadline: null, background: { type: "flux" as const, title: "N/A", prompt: "" } },
    ],
    benefits: briefData?.sharedBenefits || "Premium Formula | Clinically Dosed | Australian Made",
  };

  // Only generate the one variation we need
  const { generateFluxProBackground } = await import("./fluxPro");
  const { generateStaticAdWithBannerbear, BANNERBEAR_TEMPLATES } = await import("./bannerbear");
  const { LOGOS } = await import("../config/brandAssets");

  console.log(`[Iteration] Regenerating variation ${variationIndex + 1} for run #${runId}`);
  console.log(`[Iteration] Headline: "${headline}", BG prompt: "${bgPrompt.substring(0, 100)}..."`);

  // Get product render
  let productRenderUrl: string;
  try {
    const renders = await db.getProductRendersByProduct(product);
    if (renders.length > 0) {
      productRenderUrl = renders[Math.floor(Math.random() * renders.length)].url;
    } else {
      const allRenders = await db.listProductRenders();
      productRenderUrl = allRenders.length > 0 ? allRenders[0].url : "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png";
    }
  } catch {
    productRenderUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png";
  }

  // Generate background with Flux Pro
  const backgroundUrl = await generateFluxProBackground(bgPrompt, 1088, 1088);

  // Persist to S3
  const resp = await fetch(backgroundUrl);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const { storagePut } = await import("../storage");
  const fileKey = `flux-backgrounds/regen-v${variationIndex + 1}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { url: persistedBgUrl } = await storagePut(fileKey, buffer, "image/jpeg");

  // Composite with Bannerbear
  // Use the single template for now (add more later for variety)
  const templateUid = BANNERBEAR_TEMPLATES.staticAd1;

  const finalUrl = await generateStaticAdWithBannerbear({
    templateUid,
    headline,
    subheadline: subheadline || undefined,
    benefitCallout: briefData?.sharedBenefits || "Premium Formula | Clinically Dosed | Australian Made",
    backgroundImageUrl: persistedBgUrl,
    productRenderUrl,
    logoUrl: LOGOS.wordmark_white,
  });

  // Update the specific variation in the array
  const variationLabel = variationIndex === 0 ? "Control" : `Variation ${variationIndex + 1}`;
  variations[variationIndex] = { url: finalUrl, variation: variationLabel };

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
  const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
  const claudeClient = axios.create({
    baseURL: ANTHROPIC_BASE,
    headers: {
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    timeout: 600000,
  });

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
 * Generate an iteration brief — 3 new copy angles that keep the visual DNA
 * but test different headlines, subheadlines, and angles.
 */
async function generateIterationBrief(
  analysis: string,
  product: string,
  productInfo: string
): Promise<string> {
  const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
  const claudeClient = axios.create({
    baseURL: ANTHROPIC_BASE,
    headers: {
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    timeout: 600000,
  });

  const system = `You are an elite DTC performance creative strategist. You specialise in iterating on winning ad creatives — keeping what works and testing new angles. You understand that the visual DNA (layout, colours, typography style, product placement) should be preserved while the COPY (headline, subheadline, angle) should be varied to find new winners.

Return ONLY valid JSON. No markdown, no code blocks, no explanation.`;

  const userPrompt = `Based on this analysis of an ONEST Health winning ad for ${product}:

${analysis}

${productInfo ? `\nProduct Information:\n${productInfo}` : ""}

Generate an iteration brief with 3 NEW variations. Each variation should:
- KEEP the same visual layout, colour scheme, typography style, and product placement
- TEST a different headline, subheadline, and copy angle
- Be scroll-stopping and benefit-driven
- Be specific to ${product}'s actual benefits and ingredients

The 3 variations should test DIFFERENT angles:
1. A benefit-driven angle (what the product does for you)
2. A curiosity/intrigue angle (make them want to learn more)
3. A social proof/authority angle (why they should trust this product)

Return JSON in this exact format:
{
  "originalHeadline": "exact headline from the winning ad",
  "originalAngle": "description of the original ad's angle",
  "preserveElements": ["list of visual elements to keep exactly the same"],
  "sharedBenefits": "short benefit text that appears on all 3 variations (e.g. 'Clinically Dosed | No Fillers | Australian Made')",
  "variations": [
    {
      "number": 1,
      "angle": "Benefit-Driven",
      "angleDescription": "Why this angle works and what it tests",
      "headline": "NEW HEADLINE TEXT (3-8 words, all caps)",
      "subheadline": "Supporting subheadline (5-12 words)",
      "benefitCallouts": ["Benefit 1", "Benefit 2", "Benefit 3"],
      "backgroundNote": "Any specific background adjustments for this variation"
    },
    {
      "number": 2,
      "angle": "Curiosity/Intrigue",
      "angleDescription": "...",
      "headline": "...",
      "subheadline": "...",
      "benefitCallouts": ["...", "...", "..."],
      "backgroundNote": "..."
    },
    {
      "number": 3,
      "angle": "Social Proof/Authority",
      "angleDescription": "...",
      "headline": "...",
      "subheadline": "...",
      "benefitCallouts": ["...", "...", "..."],
      "backgroundNote": "..."
    }
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

  // Validate it's valid JSON
  try {
    JSON.parse(text);
  } catch {
    console.warn("[Iteration] Brief is not valid JSON, wrapping in object");
    text = JSON.stringify({ raw: text, variations: [] });
  }

  return text;
}
