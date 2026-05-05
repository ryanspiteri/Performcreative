import * as db from "../db";
import { analyzeStaticAd } from "./claude";
import { pushIterationVariationToClickUp } from "./iterationClickUp";
import { generateProductAdWithNanoBananaPro, type ImageModel as GeminiImageModel, type NanoBananaProResult } from "./nanoBananaPro";
import { generateWithOpenAI } from "./openaiImage";
import type { ImageGenerateOptions } from "./imageGenerator";

export type ImageModel = GeminiImageModel | "openai_gpt_image";
import { buildReferenceBasedPrompt, type CreativityLevel } from "./geminiPromptBuilder";
import { validateProductFidelity } from "./visionQA";
import { overlayBrandLogo } from "./brandLogoOverlay";
import { withTimeout, claudeClient, STEP_TIMEOUT, VARIATION_TIMEOUT, buildProductInfoContext, runWithConcurrency } from "./_shared";
import { WINNING_AD_FRAMEWORK } from "./winningAdFramework";
import {
  iterationBriefV1Schema,
  VISUAL_DESCRIPTION_MAX,
  VARIATION_TYPES,
  type IterationBriefV1,
  type VariationType as BriefVariationType,
} from "../../shared/iterationBriefSchema";
import axios from "axios";

/** Result of brief generation — caller writes briefQualityWarning to the run when true. */
export interface BriefGenerationResult {
  brief: string;
  qualityWarning: boolean;
}

function stripMarkdownFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

/** Remove inline markdown bold/italic markers (** and *) from a string. */
function stripMarkdownInline(text: string): string {
  return text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").trim();
}

function safeJsonParse<T = unknown>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Clamp fields that Claude frequently gets wrong before running strict schema validation.
 * This prevents a single over-length visualDescription from invalidating an otherwise correct brief.
 */
function sanitizeRawBrief(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).variations)) {
    return parsed;
  }
  const obj = parsed as Record<string, unknown>;
  const validVariationTypes = new Set(VARIATION_TYPES as readonly string[]);
  const validAdAngles = new Set(["auto", "claim_led", "before_after", "testimonial", "ugc_organic", "product_hero", "lifestyle"]);
  const stripStr = (v: unknown) => typeof v === "string" ? stripMarkdownInline(v) : v;
  return {
    ...obj,
    originalHeadline: stripStr(obj.originalHeadline),
    originalAngle: stripStr(obj.originalAngle),
    variations: (obj.variations as any[]).map((v: any) => ({
      ...v,
      headline: stripStr(v.headline),
      subheadline: stripStr(v.subheadline),
      angle: stripStr(v.angle),
      angleDescription: stripStr(v.angleDescription),
      visualDescription: typeof v.visualDescription === "string"
        ? stripMarkdownInline(v.visualDescription).slice(0, VISUAL_DESCRIPTION_MAX)
        : v.visualDescription,
      backgroundNote: stripStr(v.backgroundNote),
      variationType: validVariationTypes.has(v.variationType) ? v.variationType : "full_remix",
      adAngle: validAdAngles.has(v.adAngle) ? v.adAngle : undefined,
    })),
  };
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function validateBriefJson(text: string): IterationBriefV1 | null {
  const candidates = [text, extractJsonObject(text)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    const result = iterationBriefV1Schema.safeParse(sanitizeRawBrief(parsed));
    if (result.success) return result.data;
  }
  return null;
}

