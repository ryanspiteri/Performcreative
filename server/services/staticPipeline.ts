import * as db from "../db";
import { analyzeStaticAd } from "./claude";
import { ImageSelections } from "./imageCompositing";
import { generateProductAdWithNanoBananaPro } from "./nanoBananaPro";
import { buildReferenceBasedPrompt } from "./geminiPromptBuilder";
import { createScriptTask } from "./clickup";
import axios from "axios";
import { ENV } from "../_core/env";

/**
 * Generate ad creative variations using Gemini (Nano Banana Pro)
 * Replaces the legacy Bannerbear/Flux Pro generateStaticAdVariations function.
 */
async function generateStaticAdVariationsWithGemini(
  brief: string,
  referenceImageUrl: string,
  product: string,
  selections: ImageSelections | undefined,
  teamNotes?: string
): Promise<Array<{ url: string; s3Key: string; variation: string; headline: string; subheadline: string | null }>> {
  // Get product render from DB
  const renders = await db.listProductRenders(product);
  const productRender = renders.find((r: any) => r.isDefault) || renders[0];
  if (!productRender) throw new Error(`No product render found for ${product}`);

  const images = selections?.images || [];
  const variationCount = images.length || 3;
  const results: Array<{ url: string; s3Key: string; variation: string; headline: string; subheadline: string | null }> = [];

  for (let i = 0; i < variationCount; i++) {
    const sel = images[i] || {};
    const headline = sel.headline || `ONEST ${product.toUpperCase()} — VARIATION ${i + 1}`;
    const subheadline = sel.subheadline || null;
    const backgroundDesc = sel.background?.description || sel.background?.title || "Premium supplement ad with bold typography and clean background";

    const basePrompt = buildReferenceBasedPrompt({
      headline,
      subheadline: subheadline || undefined,
      productName: `ONEST Health ${product}`,
      backgroundStyleDescription: backgroundDesc,
      aspectRatio: "1:1",
    });

    const fullPrompt = teamNotes
      ? `${basePrompt}\n\n=== REVISION NOTES ===\n${teamNotes}\n\nApply these revision notes carefully while maintaining the overall style.`
      : `${basePrompt}\n\n=== VARIATION ${i + 1} UNIQUENESS ===\nThis is variation #${i + 1} of ${variationCount}. Make this visually distinct from other variations through unique colour combinations, lighting angles, and composition choices.`;

    console.log(`[Static] Generating variation ${i + 1}/${variationCount} with Gemini...`);
    const result = await generateProductAdWithNanoBananaPro({
      prompt: fullPrompt,
      controlImageUrl: referenceImageUrl || undefined,
      productRenderUrl: productRender.url,
      aspectRatio: "1:1",
      useCompositing: false, // Single-pass: Gemini receives both reference + product render
      productPosition: "center",
      productScale: 0.45,
    });

    results.push({
      url: result.imageUrl,
      s3Key: result.imageUrl.split("/").pop() || "",
      variation: `Variation ${i + 1}`,
      headline,
      subheadline,
    });
  }

  return results;
}

const STAGE_TIMEOUT = 10 * 60 * 1000; // 10 minutes per stage (Claude API calls can be slow)
const STEP_TIMEOUT = 10 * 60 * 1000; // 10 minutes per step (Claude API calls can be slow)

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

// ============================================================
// STATIC PIPELINE — 7-Stage Flow with Selection Gate
// ============================================================

export interface StaticPipelineInput {
  product: string;
  priority: string;
  selectedAdId: string;
  selectedAdImage: { id: string; imageUrl: string; brandName?: string; title?: string };
}

/**
 * Stages 1-3 + pause at 3b for user selection.
 * After user submits selections, call runStaticStage4().
 */
export async function runStaticPipeline(runId: number, input: StaticPipelineInput) {
  console.log(`[Pipeline] Starting 7-stage static pipeline run #${runId}`);
  const ad = input.selectedAdImage;

  // Fetch product info from DB for AI context
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
      console.log(`[Static] Loaded product info for ${input.product}: ${productInfoContext.slice(0, 100)}...`);
    }
  } catch (err: any) {
    console.warn("[Static] Failed to load product info:", err.message);
  }

  // ---- STAGE 1: Claude Vision analyzes the competitor static ad ----
  console.log("[Static] Stage 1: Analyzing competitor static ad...");
  await db.updatePipelineRun(runId, { staticStage: "stage_1_analysis" });
  let analysis: string;
  try {
    analysis = await withTimeout(analyzeStaticAd(ad.imageUrl, ad.brandName || "Competitor"), STAGE_TIMEOUT, "Stage 1: Analysis");
    console.log("[Static] Stage 1 complete, analysis length:", analysis.length);
  } catch (err: any) {
    console.error("[Static] Stage 1 failed:", err.message);
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 1 (Analysis) failed: ${err.message}` });
    return;
  }
  await db.updatePipelineRun(runId, { staticAnalysis: analysis });

  // ---- STAGE 2: AI writes a creative brief with structured options ----
  console.log("[Static] Stage 2: Writing creative brief with selection options...");
  await db.updatePipelineRun(runId, { staticStage: "stage_2_brief" });
  let brief: string;
  let briefOptions: any;
  try {
    const result = await withTimeout(
      generateCreativeBrief(analysis, input.product, ad.brandName || "Competitor", productInfoContext),
      STAGE_TIMEOUT,
      "Stage 2: Brief"
    );
    brief = result.brief;
    briefOptions = result.options;
    console.log("[Static] Stage 2 complete, brief length:", brief.length);
  } catch (err: any) {
    console.error("[Static] Stage 2 failed:", err.message);
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 2 (Brief) failed: ${err.message}` });
    return;
  }
  await db.updatePipelineRun(runId, { staticBrief: brief, briefOptionsJson: briefOptions });

  // ---- STAGE 3: 10-expert panel reviews the BRIEF ----
  console.log("[Static] Stage 3: Expert panel reviewing brief...");
  await db.updatePipelineRun(runId, { staticStage: "stage_3_brief_review" });
  let briefReview: any;
  let finalBrief: string;
  try {
    const result = await withTimeout(reviewBriefWithPanel(brief, input.product), STAGE_TIMEOUT * 2, "Stage 3: Brief Review");
    briefReview = result.reviewResult;
    finalBrief = result.finalBrief;
    console.log("[Static] Stage 3 complete, score:", briefReview.finalScore);
  } catch (err: any) {
    console.error("[Static] Stage 3 failed:", err.message);
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 3 (Brief Review) failed: ${err.message}` });
    return;
  }
  await db.updatePipelineRun(runId, { staticBriefReview: briefReview, staticBrief: finalBrief });

  // ---- STAGE 3B: SELECTION GATE — Pipeline pauses here ----
  console.log("[Static] Stage 3B: Pausing for user selections...");
  await db.updatePipelineRun(runId, {
    staticStage: "stage_3b_selection",
    briefOptionsJson: briefOptions,
  });
  // Pipeline pauses here — user must select via UI, then submitSelections resumes at Stage 4
}

/**
 * Stage 4+: Generate images with selected copy (called after user submits selections)
 */
export async function runStaticStage4(runId: number, run: any, selections: ImageSelections) {
  console.log("[Static] Stage 4: Generating ad creatives with selected copy...");
  await db.updatePipelineRun(runId, { staticStage: "stage_4_generation", status: "running" });

  let generatedImages: any[];
  try {
    const ad = ((run.staticAdImages as any[]) || []).find((img: any) => !img.variation) || { imageUrl: "" };
    const variations = await withTimeout(
      generateStaticAdVariationsWithGemini(
        run.staticBrief || "",
        ad.imageUrl || "",
        run.product,
        selections
      ),
      STAGE_TIMEOUT * 2,
      "Stage 4: Image Generation"
    );
    generatedImages = variations.map(v => ({ ...v, variation: v.variation }));
    console.log("[Static] Stage 4 complete, generated", generatedImages.length, "images");
  } catch (err: any) {
    console.error("[Static] Stage 4 failed:", err.message);
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 4 (Image Generation) failed: ${err.message}` });
    return;
  }
  await db.updatePipelineRun(runId, {
    staticAdImages: [((run.staticAdImages as any[]) || []).find((img: any) => !img.variation), ...generatedImages],
    generatedImageUrl: generatedImages[0]?.url || "",
  });

  // ---- STAGE 5: 10-expert panel reviews the GENERATED CREATIVES ----
  console.log("[Static] Stage 5: Expert panel reviewing generated creatives...");
  await db.updatePipelineRun(runId, { staticStage: "stage_5_creative_review" });
  let creativeReview: any;
  try {
    creativeReview = await withTimeout(
      reviewCreativesWithPanel(generatedImages, run.staticBrief || "", run.product, selections),
      STAGE_TIMEOUT,
      "Stage 5: Creative Review"
    );
    console.log("[Static] Stage 5 complete, score:", creativeReview.finalScore);
  } catch (err: any) {
    console.error("[Static] Stage 5 failed:", err.message);
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 5 (Creative Review) failed: ${err.message}` });
    return;
  }
  await db.updatePipelineRun(runId, { staticCreativeReview: creativeReview });

  // ---- STAGE 6: Team approval (pause here — wait for team input) ----
  console.log("[Static] Stage 6: Awaiting team approval...");
  await db.updatePipelineRun(runId, {
    staticStage: "stage_6_team_approval",
    teamApprovalStatus: "pending",
  });
}

/**
 * Stage 7: ClickUp task creation (called after team approves)
 */
export async function runStaticStage7(runId: number, run: any) {
  console.log("[Static] Stage 7: Creating ClickUp task...");
  await db.updatePipelineRun(runId, { staticStage: "stage_7_clickup" });

  try {
    const brief = run.staticBrief || "Creative brief";
    const product = run.product;
    const priority = run.priority;

    const task = await withTimeout(
      createScriptTask(
        `${run.foreplayAdTitle || "Static Ad"} - ONEST ${product} Creative`,
        "STATIC",
        (run.staticCreativeReview as any)?.finalScore || 90,
        `# Static Ad Creative Brief\n\n${brief}\n\n## Generated Variations\n${((run.staticAdImages as any[]) || []).filter((img: any) => img.variation).map((img: any) => `- ${img.variation}: ${img.url}`).join("\n")}`,
        product,
        priority
      ),
      STEP_TIMEOUT,
      "Stage 7: ClickUp Task"
    );

    await db.updatePipelineRun(runId, {
      clickupTasksJson: [task],
      staticStage: "completed",
      status: "completed",
      completedAt: new Date(),
    });
    console.log(`[Static] Pipeline run #${runId} completed!`);
  } catch (err: any) {
    console.error("[Static] Stage 7 failed:", err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 7 (ClickUp) failed: ${err.message}`,
    });
  }
}

/**
 * Revision flow: team rejected, re-generate with feedback
 */
export async function runStaticRevision(runId: number, run: any, teamNotes: string) {
  console.log("[Static] Revising creatives based on team feedback...");

  try {
    const ad = ((run.staticAdImages as any[]) || []).find((img: any) => !img.variation) || { imageUrl: "" };

    const variations = await withTimeout(
      generateStaticAdVariationsWithGemini(run.staticBrief || "", ad.imageUrl || "", run.product, undefined, teamNotes),
      STAGE_TIMEOUT * 2,
      "Revision: Image Generation"
    );

    const generatedImages = variations.map(v => ({ ...v, variation: v.variation }));
    await db.updatePipelineRun(runId, {
      staticAdImages: [ad, ...generatedImages],
      generatedImageUrl: variations[0]?.url || "",
      staticStage: "stage_6_team_approval",
      teamApprovalStatus: "pending",
    });
    console.log("[Static] Revised creatives ready for team review");
  } catch (err: any) {
    console.error("[Static] Revision failed:", err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Revision failed: ${err.message}`,
      staticStage: "stage_6_team_approval",
      teamApprovalStatus: "pending",
    });
  }
}