/** Deterministic fallback when Claude returns invalid JSON twice. Produces a minimal valid v1 brief. */
function buildFallbackBrief(
  variationCount: number,
  variationTypes: string[] | undefined,
  analysis: string,
): IterationBriefV1 {
  const firstHeadlineMatch = analysis.match(/headline[^:]*:([^\n]+)/i);
  const rawHeadlineLine = (firstHeadlineMatch?.[1] || "").trim();
  const cleanedHeadline = stripMarkdownInline(rawHeadlineLine).replace(/^["'\s*]+|["'\s*]+$/g, "").trim();
  const originalHeadline = (cleanedHeadline || "UPDATE ME").slice(0, 120);
  const validTypes: BriefVariationType[] = [
    "headline_only",
    "background_only",
    "layout_only",
    "benefit_callouts_only",
    "props_only",
    "talent_swap",
    "full_remix",
  ];
  const defaultType: BriefVariationType = "full_remix";
  const variations = Array.from({ length: Math.max(1, variationCount) }, (_, i) => {
    const requested = variationTypes?.[i] ?? variationTypes?.[0];
    const variationType: BriefVariationType =
      requested && (validTypes as string[]).includes(requested)
        ? (requested as BriefVariationType)
        : defaultType;
    return {
      number: i + 1,
      variationType,
      angle: "Benefit-Driven",
      angleDescription: "Fallback variation — please edit before approving.",
      headline: originalHeadline,
      subheadline: "",
      visualDescription: "",
      backgroundNote: "",
      benefitCallouts: [],
    };
  });
  return {
    version: 1,
    originalHeadline,
    originalAngle: "",
    preserveElements: [],
    targetAudience: "",
    referenceFxPresent: false,
    detectedFxTypes: [],
    variations,
  };
}

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

/**
 * Route a single variation generation to the right backend (Gemini via Nano Banana
 * or OpenAI gpt-image-1) based on the model field. Returns a NanoBananaProResult
 * shape so downstream code stays model-agnostic.
 */
type DispatchOptions = Omit<Parameters<typeof generateProductAdWithNanoBananaPro>[0], "model"> & {
  model?: ImageModel;
};

async function dispatchVariationGeneration(
  options: DispatchOptions,
  variationIndex: number,
): Promise<NanoBananaProResult> {
  const label = `Variation ${variationIndex + 1}`;
  if (options.model === "openai_gpt_image") {
    const openaiOpts: ImageGenerateOptions = {
      prompt: options.prompt,
      controlImageUrl: options.controlImageUrl,
      productRenderUrl: options.productRenderUrl,
      personImageUrl: options.personImageUrl,
      aspectRatio: options.aspectRatio,
      resolution: options.resolution,
      useCompositing: options.useCompositing,
      productPosition: options.productPosition,
      productScale: options.productScale,
    };
    const result = await withTimeout(
      generateWithOpenAI(openaiOpts),
      VARIATION_TIMEOUT,
      `${label} (OpenAI gpt-image-1)`,
    );
    return { imageUrl: result.imageUrl, s3Key: result.s3Key };
  }
  // Narrow to Gemini models for the Nano Banana path.
  const geminiModel: GeminiImageModel = options.model === "nano_banana_2" ? "nano_banana_2" : "nano_banana_pro";
  return generateVariationWithFallback({ ...options, model: geminiModel }, variationIndex);
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
  /** Ad angle from /iterate picker. "auto" = let Claude diversify per variation;
      anything else = lock every variation to this angle. */
  adAngle?: import("../../shared/iterationBriefSchema").AdAngle;
  /** Per-variation ad angles (length must equal variationCount). When provided
      this overrides `adAngle` — Claude is told the exact angle for each variation,
      with "auto" meaning "you pick this one". */
  adAngles?: import("../../shared/iterationBriefSchema").AdAngle[];
  styleMode?: import("../../shared/iterationBriefSchema").StyleMode;
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
      iterationStage: "stage_1b_pain_points_approval",
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

  // ---- STAGE 1b: Reverse-engineer pain-point candidates and pause for approval ----
  try {
    console.log(`[Iteration] Stage 1b: Reverse-engineering pain points...`);
    const run = await db.getPipelineRun(runId);
    const analysis = run?.iterationAnalysis || "";
    const productInfoForPainPoints = await buildIterationProductContext(input.product);
    const productInfoRow = await db.getProductInfo(input.product);
    const curatedPainPoints = (productInfoRow as any)?.painPoints ?? null;

    const candidates = await withTimeout(
      reverseEngineerPainPoints(analysis, input.product, productInfoForPainPoints, curatedPainPoints),
      STEP_TIMEOUT,
      "Stage 1b: Pain Points",
    );

    await db.updatePipelineRun(runId, {
      iterationPainPointCandidates: JSON.stringify(candidates),
      // stage already set to stage_1b_pain_points_approval above
    });
    console.log(`[Iteration] Stage 1b complete. ${candidates.length} candidates surfaced. Paused at approval gate.`);
  } catch (err: any) {
    console.error(`[Iteration] Stage 1b failed:`, err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 1b failed: ${err.message}`,
      iterationStage: "stage_1b_pain_points_approval",
    });
    return;
  }
  return; // pause — Stage 2 runs after pain-point approval via runIterationStage2
}

/**
 * Stage 2: generate the iteration brief. Called from `approveIterationPainPoints`
 * after the user picks per-variation pain points. Reads the analysis +
 * selected pain points from the DB; the original input object isn't available
 * here so we reconstruct what we need from the persisted run.
 */
export async function runIterationStage2(runId: number) {
  const run = await db.getPipelineRun(runId);
  if (!run) {
    console.error(`[Iteration] runIterationStage2: run ${runId} not found`);
    return;
  }
  const product = run.product;
  const productInfoContext = await buildIterationProductContext(product);
  const sourceType = (run.iterationSourceType as IterationSourceType) ?? "own_ad";
  const adaptationMode = run.iterationAdaptationMode as IterationAdaptationMode | null | undefined;
  const analysis = run.iterationAnalysis || "";
  const variationCount = run.variationCount || 3;
  const variationTypes = run.variationTypes ? safeJsonParse<string[]>(run.variationTypes) ?? undefined : undefined;
  const selectedPainPoints = run.iterationSelectedPainPoints
    ? (safeJsonParse<SelectedPainPoint[]>(run.iterationSelectedPainPoints) ?? undefined)
    : undefined;
  const runAdAngle = (run.adAngle as import("../../shared/iterationBriefSchema").AdAngle | null) ?? "auto";

  try {
    console.log(`[Iteration] Stage 2: Generating iteration brief (run ${runId})...`);
    const briefResult = await withTimeout(
      sourceType === "competitor_ad"
        ? generateCompetitorIterationBrief(
            analysis,
            product,
            productInfoContext,
            adaptationMode ?? "concept",
            run.foreplayAdBrand ?? undefined,
            runAdAngle,
            undefined,
            selectedPainPoints,
            variationCount,
          )
        : generateIterationBrief(
            analysis,
            product,
            productInfoContext,
            variationCount,
            variationTypes,
            runAdAngle,
            undefined,
            selectedPainPoints,
          ),
      STEP_TIMEOUT,
      "Stage 2: Iteration Brief",
    );

    await db.updatePipelineRun(runId, {
      iterationBrief: briefResult.brief,
      iterationStage: "stage_2b_approval",
      briefQualityWarning: briefResult.qualityWarning ? 1 : 0,
    });
    if (briefResult.qualityWarning) {
      console.warn(`[Iteration] Stage 2 used fallback brief — user must edit before approval`);
    }
    console.log(`[Iteration] Stage 2 complete. Paused at brief approval gate.`);
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
    const modelLabel =
      imageModel === "openai_gpt_image" ? "OpenAI gpt-image-1" : MODEL_LABELS[imageModel];
    console.log(`[Iteration] Using image model: ${modelLabel}`);

    // Get product render. Resolution order:
    //   1. Explicit user pick (selectedRenderId) — they manually clicked
    //      a thumbnail on /iterate.
    //   2. Flavour-tagged render for this run's selectedFlavour — when the
    //      user picked "Pink Lemonade" we should pass the Pink Lemonade
    //      render PNG to Gemini, not the global default which might be a
    //      different flavour (and was, before this fix — Mango defaults
    //      were leaking into Pink Lemonade runs).
    //   3. Global default for the product — the catch-all fallback.
    // Build a *pool* of candidate renders. Variations within a run round-robin
    // across the pool so multiple flavour-tagged renders (e.g. front + tilted)
    // produce visual variety naturally instead of every variation reusing the
    // single isDefault shot. Manual selectedRenderId locks the pool to one.
    let renderPool: Array<Awaited<ReturnType<typeof db.getProductRenderById>>> = [];
    if (run.selectedRenderId) {
      const picked = await db.getProductRenderById(run.selectedRenderId);
      if (picked) renderPool = [picked];
      else console.warn(`[Iteration] Selected render #${run.selectedRenderId} not found, falling back to flavour/default lookup`);
    }
    if (renderPool.length === 0 && run.selectedFlavour) {
      const flavourRenders = await db.listProductRendersByFlavour(product, run.selectedFlavour);
      if (flavourRenders.length > 0) {
        renderPool = flavourRenders;
        console.log(`[Iteration] Render pool for ${product} / ${run.selectedFlavour}: ${flavourRenders.length} render(s) — will round-robin across variations`);
      } else {
        console.warn(`[Iteration] No render tagged for ${product} / "${run.selectedFlavour}" — falling back to global default. Upload a flavour-specific render in /product-info to fix.`);
      }
    }
    if (renderPool.length === 0) {
      const fallback = await db.getDefaultProductRender(product);
      if (fallback) renderPool = [fallback];
    }
    if (renderPool.length === 0 || !renderPool[0]) {
      throw new Error(`No product render found for ${product}`);
    }
    // Primary render — used for fallback paths and logging. The structured
    // variation loop picks per-variation from renderPool below.
    const productRender = renderPool[0]!;

    // Resolve brand logo. Passed to Gemini as an extra reference so it doesn't
    // pick up the competitor's logo from the reference ad. null = no logo
    // configured (system falls through to whatever Gemini does today, plus a
    // log line telling the user to upload one in /brand-logos).
    const brandLogo = await db.getDefaultBrandLogo();
    if (brandLogo) {
      console.log(`[Iteration] Using brand logo #${brandLogo.id} (${brandLogo.name})`);
    } else {
      console.warn(`[Iteration] No brand logo configured. Upload one in /brand-logos to stop Gemini from reusing competitor logos from the reference ad.`);
    }

    // Resolve person references. Two modes:
    //  - Custom Per Variation: selectedPersonIds is a JSON array `(number | null)[]` of length N.
    //    Each slot overrides the person for that variation. null = no person.
    //  - All Same: selectedPersonId is a scalar applied to every variation.
    let globalPersonImageUrl: string | undefined;
    let perVariationPersonUrls: (string | undefined)[] = [];
    let parsedPersonIds: (number | null)[] = [];
    if (typeof run.selectedPersonIds === "string" && run.selectedPersonIds.length > 0) {
      try {
        const raw = JSON.parse(run.selectedPersonIds);
        if (Array.isArray(raw)) {
          parsedPersonIds = raw.map((v) => (typeof v === "number" ? v : null));
        }
      } catch {
        console.warn(`[Iteration] selectedPersonIds is not valid JSON, ignoring`);
      }
    }
    if (parsedPersonIds.length > 0) {
      const uniqueIds = Array.from(new Set(parsedPersonIds.filter((id): id is number => id != null)));
      const idToUrl = new Map<number, string>();
      await Promise.all(
        uniqueIds.map(async (id) => {
          const p = await db.getPerson(id);
          if (p) idToUrl.set(id, p.url);
          else console.warn(`[Iteration] Per-variation person #${id} not found`);
        }),
      );
      perVariationPersonUrls = parsedPersonIds.map((id) => (id != null ? idToUrl.get(id) : undefined));
      const firstUrl = perVariationPersonUrls.find((u) => !!u);
      if (firstUrl) globalPersonImageUrl = firstUrl;
    } else if (run.selectedPersonId) {
      const person = await db.getPerson(run.selectedPersonId);
      if (person) {
        globalPersonImageUrl = person.url;
        console.log(`[Iteration] Using person type reference: ${person.name}`);
      } else {
        console.warn(`[Iteration] Selected person #${run.selectedPersonId} not found or deleted, proceeding without`);
      }
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

    // Structured FX flag + style mode from the run + brief (Day 2 fix for fire/ice slop)
    const runStyleMode = (run.styleMode as import("../../shared/iterationBriefSchema").StyleMode | null) || undefined;
    const briefFxPresent = briefData?.referenceFxPresent === true;
    const briefDetectedFx = Array.isArray(briefData?.detectedFxTypes)
      ? (briefData.detectedFxTypes as import("../../shared/iterationBriefSchema").DetectedFxType[])
      : [];

    if (briefData?.variations && Array.isArray(briefData.variations)) {
      // Generate variations concurrently (2 at a time to avoid API rate
      // limits). Each task returns a Result type so a single failure
      // doesn't kill the whole batch — we collect successes and ship,
      // mark failures separately so the UI can surface a "regenerate"
      // affordance per failed variation.
      type VariationSuccess = {
        ok: true;
        url: string;
        s3Key: string;
        headline: string;
        subheadline: string | null;
        angle: string | null;
        backgroundNote: string | null;
        productImageUrl: string;
        controlImageUrl: string;
      };
      type VariationFailure = {
        ok: false;
        index: number;
        headline: string;
        error: string;
      };
      type VariationResult = VariationSuccess | VariationFailure;

      const tasks = Array.from({ length: variationCount }, (_, i) => async (): Promise<VariationResult> => {
        const v = briefData.variations[i] || {};
        const variationPersonUrl = perVariationPersonUrls[i] ?? globalPersonImageUrl;
        // Round-robin across the render pool so flavour-tagged variants (front,
        // tilted, etc.) all get used across a multi-variation run.
        const variationRender = renderPool[i % renderPool.length]!;
        if (renderPool.length > 1) {
          console.log(`[Iteration] V${i + 1}/${variationCount} → render #${variationRender.id} (${variationRender.fileName})`);
        }

        const basePrompt = buildReferenceBasedPrompt({
          headline: v.headline || `${product.toUpperCase()} VARIATION ${i + 1}`,
          subheadline: v.subheadline || undefined,
          productName: `ONEST Health ${product}`,
          productKey: product,
          flavour: run.selectedFlavour || undefined,
          variationType: v.variationType,
          adAngle: v.adAngle,
          visualDescription: v.visualDescription || undefined,
          backgroundStyleDescription: v.backgroundNote || undefined,
          benefitCallouts: Array.isArray(v.benefitCallouts) && v.benefitCallouts.length > 0 ? v.benefitCallouts : undefined,
          referenceFxPresent: briefFxPresent,
          detectedFxTypes: briefDetectedFx,
          styleMode: runStyleMode,
          aspectRatio: aspectRatio as any,
          targetAudience: run.selectedAudience || briefData.targetAudience || undefined,
          hasPersonReference: !!variationPersonUrl,
        });

        const baseUniquenessNote = `\n\n=== VARIATION ${i + 1} UNIQUENESS ===\nThis is variation #${i + 1} of ${variationCount}. Make this visually distinct from other variations by using unique:\n- Color combinations and lighting angles\n- Composition and framing choices\n- Background element arrangements\n- Visual effects and atmospheric details\n\nDo NOT create identical or near-identical outputs. Each variation must be recognizably different while maintaining the reference style.`;

        // Validate-and-retry loop: up to MAX_ATTEMPTS (1 initial + 2 retries).
        // Each attempt generates the image, then asks Vision QA whether the
        // product label is structurally correct vs the canonical render. On
        // FAIL we retry with a hardened prompt that names the exact failure.
        // After MAX_ATTEMPTS we throw — the outer catch turns it into a
        // partial-success failure (other variations still ship).
        const MAX_ATTEMPTS = 3;
        let lastVqaReason: string | undefined;
        try {
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const hardenedSuffix = lastVqaReason
              ? `\n\n=== PREVIOUS ATTEMPT FAILED VALIDATION ===\nReason: ${lastVqaReason}\nMatch Image 2's product design EXACTLY this time. Do not deviate from the canonical product. Body colour, swoosh colour, wordmark, subtext, and flavour strip MUST match Image 2.`
              : "";
            const geminiPrompt = `${basePrompt}${baseUniquenessNote}${hardenedSuffix}`;

            console.log(`[Iteration] Generating variation ${i + 1}/${variationCount} (attempt ${attempt + 1}/${MAX_ATTEMPTS}) with ${imageModel}`);

            const result = await dispatchVariationGeneration({
              prompt: geminiPrompt,
              controlImageUrl: sourceUrl,
              productRenderUrl: variationRender.url,
              aspectRatio: aspectRatio as any,
              resolution: (run.resolution as any) || "2K",
              model: imageModel,
              useCompositing: true,
              productPosition: "center",
              productScale: 0.45,
              personImageUrl: variationPersonUrl,
            }, i);

            // Brand-logo overlay: when a default logo is configured, sharp
            // composites it onto the Gemini output before VQA. The overlay
            // is defensive — on any failure we keep the original URL so
            // a single overlay hiccup doesn't break the run.
            const finalUrl = brandLogo?.url
              ? (await overlayBrandLogo({
                  backgroundUrl: result.imageUrl,
                  logoUrl: brandLogo.url,
                  position: "top-left",
                  scale: 0.12,
                })).imageUrl
              : result.imageUrl;

            const vqa = await validateProductFidelity(finalUrl, variationRender.url);
            if (vqa.pass) {
              return {
                ok: true,
                url: finalUrl,
                s3Key: finalUrl.split('/').pop() || '',
                headline: v.headline || `VARIATION ${i + 1}`,
                subheadline: v.subheadline || null,
                angle: v.angle || null,
                backgroundNote: v.backgroundNote || null,
                productImageUrl: variationRender.url,
                controlImageUrl: sourceUrl,
              };
            }
            lastVqaReason = vqa.reason;
            console.warn(`[Iteration] V${i + 1} attempt ${attempt + 1} failed Vision QA: ${vqa.reason}. ${attempt + 1 < MAX_ATTEMPTS ? "Retrying with hardened prompt." : "No retries left."}`);
          }
          throw new Error(`Vision QA failed after ${MAX_ATTEMPTS} attempts: ${lastVqaReason ?? "unknown reason"}`);
        } catch (err: any) {
          const message = err?.message || "Unknown generation error";
          console.error(`[Iteration] Variation ${i + 1} failed: ${message}`);
          return {
            ok: false,
            index: i,
            headline: v.headline || `VARIATION ${i + 1}`,
            error: message,
          };
        }
      });

      const settled = await runWithConcurrency(tasks, 2);
      const successes = settled.filter((r): r is VariationSuccess => r.ok);
      const failures = settled.filter((r): r is VariationFailure => !r.ok);

      if (failures.length > 0) {
        console.warn(`[Iteration] ${failures.length}/${variationCount} variations failed. Shipping ${successes.length} successes.`);
        for (const f of failures) {
          console.warn(`[Iteration]   V${f.index + 1} (${f.headline}): ${f.error}`);
        }
      }

      // Hard fail only when EVERY variation failed — partial success is
      // useful, zero success is not.
      if (successes.length === 0) {
        throw new Error(
          `All ${variationCount} variations failed to generate. Last error: ${failures[0]?.error ?? "unknown"}`,
        );
      }

      geminiResults.push(...successes);
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
        const variationRender = renderPool[i % renderPool.length]!;

        const fallbackPrompt = buildReferenceBasedPrompt({
          headline,
          productName: `ONEST Health ${product}`,
          productKey: product,
          flavour: run.selectedFlavour || undefined,
          backgroundStyleDescription: bg,
          aspectRatio: aspectRatio as any,
        });

        const result = await dispatchVariationGeneration({
          prompt: fallbackPrompt,
          controlImageUrl: sourceUrl,
          productRenderUrl: variationRender.url,
          aspectRatio: aspectRatio as any,
          resolution: (run.resolution as any) || "2K",
          model: imageModel,
          useCompositing: true,
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
          productImageUrl: variationRender.url,
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
  overrides?: {
    headline?: string;
    subheadline?: string;
    /** Free-form scene description from the user. Routed into the prompt builder's
     *  visualDescription slot — covers backgrounds, mood, props, composition, anything. */
    customDescription?: string;
    referenceImageUrl?: string;
    /** Per-regen style fidelity override. Falls back to run.styleMode. */
    styleMode?: import("../../shared/iterationBriefSchema").StyleMode;
    /** Per-regen ad angle override. Falls back to brief variation / run.adAngle. */
    adAngle?: import("../../shared/iterationBriefSchema").AdAngle;
  }
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
  const currentVariation = variations[variationIndex] || {};

  // Headline/subheadline: blank input keeps the current value (current variation
  // first, then brief fallback). Lets the user retune scene/style without retyping.
  const headline = overrides?.headline || currentVariation.headline || v.headline || `VARIATION ${variationIndex + 1}`;
  const subheadline = overrides?.subheadline || currentVariation.subheadline || v.subheadline || null;

  // Reference precedence: uploaded image > existing variation (text-only) > original source
  const hasReferenceImage = !!overrides?.referenceImageUrl;
  const isTextOnlyChange = !overrides?.customDescription && !hasReferenceImage && (overrides?.headline || overrides?.subheadline);

  // Free-form description from the user is routed into visualDescription (the
  // scene/composition slot). Falls back to the brief's visualDescription, then
  // its backgroundNote. We no longer wrap in "Premium background..." boilerplate
  // since the user might describe people, props, or any composition.
  const sceneDescription = overrides?.customDescription
    || v.visualDescription
    || v.backgroundNote
    || undefined;

  // Get product render. Same resolution order as Stage 3 fresh runs:
  // explicit selectedRenderId → flavour pool (round-robined by variationIndex)
  // → global default. Using `variationIndex % pool.length` keeps regeneration
  // deterministic — variation #2 always re-uses the same render slot it had.
  let productRender;
  if (run.selectedRenderId) {
    productRender = await db.getProductRenderById(run.selectedRenderId);
  }
  if (!productRender && run.selectedFlavour) {
    const flavourRenders = await db.listProductRendersByFlavour(product, run.selectedFlavour);
    if (flavourRenders.length > 0) {
      productRender = flavourRenders[variationIndex % flavourRenders.length];
    }
  }
  if (!productRender) {
    productRender = await db.getDefaultProductRender(product);
  }
  if (!productRender) {
    throw new Error(`No product render found for ${product}`);
  }

  const aspectRatio = run.aspectRatio || "1:1";
  const imageModel: ImageModel = (run.imageModel as ImageModel) || "nano_banana_pro";

  // Per-regen overrides win over run-level defaults.
  const regenStyleMode = overrides?.styleMode
    || (run.styleMode as import("../../shared/iterationBriefSchema").StyleMode | null)
    || undefined;
  const regenAdAngle = overrides?.adAngle
    || v.adAngle
    || (run.adAngle as import("../../shared/iterationBriefSchema").AdAngle | null)
    || undefined;
  const regenFxPresent = briefData?.referenceFxPresent === true;
  const regenDetectedFx = Array.isArray(briefData?.detectedFxTypes)
    ? (briefData.detectedFxTypes as import("../../shared/iterationBriefSchema").DetectedFxType[])
    : [];

  const regenBenefitCallouts = Array.isArray(v.benefitCallouts) && v.benefitCallouts.length > 0 ? v.benefitCallouts : undefined;
  const geminiPrompt = buildReferenceBasedPrompt({
    headline,
    subheadline: subheadline || undefined,
    productName: `ONEST Health ${product}`,
    productKey: product,
    flavour: run.selectedFlavour || undefined,
    variationType: v.variationType,
    adAngle: regenAdAngle,
    visualDescription: sceneDescription,
    benefitCallouts: regenBenefitCallouts,
    referenceFxPresent: regenFxPresent,
    detectedFxTypes: regenDetectedFx,
    styleMode: regenStyleMode,
    aspectRatio: aspectRatio as any,
    targetAudience: run.selectedAudience || briefData?.targetAudience || "fitness-conscious adults",
  });

  let controlImageUrl: string;
  if (hasReferenceImage) {
    // User uploaded a reference image — use it as the style reference
    controlImageUrl = overrides!.referenceImageUrl!;
    console.log(`[Iteration] Regenerating variation ${variationIndex + 1} with uploaded reference image`);
  } else if (isTextOnlyChange && variations[variationIndex]?.url) {
    // Text-only change — reuse existing variation as control
    controlImageUrl = variations[variationIndex].url;
    console.log(`[Iteration] Text-only regeneration for variation ${variationIndex + 1}`);
  } else {
    // Full regeneration — use original source ad
    controlImageUrl = run.iterationSourceUrl || "";
    console.log(`[Iteration] Full regeneration for variation ${variationIndex + 1}`);
  }

  // Resolve brand logo for the regen path too — same default-logo lookup as Stage 3.
  const regenBrandLogo = await db.getDefaultBrandLogo();

  const result = await dispatchVariationGeneration(
    {
      prompt: geminiPrompt,
      controlImageUrl,
      productRenderUrl: productRender.url,
      aspectRatio: aspectRatio as any,
      model: imageModel,
      useCompositing: true,
      productPosition: "center",
      productScale: 0.45,
    },
    variationIndex,
  );

  const finalUrl = regenBrandLogo?.url
    ? (await overlayBrandLogo({
        backgroundUrl: result.imageUrl,
        logoUrl: regenBrandLogo.url,
        position: "top-left",
        scale: 0.12,
      })).imageUrl
    : result.imageUrl;

  // Race condition fix: re-read variations before merging to avoid clobbering concurrent changes
  const freshRun = await db.getPipelineRun(runId);
  const freshVariations: any[] = Array.isArray(freshRun?.iterationVariations) ? freshRun!.iterationVariations as any[] : variations;

  const variationLabel = variationIndex === 0 ? "Control" : `Variation ${variationIndex + 1}`;
  freshVariations[variationIndex] = {
    ...freshVariations[variationIndex],
    url: finalUrl,
    variation: variationLabel,
    ...(overrides?.headline && { headline: overrides.headline }),
    ...(overrides?.subheadline && { subheadline: overrides.subheadline }),
  };

  await db.updatePipelineRun(runId, {
    iterationVariations: freshVariations,
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

// ============================================================
// PAIN-POINT-DRIVEN ITERATION (Stage 1b)
// ============================================================

/** A pain point as surfaced by Stage 1b reverse-engineering. */
export interface PainPointCandidate {
  title: string;
  description: string;
  /** "library" = pulled from the user's curated list on product_info.painPoints
   *  "derived" = Claude derived it from targetAudience/benefits/keySellingPoints */
  source: "library" | "derived";
  /** "winner_hits" = the uploaded ad already attacks this pain
   *  "strong_test" = adjacent pain Claude recommends testing
   *  "adjacent_test" = further-out pain worth a slot */
  recommendation: "winner_hits" | "strong_test" | "adjacent_test";
  rationale: string;
}

/** A pain point as approved by the user, locked onto a variation slot. */
export interface SelectedPainPoint {
  title: string;
  description: string;
  source: "library" | "freeform" | "auto";
}

/** Caps applied at upsert / approval time. Mirror in the router input. */
export const PAIN_POINT_TITLE_MAX = 100;
export const PAIN_POINT_DESCRIPTION_MAX = 500;
export const PAIN_POINTS_FIELD_MAX = 8000;

/**
 * Iteration-local product context. Calls `buildProductInfoContext` (which is
 * shared across pipelines and intentionally NOT extended) and appends the
 * pain-points block. Only the iteration pipeline reads this; static / script /
 * UGC pipelines keep their existing prompts unchanged.
 */
async function buildIterationProductContext(product: string): Promise<string> {
  const base = await buildProductInfoContext(product);
  try {
    const info = await db.getProductInfo(product);
    const painPoints = (info as any)?.painPoints?.toString().trim();
    if (painPoints) {
      return base ? `${base}\nPain Points (curated list):\n${painPoints}` : `Pain Points (curated list):\n${painPoints}`;
    }
  } catch {
    /* swallow — pain points are non-critical */
  }
  return base;
}

/**
 * Build the per-variation pain-point instruction for the brief prompt. Two modes:
 * - empty / no pain points: returns empty string (caller falls through to the
 *   legacy adAngle instruction)
 * - per-variation: explicit list, one pain point per variation slot. AUTO slots
 *   tell Claude to pick a distinct pain point of his own choosing.
 */
export function buildPainPointInstruction(
  selectedPainPoints: SelectedPainPoint[] | undefined,
): string {
  if (!selectedPainPoints || selectedPainPoints.length === 0) return "";
  const allAuto = selectedPainPoints.every((p) => p.source === "auto");
  if (allAuto) {
    return `PAIN POINT — DIVERSIFY:
The user selected "Auto" for every variation. Pick a DIFFERENT pain point for each variation. Each variation's headline + visualDescription + backgroundNote must make that specific pain felt. No two variations should attack the same pain when the count allows it.`;
  }
  const lines = selectedPainPoints
    .map((p, i) => {
      if (p.source === "auto") {
        return `- Variation ${i + 1}: AUTO — pick a pain point yourself, distinct from the locked picks in this list and from other AUTO slots.`;
      }
      return `- Variation ${i + 1}: ${p.title}\n  Description: ${p.description}`;
    })
    .join("\n");
  return `PAIN POINT — PER VARIATION:
Each variation must hit a specific pain point. Set the variation's adAngle to a single short slug derived from the pain point title (lowercase, dashes). Shape headline + subheadline + visualDescription + backgroundNote so the named pain is felt — the headline should articulate the problem or its solution, the visual should embody who suffers from it.
${lines}`;
}

/**
 * Stage 1b: reverse-engineer 4–6 candidate pain points for the user to choose
 * from. Reads the winner's analysis + the curated pain-points field on
 * product_info. If the curated field is populated, Claude ranks library entries.
 * If it's empty, Claude derives candidates from targetAudience / benefits /
 * keySellingPoints. Mirrors the brief-generator retry pattern: one retry on
 * malformed JSON, then a deterministic fallback so the run never hard-stops.
 */
export async function reverseEngineerPainPoints(
  analysis: string,
  product: string,
  productInfoContext: string,
  curatedPainPoints: string | null | undefined,
): Promise<PainPointCandidate[]> {
  const hasLibrary = !!curatedPainPoints && curatedPainPoints.trim().length > 0;
  const sourceMode = hasLibrary ? "library" : "derived";
  const libraryBlock = hasLibrary
    ? `\n\nCURATED PAIN-POINT LIBRARY (rank and pick from this list verbatim where possible — title MUST match a list entry; only paraphrase the description):\n${curatedPainPoints}`
    : `\n\nNo curated pain points are stored for this product yet. Derive 4–6 candidates from the product's targetAudience, benefits, and keySellingPoints. Mark every candidate with source: "derived".`;

  const system = `You are a senior DTC creative strategist. Your job is to look at a winning ad and figure out which pain point it actually attacks, then surface 4–6 ADJACENT pain points the brand should test in variations.

A pain point is a specific problem the customer feels — "afternoon energy crash", "stubborn belly fat", "afraid of caffeine jitters". It is NOT an ad format ("testimonial", "claim_led"). Pain points describe what's WRONG in the customer's life that this product fixes.

Rules:
1. Identify which pain point the winning ad already attacks. Mark exactly ONE candidate with recommendation: "winner_hits". This is the baseline.
2. Surface 3–5 ADJACENT pain points the brand should test in variations. Mark these recommendation: "strong_test" (closest to the winner's audience) or "adjacent_test" (further-out, more speculative).
3. Total candidates: 4–6.
4. Each candidate: title (short, ${PAIN_POINT_TITLE_MAX} chars max), description (1–2 sentences explaining the pain in customer language, ${PAIN_POINT_DESCRIPTION_MAX} chars max), source ("${sourceMode}"), recommendation, rationale (one line on why this pain matters for THIS product and THIS winner).
5. Return ONLY valid JSON. No markdown, no code fences.

Output schema:
{
  "candidates": [
    { "title": "string", "description": "string", "source": "library" | "derived", "recommendation": "winner_hits" | "strong_test" | "adjacent_test", "rationale": "string" }
  ]
}`;

  const userPrompt = `Winning ad analysis for ONEST Health ${product}:

${analysis}

${productInfoContext ? `\nProduct context:\n${productInfoContext}` : ""}${libraryBlock}

Return the JSON object now.`;

  const callOnce = async (): Promise<PainPointCandidate[] | null> => {
    const res = await claudeClient.post("/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const content = res.data?.content;
    let raw = "";
    if (Array.isArray(content)) raw = content.map((c: any) => c.text || "").join("\n");
    else raw = content?.text || "";
    raw = stripMarkdownFences(raw);
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length >= 2) {
        return parsed.candidates.map((c: any) => ({
          title: String(c.title ?? "").slice(0, PAIN_POINT_TITLE_MAX),
          description: String(c.description ?? "").slice(0, PAIN_POINT_DESCRIPTION_MAX),
          source: c.source === "library" || c.source === "derived" ? c.source : sourceMode,
          recommendation: ["winner_hits", "strong_test", "adjacent_test"].includes(c.recommendation)
            ? c.recommendation
            : "adjacent_test",
          rationale: String(c.rationale ?? ""),
        }));
      }
    } catch {
      /* fall through to retry */
    }
    return null;
  };

  let candidates = await callOnce();
  if (!candidates) {
    console.warn(`[Iteration] reverseEngineerPainPoints: first call invalid, retrying`);
    candidates = await callOnce();
  }
  if (!candidates) {
    console.warn(`[Iteration] reverseEngineerPainPoints: both calls invalid, returning fallback skeleton`);
    return [
      {
        title: "Identify the winner's core pain",
        description: "Claude couldn't reverse-engineer pain points. Pick free-form pain points based on what the ad actually attacks.",
        source: sourceMode,
        recommendation: "winner_hits",
        rationale: "Fallback — manual pain-point selection required.",
      },
    ];
  }
  return candidates;
}

/**
 * Build the ad-angle instruction for the brief prompt (legacy fallback for runs
 * that don't go through Stage 1b). Three modes:
 * - per-variation: explicit list of angle-per-index, with "auto" slots
 *   meaning "you (Claude) pick this one"
 * - locked: every variation uses the same specific angle
 * - diversify: every variation gets a different angle (legacy "auto")
 */
function buildAdAngleInstruction(
  runAdAngle: import("../../shared/iterationBriefSchema").AdAngle,
  perVariationAngles: import("../../shared/iterationBriefSchema").AdAngle[] | undefined,
  variationCount: number,
): string {
  const definitions = `Definitions:
- claim_led: bold benefit promise hero. Big visible claim text. Product as supporting hero.
- before_after: transformation framing. Split-screen, time-lapse cues, or paired imagery.
- testimonial: first-person social proof. Quote-style headline. Real-feeling person on camera.
- ugc_organic: unpolished, real-user feel. Phone-camera aesthetic, natural lighting, candid framing.
- product_hero: product is the star. Clean composition, minimal supporting copy.
- lifestyle: scene/setting with a person using the product naturally.`;

  if (perVariationAngles && perVariationAngles.length > 0) {
    const trimmed = perVariationAngles.slice(0, variationCount);
    const allAuto = trimmed.every((a) => a === "auto");
    const allSame = trimmed.every((a) => a === trimmed[0]);
    if (allAuto) {
      // Same as legacy auto path — let Claude diversify.
      return `AD ANGLE — DIVERSIFY:
The user selected "Auto" for every variation. Pick a DIFFERENT adAngle for each variation from {claim_led, before_after, testimonial, ugc_organic, product_hero, lifestyle}. No two variations should share the same adAngle when the count allows it. Match each variation's headline + visualDescription + backgroundNote to its chosen adAngle.
${definitions}`;
    }
    if (allSame && trimmed[0] !== "auto") {
      return `AD ANGLE — LOCKED:
Set EVERY variation's adAngle to "${trimmed[0]}" and shape each variation's headline + visualDescription + backgroundNote to fit that angle.
${definitions}`;
    }
    const lines = trimmed
      .map((a, i) => {
        if (a === "auto") {
          return `- Variation ${i + 1}: AUTO — you choose, but pick something different from any locked angle in this list and from other AUTO slots.`;
        }
        return `- Variation ${i + 1}: ${a}`;
      })
      .join("\n");
    return `AD ANGLE — PER VARIATION:
The user picked specific angles for some variations. Set each variation's adAngle EXACTLY as listed below, and shape its headline + visualDescription + backgroundNote to fit. For "AUTO" slots, you pick the angle.
${lines}
${definitions}`;
  }

  if (runAdAngle === "auto") {
    return `AD ANGLE — DIVERSIFY:
The user selected "Auto" angle. Pick a DIFFERENT adAngle for each variation from {claim_led, before_after, testimonial, ugc_organic, product_hero, lifestyle}. No two variations should share the same adAngle when the variation count allows it. Match each variation's headline + visualDescription + backgroundNote to its chosen adAngle.
${definitions}`;
  }
  return `AD ANGLE — LOCKED:
The user selected "${runAdAngle}" angle. Set EVERY variation's adAngle to "${runAdAngle}" and shape each variation's headline + visualDescription + backgroundNote to fit that angle.
${definitions}`;
}

/**
 * Generate an iteration brief — N new copy angles that keep the visual DNA
 * but test different headlines, subheadlines, and visual descriptions.
 * Returns a valid v1 brief. Retries once on malformed JSON, then falls back
 * to a deterministic skeleton with qualityWarning=true.
 */
async function generateIterationBrief(
  analysis: string,
  product: string,
  productInfo: string,
  variationCount: number = 3,
  variationTypes?: string[],
  runAdAngle: import("../../shared/iterationBriefSchema").AdAngle = "auto",
  perVariationAngles?: import("../../shared/iterationBriefSchema").AdAngle[],
  selectedPainPoints?: SelectedPainPoint[],
): Promise<BriefGenerationResult> {
  const painPointInstruction = buildPainPointInstruction(selectedPainPoints);
  const adAngleInstruction = painPointInstruction
    ? "" // pain-point flow takes precedence; ad-format is no longer a user knob
    : buildAdAngleInstruction(runAdAngle, perVariationAngles, variationCount);
  const angleSection = painPointInstruction || adAngleInstruction;

  const system = `You are an elite DTC performance creative strategist. You specialise in iterating on winning ad creatives — keeping what works and testing new angles. You understand that the visual DNA (layout, colours, typography style, product placement) should be preserved while the COPY (headline, subheadline, angle) should be varied to find new winners.

${WINNING_AD_FRAMEWORK}

${angleSection}

IMPORTANT VISUAL RULE:
- The product name may contain words like "Hyperburn", "Thermosleep", "Thermoburn", or "Ignite". These are BRAND names, NOT visual instructions.
- Only include dramatic visual effects (fire, smoke, lightning, ice, explosions, glows) in visualDescription or backgroundNote if the REFERENCE AD'S ANALYSIS above explicitly describes them. If the reference is clean/minimal, keep the variations clean/minimal.
- Set referenceFxPresent to true ONLY if the analysis text clearly says the reference uses dramatic FX. Otherwise false.
- Populate detectedFxTypes only with FX types the analysis actually mentions. Empty array or ["none"] if the reference has none.

DO NOT BLEED PRODUCT DESIGN INTO visualDescription OR backgroundNote:
- visualDescription and backgroundNote describe SCENE elements: lighting, composition, characters, props, atmosphere, surfaces, environment. They do NOT describe the product's design.
- The product itself is rendered from a fixed product render image (Image 2) — its design is locked at runtime by that image, not your responsibility to describe.
- If the reference ad's analysis describes the COMPETITOR'S product design (their tub colour, label style, etc.), DO NOT echo that into visualDescription — the competitor's product is irrelevant; only their scene/composition/lighting matters.

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

Return JSON in this EXACT format with ${variationCount} variations. All fields required:
{
  "version": 1,
  "originalHeadline": "exact headline from the winning ad",
  "originalAngle": "description of the original ad's angle",
  "preserveElements": ["list of visual elements to keep exactly the same"],
  "targetAudience": "description of target audience",
  "referenceFxPresent": false,
  "detectedFxTypes": [],
  "variations": [
    {
      "number": 1,
      "variationType": "headline_only" | "background_only" | "layout_only" | "benefit_callouts_only" | "props_only" | "talent_swap" | "full_remix",
      "adAngle": "claim_led" | "before_after" | "testimonial" | "ugc_organic" | "product_hero" | "lifestyle",
      "angle": "Benefit-Driven",
      "angleDescription": "Why this angle works and what it tests",
      "headline": "NEW HEADLINE TEXT (3-8 words, all caps)",
      "subheadline": "Supporting subheadline (5-12 words)",
      "visualDescription": "3-4 concrete sentences describing composition, subject, lighting, props, background, typography. MAX ${VISUAL_DESCRIPTION_MAX} CHARACTERS. No dramatic FX unless reference has them.",
      "backgroundNote": "One-line specific instruction for background/layout/props based on variation type",
      "benefitCallouts": ["Benefit 1", "Benefit 2", "Benefit 3"]
    }
    ... (generate ${variationCount} total variations, distributed across selected types)
  ]
}

Set referenceFxPresent to true ONLY if the analysis clearly describes fire/smoke/lightning/ice/explosion/glow in the reference ad. Otherwise false.
Populate detectedFxTypes only with FX types the analysis mentions (fire, smoke, lightning, ice, explosion, glow). Use ["none"] or [] if the reference has no dramatic effects.
visualDescription MUST be ${VISUAL_DESCRIPTION_MAX} characters or fewer.`;

  async function callClaude(userContent: string): Promise<string> {
    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: userContent }],
    };
    const res = await claudeClient.post("/messages", body);
    const resContent = res.data?.content;
    const text = Array.isArray(resContent)
      ? resContent.map((c: any) => c.text || "").join("\n")
      : resContent?.text || JSON.stringify(resContent);
    return stripMarkdownFences(text);
  }

  const firstText = await callClaude(userPrompt);
  const firstValid = validateBriefJson(firstText);
  if (firstValid) {
    return { brief: JSON.stringify(firstValid), qualityWarning: false };
  }
  console.warn("[Iteration] Brief-gen first attempt invalid, retrying with stricter prompt");

  const retryPrompt = `${userPrompt}

Your previous response did not match the required schema. Common failures: missing "version": 1, missing referenceFxPresent/detectedFxTypes, missing visualDescription on one or more variations, visualDescription over ${VISUAL_DESCRIPTION_MAX} characters, invalid variationType value. Return STRICT JSON matching every field exactly as specified above. Every variation needs every field. Do not omit anything.`;

  let secondText = "";
  try {
    secondText = await callClaude(retryPrompt);
  } catch (err: any) {
    console.warn("[Iteration] Brief-gen retry call failed:", err?.message);
  }
  const secondValid = secondText ? validateBriefJson(secondText) : null;
  if (secondValid) {
    return { brief: JSON.stringify(secondValid), qualityWarning: false };
  }

  console.error("[Iteration] Brief-gen failed validation twice, using deterministic fallback");
  const fallback = buildFallbackBrief(variationCount, variationTypes, analysis);
  return { brief: JSON.stringify(fallback), qualityWarning: true };
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
  competitorBrand?: string,
  runAdAngle: import("../../shared/iterationBriefSchema").AdAngle = "auto",
  perVariationAngles?: import("../../shared/iterationBriefSchema").AdAngle[],
  selectedPainPoints?: SelectedPainPoint[],
  variationCountArg?: number,
): Promise<BriefGenerationResult> {
  const isConcept = adaptationMode === "concept";
  // variationCount source priority: explicit arg > selectedPainPoints length > perVariationAngles length > 3.
  // Caller (runIterationStage2) passes the run's variationCount so output count matches the rest of the pipeline.
  const variationCount =
    variationCountArg ?? selectedPainPoints?.length ?? perVariationAngles?.length ?? 3;
  const painPointInstruction = buildPainPointInstruction(selectedPainPoints);
  const adAngleInstruction = painPointInstruction
    ? ""
    : buildAdAngleInstruction(runAdAngle, perVariationAngles, variationCount);
  const angleSection = painPointInstruction || adAngleInstruction;
  const system = `You are an elite DTC creative strategist for ONEST Health. You are creating an iteration brief based on a COMPETITOR ad analysis (${competitorBrand || "another brand"}). ${isConcept ? "ADAPT the concept and angle for ONEST — use our own visual style and messaging." : "REPLICATE the visual style for ONEST — same layout, colours, typography; use ONEST product and ONEST copy only."}

${WINNING_AD_FRAMEWORK}

${angleSection}

IMPORTANT VISUAL RULE:
- The product name may contain words like "Hyperburn", "Thermosleep", "Thermoburn", or "Ignite". These are BRAND names, NOT visual instructions.
- Only include dramatic visual effects (fire, smoke, lightning, ice, explosions, glows) in visualDescription/backgroundNote if the competitor analysis above explicitly describes them.
- Set referenceFxPresent to true ONLY if the analysis clearly describes FX in the reference.

DO NOT BLEED PRODUCT DESIGN INTO visualDescription OR backgroundNote:
- visualDescription/backgroundNote describe SCENE elements only: lighting, composition, characters, props, atmosphere, surfaces, environment.
- The ONEST product is rendered from a fixed product render image (Image 2) — its design is locked at runtime by that image, not your responsibility to describe.
- The COMPETITOR'S product design (their tub colour, packaging shape, label style) is IRRELEVANT — DO NOT echo it into visualDescription. Only the competitor's scene, composition, and lighting matter.

Return ONLY valid JSON. No markdown, no code blocks.`;

  // variationCount is now resolved from the function args at the top.

  const userPrompt = `Based on this analysis of a COMPETITOR ad (${competitorBrand || "other brand"}):

${analysis}

${productInfo ? `\nONEST Product Information for ${product}:\n${productInfo}` : ""}

Generate an iteration brief with ${variationCount} variations for ONEST Health's ${product}.
${isConcept ? "Each variation should ADAPT the competitor's concept/angle for ONEST — our visual style, our messaging, our product." : "Each variation should REPLICATE the competitor's visual style (layout, colours, typography, mood) but with ONEST product and ONEST-only copy."}

Return JSON in this EXACT format:
{
  "version": 1,
  "originalHeadline": "headline or concept from competitor ad",
  "originalAngle": "description of competitor's angle",
  "preserveElements": ["elements we are preserving or adapting"],
  "targetAudience": "target audience",
  "referenceFxPresent": false,
  "detectedFxTypes": [],
  "variations": [
    {
      "number": 1,
      "variationType": "full_remix",
      "adAngle": "claim_led" | "before_after" | "testimonial" | "ugc_organic" | "product_hero" | "lifestyle",
      "angle": "Angle name",
      "angleDescription": "Why this angle",
      "headline": "ONEST HEADLINE (3-8 words, all caps)",
      "subheadline": "Supporting subheadline",
      "visualDescription": "3-4 concrete sentences on composition, subject, lighting, props, background. MAX ${VISUAL_DESCRIPTION_MAX} characters.",
      "backgroundNote": "One-line background/style note",
      "benefitCallouts": ["Benefit 1", "Benefit 2"]
    },
    { "number": 2, ... },
    { "number": 3, ... }
  ]
}

visualDescription MUST be ${VISUAL_DESCRIPTION_MAX} characters or fewer. Every variation needs every field.`;

  async function callClaude(userContent: string): Promise<string> {
    const res = await claudeClient.post("/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    const resContent = res.data?.content;
    const text = Array.isArray(resContent)
      ? resContent.map((c: any) => c.text || "").join("\n")
      : resContent?.text || JSON.stringify(resContent);
    return stripMarkdownFences(text);
  }

  const firstText = await callClaude(userPrompt);
  const firstValid = validateBriefJson(firstText);
  if (firstValid) return { brief: JSON.stringify(firstValid), qualityWarning: false };

  console.warn("[Iteration] Competitor brief-gen first attempt invalid, retrying");
  const retryPrompt = `${userPrompt}

Your previous response did not match the schema. Return strict JSON with every field present, visualDescription under ${VISUAL_DESCRIPTION_MAX} chars, and version: 1.`;
  let secondText = "";
  try {
    secondText = await callClaude(retryPrompt);
  } catch (err: any) {
    console.warn("[Iteration] Competitor brief-gen retry failed:", err?.message);
  }
  const secondValid = secondText ? validateBriefJson(secondText) : null;
  if (secondValid) return { brief: JSON.stringify(secondValid), qualityWarning: false };

  console.error("[Iteration] Competitor brief-gen failed twice, using fallback");
  const fallback = buildFallbackBrief(variationCount, undefined, analysis);
  return { brief: JSON.stringify(fallback), qualityWarning: true };
}