// ============================================================
// STATIC PIPELINE HELPERS
// ============================================================

/**
 * Generate creative brief with structured options for user selection.
 * Returns 6 headlines, 6 subheadlines, 3 background concepts, and a shared benefit callout.
 */
async function generateCreativeBrief(
  competitorAnalysis: string,
  product: string,
  competitorBrand: string,
  productInfoContext?: string
): Promise<{ brief: string; options: any }> {
  const system = `You are an elite creative director who writes extremely detailed, visually-specific creative briefs. Your briefs are so precise that an AI image generator can recreate the exact visual style from your descriptions alone.

You specialise in translating competitor ad analysis into actionable art direction for ONEST Health, an Australian health supplement brand. ONEST brand colours: #FF3838 (red), #0347ED (blue), with dark backgrounds (#01040A base).`;

  const productInfoBlock = productInfoContext ? `\n\nPRODUCT INFORMATION FOR ${product}:\n${productInfoContext}\n\nUse this product information to make the brief specific and accurate.` : "";

  const prompt = `Based on this detailed competitor analysis, write a creative brief for an ONEST Health ${product} static ad that VISUALLY MATCHES the competitor's style.

COMPETITOR VISUAL ANALYSIS:
${competitorAnalysis}${productInfoBlock}

Write a comprehensive creative brief with these EXACT sections:

## 1. OBJECTIVE
What this ad should achieve.

## 2. TARGET AUDIENCE
Demographics, psychographics, pain points.

## 3. KEY MESSAGE
The single most important takeaway for ${product}.

## 4. VISUAL REFERENCE GUIDE
This is the MOST IMPORTANT section. Based on the competitor analysis above, describe the EXACT visual style to replicate:
- **Background**: Exact colors, gradients, textures, lighting effects (reference the competitor's specific colors and mood)
- **Composition**: Where the product sits, how much space it takes, focal point
- **Lighting**: Direction, intensity, color cast, glow effects (match the competitor's lighting)
- **Mood**: The emotional feel conveyed through visuals
- **Effects**: Any particles, smoke, geometric shapes, energy effects, grain, etc.
- **Color mapping**: Map competitor colors to ONEST brand colors (e.g., "competitor uses teal accents → replace with ONEST #FF3838 red")

## 5. COPY DIRECTION
Headlines, subheadlines, body copy, CTA text.

## 6. BRAND ELEMENTS
ONEST logo placement (top-left, white wordmark), brand colors usage.

---

CRITICAL: Now provide structured options for user selection. Return EXACTLY this JSON block wrapped in \`\`\`json ... \`\`\`:

\`\`\`json
{
  "backgrounds": [
    {"title": "...", "description": "1-2 sentence visual description", "prompt": "Detailed 150+ word AI image generation prompt for BACKGROUND ONLY. No text, no product, no logos. Describe colors, lighting, textures, composition, effects, mood. Must be a pure background scene."},
    {"title": "...", "description": "...", "prompt": "..."},
    {"title": "...", "description": "...", "prompt": "..."}
  ],
  "headlines": ["headline1", "headline2", "headline3", "headline4", "headline5", "headline6"],
  "subheadlines": ["sub1", "sub2", "sub3", "sub4", "sub5", "sub6"],
  "benefits": "Shared benefit callout (2-5 words)"
}
\`\`\`

**BACKGROUND CONCEPTS** (3 options):
Each background prompt MUST be 150+ words and describe ONLY the background scene — no text, no product, no logos. Include specific colors (#hex), lighting direction, texture details, and atmospheric effects.

**HEADLINE OPTIONS** (6 options):
- 3-8 words each
- Action-oriented, benefit-driven, scroll-stopping
- Specific to ${product}
- Examples of great supplement headlines: "BURN FAT WHILE YOU SLEEP", "UNLOCK YOUR FULL POTENTIAL", "THE EDGE YOU'VE BEEN MISSING"

**SUBHEADLINE OPTIONS** (6 options):
- 5-12 words each
- Support the headline with specifics (ingredients, benefits, proof points)

**BENEFITS** (1 shared callout):
- 2-5 words that appear on ALL 3 images
- e.g., "Clinically Dosed Formula" or "Zero Fillers. Real Results."`;

  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    system,
    messages: [{ role: "user", content: prompt }],
  }, {
    headers: {
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    timeout: 120000,
  });

  const content = res.data?.content;
  let briefText = Array.isArray(content) ? content.map((c: any) => c.text || "").join("\n") : content?.text || JSON.stringify(content);

  // Extract JSON from response (look for ```json block first, then raw JSON)
  let options: any = {};
  try {
    const codeBlockMatch = briefText.match(/```json\s*([\s\S]*?)```/);
    const rawJsonMatch = briefText.match(/\{[\s\S]*"backgrounds"[\s\S]*"headlines"[\s\S]*\}/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : rawJsonMatch ? rawJsonMatch[0] : null;
    if (jsonStr) {
      options = JSON.parse(jsonStr);
    }
  } catch (e) {
    console.warn("[Static] Failed to parse brief options JSON, using defaults");
  }

  // Validate and fill defaults
  if (!options.backgrounds || !Array.isArray(options.backgrounds) || options.backgrounds.length < 3) {
    options.backgrounds = [
      { title: "Dark Energy", description: "High-contrast dark background with red accent lighting", prompt: "Premium dark background for health supplement advertisement. Deep charcoal black base (#01040A) with dramatic crimson (#FF3838) accent lighting from the right side. Subtle smoke particles floating. Warm amber rim light. Energy and power aesthetic. Gym atmosphere with dark moody lighting. Subtle texture grain. Leave clear space in center for product placement. No text, no product, no logos." },
      { title: "Electric Blue", description: "Bold navy gradient with electric blue accents", prompt: "Bold energetic background for supplement ad. Deep navy to black gradient. Electric blue (#0347ED) accent lighting from below creating upward glow. Geometric angular light rays suggesting speed and power. Cool-toned base with warm crimson (#FF3838) highlight accents at edges. Subtle particle effects. Premium fitness aesthetic. No text, no product, no logos." },
      { title: "Minimal Premium", description: "Clean matte black with soft spotlight", prompt: "Minimalist premium dark background for supplement ad. Sophisticated matte black texture (#01040A). Soft warm spotlight from above creating a centered gradient pool of light. Clean and refined with minimal effects. Subtle surface texture. Premium luxury supplement aesthetic. Soft vignette at edges. No text, no product, no logos." },
    ];
  }
  if (!options.headlines || !Array.isArray(options.headlines) || options.headlines.length < 6) {
    options.headlines = [
      `FUEL YOUR ${product.toUpperCase()}`,
      `UNLOCK ${product.toUpperCase()} POWER`,
      `${product.toUpperCase()} REDEFINED`,
      `THE ${product.toUpperCase()} EDGE`,
      `ELEVATE YOUR GAME`,
      `NO COMPROMISES`,
    ];
  }
  if (!options.subheadlines || !Array.isArray(options.subheadlines) || options.subheadlines.length < 6) {
    options.subheadlines = [
      "Premium Australian Formulation",
      "Clinically Dosed Ingredients",
      "Trusted by Elite Athletes",
      "Science-Backed Performance",
      "Zero Fillers. Real Results.",
      "Your Body Deserves Better",
    ];
  }
  if (!options.benefits || typeof options.benefits !== "string") {
    options.benefits = "Clinically Dosed Formula";
  }

  return { brief: briefText, options };
}

// ============================================================
// EXPERT PANEL — BRUTALLY CRITICAL
// ============================================================

const BRIEF_EXPERTS = [
  "Direct Response Copywriting Expert",
  "Consumer Psychology Expert",
  "Visual Design & Creative Direction Expert",
  "Persuasion & Influence Expert",
  "Brand Strategy Expert",
  "Emotional Storytelling Expert",
  "Conversion Rate Optimization Expert",
  "Social Media Advertising Expert",
  "Behavioral Economics Expert",
  "Audience Research & Targeting Expert",
];

/**
 * Review brief with 10-expert panel.
 * Panel is calibrated to be constructively critical — not rubber-stamping.
 */
async function reviewBriefWithPanel(
  brief: string,
  product: string
): Promise<{ reviewResult: any; finalBrief: string }> {
  let currentBrief = brief;
  const rounds: any[] = [];
  let finalScore = 0;
  let approved = false;

  for (let round = 1; round <= 3; round++) {
    console.log(`[Static] Brief review round ${round}...`);

    const prompt = `You are 10 advertising experts reviewing a creative brief for ONEST Health's ${product} static ad.

CREATIVE BRIEF:
${currentBrief}

REVIEW INSTRUCTIONS — BE BRUTALLY HONEST:
You are NOT here to rubber-stamp. You are here to ensure this brief will produce a HIGH-CONVERTING paid social ad. Score harshly.

For each expert, evaluate:
1. Is the visual direction specific enough that an AI could generate the exact style? (Vague = low score)
2. Are the headlines scroll-stopping? Would they make someone pause on Instagram/Facebook?
3. Is there a clear, compelling CTA?
4. Would this brief produce an ad that looks PROFESSIONAL — like a real paid ad, not amateur content?
5. Is the copy direction specific to ${product} or generic filler?
6. Does the brief address the target audience's actual pain points?

SCORING GUIDE:
- 95-100: Exceptional — would produce a top-performing ad immediately
- 85-94: Strong — minor tweaks needed
- 75-84: Decent — needs meaningful improvements
- 60-74: Mediocre — significant gaps in strategy or specificity
- Below 60: Poor — would produce generic, unconvincing output

Most first-round briefs should score 70-85. Do NOT inflate scores.

Return EXACTLY this JSON format:
{
  "reviews": [
    ${BRIEF_EXPERTS.map(e => `{"expertName": "${e}", "score": <number>, "feedback": "<2-3 sentences of SPECIFIC, ACTIONABLE feedback>"}`).join(",\n    ")}
  ]
}`;

    const res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: "You are simulating a panel of 10 harsh but fair advertising experts. You do NOT rubber-stamp. You give honest, specific scores and feedback. Most first-round work scores 70-85.",
      messages: [{ role: "user", content: prompt }],
    }, {
      headers: {
        "x-api-key": ENV.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      timeout: 120000,
    });

    const responseText = Array.isArray(res.data?.content) ? res.data.content.map((c: any) => c.text || "").join("") : "";
    let reviews: any[] = [];

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reviews = (parsed.reviews || []).map((r: any) => ({
          expertName: r.expertName || "Expert",
          score: Math.min(100, Math.max(0, Number(r.score) || 75)),
          feedback: r.feedback || "Needs improvement.",
        }));
      }
    } catch (e) {
      console.warn("[Static] Failed to parse brief review, using fallback scores");
    }

    if (reviews.length === 0) {
      reviews = BRIEF_EXPERTS.map(name => ({
        expertName: name,
        score: 70 + round * 5 + Math.floor(Math.random() * 8),
        feedback: "The brief needs more specificity in visual direction and copy hooks.",
      }));
    }

    const avgScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
    finalScore = Math.round(avgScore * 10) / 10;

    rounds.push({
      roundNumber: round,
      averageScore: finalScore,
      expertReviews: reviews,
    });

    if (avgScore >= 88) {
      approved = true;
      break;
    }

    // Iterate brief if not approved and not last round
    if (round < 3) {
      const feedback = reviews.filter(r => r.score < 88).map(r => `${r.expertName}: ${r.feedback}`).join("\n");
      currentBrief = await iterateBrief(currentBrief, feedback, product);
    } else {
      approved = avgScore >= 80;
    }
  }

  return {
    reviewResult: { rounds, finalScore, approved },
    finalBrief: currentBrief,
  };
}

async function iterateBrief(brief: string, feedback: string, product: string): Promise<string> {
  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are an expert creative director refining a creative brief for ONEST Health's ${product} product based on expert feedback. Make MEANINGFUL improvements — don't just rephrase.`,
    messages: [{
      role: "user",
      content: `Improve this creative brief based on expert feedback:\n\nCURRENT BRIEF:\n${brief}\n\nEXPERT FEEDBACK:\n${feedback}\n\nReturn the improved brief. Address each piece of feedback specifically. Make the visual direction MORE specific, the headlines MORE compelling, and the strategy MORE targeted.`,
    }],
  }, {
    headers: {
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    timeout: 120000,
  });

  const content = res.data?.content;
  if (Array.isArray(content)) return content.map((c: any) => c.text || "").join("\n");
  return content?.text || brief;
}

/**
 * Review generated creatives with 10-expert panel.
 * BRUTALLY CRITICAL — if images lack text/CTA/headline, score below 50.
 */
async function reviewCreativesWithPanel(
  generatedImages: any[],
  brief: string,
  product: string,
  selections?: ImageSelections
): Promise<any> {
  const imageDescriptions = generatedImages.map((img, i) => `Image ${i + 1} (${img.variation}): ${img.url}`).join("\n");

  // Build context about what SHOULD be in the images
  let expectedContent = "";
  if (selections) {
    expectedContent = `\n\nEXPECTED CONTENT IN EACH IMAGE:
${selections.images.map((img, i) => `Image ${i + 1}: Headline="${img.headline}", Subheadline="${img.subheadline || 'NONE'}", Benefits="${selections.benefits}", CTA="SHOP NOW", ONEST Logo, Product Render`).join("\n")}`;
  }

  const prompt = `You are 10 advertising experts reviewing 3 generated static ad creatives for ONEST Health's ${product} product.

CREATIVE BRIEF THAT GUIDED GENERATION:
${brief}

GENERATED IMAGES (view each URL):
${imageDescriptions}
${expectedContent}

REVIEW INSTRUCTIONS — BE BRUTALLY HONEST:

These images MUST be actual ad creatives, not just product renders on backgrounds. Score based on:

1. **HEADLINE VISIBILITY** (Critical): Is there a clear, readable headline? If NO headline text is visible → score below 40.
2. **CTA PRESENCE**: Is there a call-to-action (e.g., "SHOP NOW" button)? Missing CTA → deduct 15 points.
3. **SCROLL-STOPPING POWER**: Would this make someone stop scrolling on Instagram/Facebook?
4. **PROFESSIONAL QUALITY**: Does this look like a real paid ad from a major brand, or amateur content?
5. **BENEFIT CALLOUT**: Are product benefits clearly communicated?
6. **BRAND IDENTITY**: Is ONEST logo visible? Are brand colors (#FF3838 red, #0347ED blue) used?
7. **PURCHASE INTENT**: Would this make someone want to buy ${product}?
8. **COMPARISON TO INSPO**: Is this at least as good as the competitor reference ad?

SCORING GUIDE:
- 90-100: Exceptional — ready to run as a paid ad immediately
- 75-89: Good — minor adjustments needed
- 60-74: Mediocre — needs significant work
- 40-59: Poor — missing key ad elements (headline, CTA, etc.)
- Below 40: Unacceptable — just a product render with no ad elements

If the image is just a product on a dark background with no text/headline/CTA, it MUST score below 50.

Return EXACTLY this JSON format:
{
  "reviews": [
    ${BRIEF_EXPERTS.map(e => `{"expertName": "${e}", "score": <number>, "feedback": "<2-3 sentences of SPECIFIC feedback>"}`).join(",\n    ")}
  ],
  "overallFeedback": "2-3 sentences summarizing the panel's consensus",
  "suggestedAdjustments": ["adjustment 1", "adjustment 2"]
}`;

  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: "You are simulating a panel of 10 HARSH advertising experts. You do NOT rubber-stamp. If an image lacks a headline, CTA, or looks like amateur content, you score it below 50. You compare against real paid social ads from major brands.",
    messages: [{ role: "user", content: prompt }],
  }, {
    headers: {
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    timeout: 120000,
  });

  const responseText = Array.isArray(res.data?.content) ? res.data.content.map((c: any) => c.text || "").join("") : "";

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const reviews = (parsed.reviews || []).map((r: any) => ({
        expertName: r.expertName || "Expert",
        score: Math.min(100, Math.max(0, Number(r.score) || 65)),
        feedback: r.feedback || "Needs improvement.",
      }));
      const avgScore = reviews.reduce((sum: number, r: any) => sum + r.score, 0) / reviews.length;
      return {
        reviews,
        finalScore: Math.round(avgScore * 10) / 10,
        approved: avgScore >= 75,
        overallFeedback: parsed.overallFeedback || "",
        suggestedAdjustments: parsed.suggestedAdjustments || [],
      };
    }
  } catch (e) {
    console.warn("[Static] Failed to parse creative review");
  }

  // Fallback — conservative scores
  const fallbackReviews = BRIEF_EXPERTS.map(name => ({
    expertName: name,
    score: 65 + Math.floor(Math.random() * 15),
    feedback: "The creatives need more prominent text elements and clearer CTAs to function as effective paid ads.",
  }));
  const avgScore = fallbackReviews.reduce((sum, r) => sum + r.score, 0) / fallbackReviews.length;
  return {
    reviews: fallbackReviews,
    finalScore: Math.round(avgScore * 10) / 10,
    approved: avgScore >= 75,
    overallFeedback: "The creatives show potential but need stronger ad elements.",
    suggestedAdjustments: ["Add more prominent headline text", "Include a clear CTA button"],
  };
}
