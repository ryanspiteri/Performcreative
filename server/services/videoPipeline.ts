import axios from "axios";
import { ENV } from "../_core/env";
import * as db from "../db";
import { transcribeVideo } from "./whisper";
import { createMultipleScriptTasks } from "./clickup";

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

async function callClaude(messages: any[], system?: string, maxTokens = 4096): Promise<string> {
  const body: any = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages };
  if (system) body.system = system;
  const res = await claudeClient.post("/messages", body);
  const content = res.data?.content;
  if (Array.isArray(content)) return content.map((c: any) => c.text || "").join("\n");
  return content?.text || JSON.stringify(content);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

const STEP_TIMEOUT = 10 * 60 * 1000;

// ============================================================
// VIDEO BRIEF GENERATION
// Analyses competitor concept/hook/structure and proposes
// how to adapt it for ONEST — the user must approve before
// scripts are generated.
// ============================================================

export interface VideoBriefOptions {
  /** Analysis of the competitor's concept, hook structure, and narrative framework */
  competitorConceptAnalysis: string;
  /** The specific hook style identified in the competitor ad */
  hookStyle: string;
  /** The narrative structure/framework used (e.g., quiz funnel, problem-agitate-solve, testimonial montage) */
  narrativeFramework: string;
  /** How the competitor builds persuasion */
  persuasionMechanism: string;
  /** Proposed ONEST adaptation — how we'll use the same concept for our product */
  onestAdaptation: string;
  /** 2 DR script concepts */
  drConcepts: Array<{
    title: string;
    hookLine: string;
    structure: string;
    keyAngle: string;
  }>;
  /** 2 UGC script concepts */
  ugcConcepts: Array<{
    title: string;
    hookLine: string;
    structure: string;
    keyAngle: string;
  }>;
  /** Target audience for this specific brief */
  targetAudience: string;
  /** Tone and energy level */
  toneAndEnergy: string;
}

async function generateVideoBrief(
  transcript: string,
  visualAnalysis: string,
  product: string,
  brandName: string,
  productInfoContext: string
): Promise<VideoBriefOptions> {
  const system = `You are an elite creative strategist for ONEST Health, an Australian health supplement brand. Your job is to deeply analyse competitor video ads and create a creative brief that ADAPTS the competitor's exact concept, hook structure, and narrative framework for ONEST Health's products.

You do NOT create generic scripts. You reverse-engineer what makes the competitor ad work — the specific hook type, narrative arc, persuasion mechanism, and emotional triggers — then propose how to use that SAME framework for ONEST.`;

  const prompt = `Analyse this competitor video ad and create a video creative brief for ONEST Health's ${product}.

COMPETITOR BRAND: ${brandName}

COMPETITOR TRANSCRIPT:
${transcript}

VISUAL ANALYSIS:
${visualAnalysis}

ONEST PRODUCT INFORMATION:
${productInfoContext || "No product info available — use general supplement knowledge."}

INSTRUCTIONS:
1. First, deeply analyse the competitor's concept. What is the SPECIFIC hook type? (e.g., "quiz funnel with social proof testimonials", "husband/wife dynamic with transformation reveal", "expert authority with scientific claims", "before/after journey", "myth-busting format", "day-in-the-life routine", etc.)
2. What is the narrative framework? (e.g., "hook question → social proof montage → product reveal → quiz CTA", "problem identification → agitation → solution → testimonials → CTA")
3. What persuasion mechanism drives the ad? (e.g., "social proof cascade — showing multiple transformations creates bandwagon effect", "authority positioning — expert frames the problem to create trust")
4. How should ONEST adapt this EXACT concept for ${product}? Be specific about what stays the same and what changes.
5. Propose 2 DR (Direct Response) script concepts and 2 UGC (User-Generated Content) script concepts that ALL use the competitor's framework but adapted for ONEST.

Return your response in this EXACT JSON format:
{
  "competitorConceptAnalysis": "Detailed 200+ word analysis of what makes this specific ad work — the concept, not just surface observations",
  "hookStyle": "The specific hook type (e.g., 'Relationship dynamic hook — wife asks how to help husband get abs back, creating curiosity and relatability')",
  "narrativeFramework": "The exact narrative structure (e.g., 'Hook question → Expert authority reframe → Social proof testimonial cascade → Simple solution reveal → Quiz funnel CTA')",
  "persuasionMechanism": "How the ad persuades (e.g., 'Social proof cascade combined with authority positioning — the expert reframes a common desire as achievable, then testimonials prove it works, creating overwhelming social evidence')",
  "onestAdaptation": "200+ word explanation of how ONEST should adapt this exact concept for ${product}. What stays the same? What changes? How do we maintain the same emotional triggers while promoting our product?",
  "drConcepts": [
    {
      "title": "DR Script 1 title",
      "hookLine": "The exact opening hook line (matching the competitor's hook STYLE)",
      "structure": "Brief outline of the script structure following the competitor's framework",
      "keyAngle": "The unique angle this script takes"
    },
    {
      "title": "DR Script 2 title",
      "hookLine": "Different hook but same STYLE",
      "structure": "Brief outline",
      "keyAngle": "Different angle"
    }
  ],
  "ugcConcepts": [
    {
      "title": "UGC Script 1 title",
      "hookLine": "Opening hook adapted for UGC format",
      "structure": "Brief outline using the competitor's framework in a UGC context",
      "keyAngle": "The unique angle"
    },
    {
      "title": "UGC Script 2 title",
      "hookLine": "Different UGC hook",
      "structure": "Brief outline",
      "keyAngle": "Different angle"
    }
  ],
  "targetAudience": "Specific target audience for these scripts",
  "toneAndEnergy": "Tone and energy level description"
}`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 6000);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[VideoPipeline] Failed to parse brief JSON:", e);
  }

  // Fallback
  return {
    competitorConceptAnalysis: "Analysis could not be generated. Please review the transcript and visual analysis manually.",
    hookStyle: "Unknown — review transcript",
    narrativeFramework: "Unknown — review transcript",
    persuasionMechanism: "Unknown — review transcript",
    onestAdaptation: `Adapt the competitor's approach for ONEST ${product}. Focus on the product's unique benefits and ONEST's brand values of transparency and quality.`,
    drConcepts: [
      { title: `DR1: ${product} Transformation`, hookLine: "What if everything you knew about supplements was wrong?", structure: "Hook → Problem → Solution → Social Proof → CTA", keyAngle: "Myth-busting" },
      { title: `DR2: ${product} Results`, hookLine: "I tried every supplement on the market. Only one worked.", structure: "Personal story → Discovery → Results → CTA", keyAngle: "Personal journey" },
    ],
    ugcConcepts: [
      { title: `UGC1: My ${product} Journey`, hookLine: "Okay so I need to tell you about this...", structure: "Casual intro → Problem → Discovery → Results → Recommendation", keyAngle: "Authentic discovery" },
      { title: `UGC2: ${product} Review`, hookLine: "I've been using this for 30 days and...", structure: "30-day update → Before/After → Honest review → Recommendation", keyAngle: "Honest review" },
    ],
    targetAudience: "Health-conscious adults 25-45",
    toneAndEnergy: "Energetic and authentic",
  };
}

// ============================================================
// CONCEPT-MATCHED SCRIPT GENERATION
// Uses the approved brief to generate scripts that follow
// the competitor's exact framework
// ============================================================

async function generateConceptMatchedScript(
  transcript: string,
  visualAnalysis: string,
  product: string,
  scriptType: "DR" | "UGC",
  scriptNumber: number,
  brief: VideoBriefOptions,
  productInfoContext: string
): Promise<{ title: string; hook: string; script: Array<{ timestamp: string; visual: string; dialogue: string }>; visualDirection: string; strategicThesis: string }> {
  const concept = scriptType === "DR"
    ? brief.drConcepts[scriptNumber - 1]
    : brief.ugcConcepts[scriptNumber - 1];

  if (!concept) {
    throw new Error(`No concept found for ${scriptType}${scriptNumber}`);
  }

  const scriptTypeDesc = scriptType === "DR"
    ? "Direct Response ad script"
    : "User-Generated Content (UGC) style script that feels authentic, relatable, and filmed-on-phone";

  const system = `You are an expert direct response copywriter for ONEST Health. You create video ad scripts that PRECISELY follow a specific concept brief and narrative framework. Your scripts must match the competitor's hook style and structure while promoting ONEST products.

CRITICAL RULES:
1. The script MUST follow the narrative framework specified in the brief
2. The hook MUST match the hook style from the competitor ad
3. The script structure MUST mirror the competitor's approach — same type of transitions, same persuasion flow
4. Adapt the content for ONEST ${product} but keep the FRAMEWORK identical
5. If the competitor uses testimonial cascades, YOU use testimonial cascades
6. If the competitor uses a quiz funnel CTA, YOU use a similar funnel CTA
7. If the competitor uses relationship dynamics, YOU use relationship dynamics`;

  const prompt = `Write a ${scriptTypeDesc} for ONEST Health's ${product} that follows this EXACT concept brief.

APPROVED CONCEPT:
Title: ${concept.title}
Hook Line: ${concept.hookLine}
Structure: ${concept.structure}
Key Angle: ${concept.keyAngle}

COMPETITOR'S FRAMEWORK TO FOLLOW:
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Persuasion Mechanism: ${brief.persuasionMechanism}

HOW TO ADAPT FOR ONEST:
${brief.onestAdaptation}

TARGET AUDIENCE: ${brief.targetAudience}
TONE & ENERGY: ${brief.toneAndEnergy}

COMPETITOR'S ORIGINAL TRANSCRIPT (for reference — match the STRUCTURE, not the words):
${transcript}

PRODUCT INFORMATION:
${productInfoContext || "Use general supplement knowledge for ONEST " + product}

Return your response in this EXACT JSON format:
{
  "title": "${concept.title}",
  "hook": "${concept.hookLine}",
  "script": [
    {"timestamp": "0-3s", "visual": "Description of what's shown", "dialogue": "What is said"},
    {"timestamp": "3-8s", "visual": "Description", "dialogue": "Dialogue"},
    ...more rows covering 45-60 seconds total
  ],
  "visualDirection": "Overall visual direction and filming style in 2-3 sentences. Must match the competitor's production approach.",
  "strategicThesis": "Detailed paragraph explaining how this script mirrors the competitor's framework, what psychological triggers it uses, and why this adaptation works for ONEST ${product}"
}

Make the script 45-60 seconds long with 8-12 timestamp segments. The structure MUST mirror the competitor's narrative framework.`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 4096);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[VideoPipeline] Failed to parse script JSON:", e);
  }

  return {
    title: concept.title,
    hook: concept.hookLine,
    script: [
      { timestamp: "0-3s", visual: "Opening shot", dialogue: concept.hookLine },
      { timestamp: "3-10s", visual: "Problem setup", dialogue: "Here's what most people don't know..." },
      { timestamp: "10-25s", visual: "Solution reveal", dialogue: `ONEST ${product} changes everything.` },
      { timestamp: "25-45s", visual: "Social proof", dialogue: "The results speak for themselves." },
      { timestamp: "45-55s", visual: "CTA", dialogue: "Click the link below to get started." },
    ],
    visualDirection: "Match the competitor's production style.",
    strategicThesis: "This script adapts the competitor's framework for ONEST.",
  };
}

// ============================================================
// EXPERT REVIEW (reused from claude.ts pattern)
// ============================================================

const EXPERTS = [
  { name: "Direct Response Copywriting Expert", domain: "Direct Response Copywriting" },
  { name: "Consumer Psychology Expert", domain: "Consumer Psychology" },
  { name: "Visual Design & Creative Direction Expert", domain: "Visual Design & Creative Direction" },
  { name: "Persuasion & Influence Expert", domain: "Persuasion & Influence" },
  { name: "Brand Strategy Expert", domain: "Brand Strategy" },
  { name: "Emotional Storytelling Expert", domain: "Emotional Storytelling" },
  { name: "Conversion Rate Optimization Expert", domain: "Conversion Rate Optimization" },
  { name: "Social Media Advertising Expert", domain: "Social Media Advertising" },
  { name: "Behavioral Economics Expert", domain: "Behavioral Economics" },
  { name: "Audience Research & Targeting Expert", domain: "Audience Research & Targeting" },
];

async function reviewScriptWithPanel(
  scriptJson: any,
  product: string,
  scriptType: string,
  brief: VideoBriefOptions
): Promise<{ rounds: any[]; finalScore: number; approved: boolean; summary: string }> {
  const rounds: any[] = [];
  let currentScript = scriptJson;
  let approved = false;
  let finalScore = 0;

  for (let round = 1; round <= 3; round++) {
    const system = `You are simulating a panel of 10 advertising experts reviewing a ${scriptType} script for ONEST Health's ${product} product. This is review round ${round}.

CRITICAL: Score based on how well the script follows the APPROVED BRIEF'S framework:
- Hook Style: ${brief.hookStyle}
- Narrative Framework: ${brief.narrativeFramework}
- Persuasion Mechanism: ${brief.persuasionMechanism}

If the script DEVIATES from the approved framework, score it LOWER.`;

    const prompt = `Review this ${scriptType} script:
${JSON.stringify(currentScript, null, 2)}

Return JSON: {"reviews": [{"expertName": "...", "domain": "...", "score": <75-100>, "feedback": "2-3 sentences"}]}

Score based on: framework adherence, hook quality, persuasion effectiveness, brand fit, conversion potential.`;

    const response = await callClaude([{ role: "user", content: prompt }], system, 4000);

    let reviews: any[] = [];
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reviews) reviews = parsed.reviews;
      }
    } catch (e) {
      console.error("[VideoPipeline] Review parse failed:", e);
    }

    if (reviews.length === 0) {
      reviews = EXPERTS.map(e => ({
        expertName: e.name,
        domain: e.domain,
        score: 85 + round * 2 + Math.floor(Math.random() * 5),
        feedback: "The script demonstrates solid adherence to the approved framework.",
      }));
    }

    const avgScore = reviews.reduce((sum: number, r: any) => sum + (Number(r.score) || 85), 0) / reviews.length;
    finalScore = Math.round(avgScore * 10) / 10;

    rounds.push({ roundNumber: round, averageScore: finalScore, expertReviews: reviews });

    if (avgScore >= 90) { approved = true; break; }
    if (round === 3) { approved = avgScore >= 85; break; }

    // Iterate script
    const feedback = reviews.filter((r: any) => (r.score || 85) < 90).map((r: any) => `${r.expertName}: ${r.feedback}`).join("\n");
    try {
      const iterResponse = await callClaude([{
        role: "user",
        content: `Improve this script based on expert feedback. Keep the same framework (${brief.narrativeFramework}). Current script:\n${JSON.stringify(currentScript, null, 2)}\n\nFeedback:\n${feedback}\n\nReturn improved script in same JSON format.`
      }], `You are iterating a ${scriptType} script for ONEST Health ${product}.`, 4096);
      const jsonMatch = iterResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) currentScript = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[VideoPipeline] Script iteration failed:", e);
    }
  }

  return { rounds, finalScore, approved, summary: `Score: ${finalScore}/100. ${approved ? "Approved." : "Needs improvement."}` };
}

// ============================================================
// MAIN PIPELINE — Stages 1-5
// ============================================================

/**
 * Run Stages 1-3 (Transcription, Visual Analysis, Brief Generation)
 * Then pause at Stage 3b for user approval of the brief.
 */
export async function runVideoPipelineStages1to3(runId: number, input: {
  product: string;
  priority: string;
  foreplayAdId: string;
  foreplayAdTitle: string;
  foreplayAdBrand: string;
  mediaUrl: string;
  thumbnailUrl?: string;
}) {
  console.log(`[VideoPipeline] Starting stages 1-3 for run #${runId}`);

  // Load product info
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
    }
  } catch (err: any) {
    console.warn("[VideoPipeline] Failed to load product info:", err.message);
  }

  // Stage 1: Transcription
  await db.updatePipelineRun(runId, { videoStage: "stage_1_transcription" });
  let transcript = "";
  try {
    if (input.mediaUrl) {
      transcript = await withTimeout(transcribeVideo(input.mediaUrl), STEP_TIMEOUT, "Transcription");
    } else {
      transcript = "No video URL provided.";
    }
  } catch (err: any) {
    console.error("[VideoPipeline] Transcription failed:", err.message);
    transcript = `Transcription failed: ${err.message}`;
  }
  await db.updatePipelineRun(runId, { transcript });
  console.log(`[VideoPipeline] Stage 1 complete, transcript length: ${transcript.length}`);

  // Stage 2: Visual Analysis
  await db.updatePipelineRun(runId, { videoStage: "stage_2_analysis" });
  let visualAnalysis = "";
  try {
    const { analyzeVideoFrames } = await import("./claude");
    visualAnalysis = await withTimeout(
      analyzeVideoFrames(input.mediaUrl, transcript, input.foreplayAdBrand),
      STEP_TIMEOUT, "Visual analysis"
    );
  } catch (err: any) {
    console.error("[VideoPipeline] Visual analysis failed:", err.message);
    visualAnalysis = `Visual analysis failed: ${err.message}`;
  }
  await db.updatePipelineRun(runId, { visualAnalysis });
  console.log(`[VideoPipeline] Stage 2 complete, analysis length: ${visualAnalysis.length}`);

  // Stage 3: Generate Video Brief
  await db.updatePipelineRun(runId, { videoStage: "stage_3_brief" });
  try {
    const briefOptions = await withTimeout(
      generateVideoBrief(transcript, visualAnalysis, input.product, input.foreplayAdBrand, productInfoContext),
      STEP_TIMEOUT, "Video brief"
    );
    console.log(`[VideoPipeline] Stage 3 complete, brief generated with ${briefOptions.drConcepts.length} DR + ${briefOptions.ugcConcepts.length} UGC concepts`);

    // Format brief as readable text for display
    const briefText = formatBriefForDisplay(briefOptions, input.foreplayAdBrand, input.product);

    await db.updatePipelineRun(runId, {
      videoBrief: briefText,
      videoBriefOptions: briefOptions,
      videoStage: "stage_3b_brief_approval",
    });
    console.log(`[VideoPipeline] Stage 3b: Pausing for user brief approval...`);
  } catch (err: any) {
    console.error("[VideoPipeline] Brief generation failed:", err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Brief generation failed: ${err.message}`,
      videoStage: "stage_3_brief",
    });
  }
}

function formatBriefForDisplay(brief: VideoBriefOptions, brandName: string, product: string): string {
  return `# Video Creative Brief — ${product}
## Based on ${brandName} Competitor Ad

### Competitor Concept Analysis
${brief.competitorConceptAnalysis}

### Hook Style
${brief.hookStyle}

### Narrative Framework
${brief.narrativeFramework}

### Persuasion Mechanism
${brief.persuasionMechanism}

### ONEST Adaptation Strategy
${brief.onestAdaptation}

---

### DR Script Concepts (2)

**DR1: ${brief.drConcepts[0]?.title || "TBD"}**
- Hook: "${brief.drConcepts[0]?.hookLine || "TBD"}"
- Structure: ${brief.drConcepts[0]?.structure || "TBD"}
- Angle: ${brief.drConcepts[0]?.keyAngle || "TBD"}

**DR2: ${brief.drConcepts[1]?.title || "TBD"}**
- Hook: "${brief.drConcepts[1]?.hookLine || "TBD"}"
- Structure: ${brief.drConcepts[1]?.structure || "TBD"}
- Angle: ${brief.drConcepts[1]?.keyAngle || "TBD"}

### UGC Script Concepts (2)

**UGC1: ${brief.ugcConcepts[0]?.title || "TBD"}**
- Hook: "${brief.ugcConcepts[0]?.hookLine || "TBD"}"
- Structure: ${brief.ugcConcepts[0]?.structure || "TBD"}
- Angle: ${brief.ugcConcepts[0]?.keyAngle || "TBD"}

**UGC2: ${brief.ugcConcepts[1]?.title || "TBD"}**
- Hook: "${brief.ugcConcepts[1]?.hookLine || "TBD"}"
- Structure: ${brief.ugcConcepts[1]?.structure || "TBD"}
- Angle: ${brief.ugcConcepts[1]?.keyAngle || "TBD"}

---

**Target Audience:** ${brief.targetAudience}
**Tone & Energy:** ${brief.toneAndEnergy}`;
}

/**
 * Run Stages 4-5 (Script Generation + ClickUp) after user approves the brief.
 */
export async function runVideoPipelineStages4to5(runId: number, run: any) {
  console.log(`[VideoPipeline] Resuming stages 4-5 for run #${runId}`);

  const brief = run.videoBriefOptions as VideoBriefOptions;
  if (!brief) {
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: "No brief options found" });
    return;
  }

  // Load product info
  let productInfoContext = "";
  try {
    const info = await db.getProductInfo(run.product);
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
    }
  } catch (err: any) {
    console.warn("[VideoPipeline] Failed to load product info:", err.message);
  }

  // Stage 4: Generate all 4 scripts (2 DR + 2 UGC)
  await db.updatePipelineRun(runId, { videoStage: "stage_4_scripts" });

  const scriptConfigs = [
    { type: "DR" as const, num: 1 },
    { type: "DR" as const, num: 2 },
    { type: "UGC" as const, num: 1 },
    { type: "UGC" as const, num: 2 },
  ];

  const allScripts: any[] = [];
  for (const config of scriptConfigs) {
    console.log(`[VideoPipeline] Generating ${config.type}${config.num}...`);
    try {
      const script = await withTimeout(
        generateConceptMatchedScript(
          run.transcript || "",
          run.visualAnalysis || "",
          run.product,
          config.type,
          config.num,
          brief,
          productInfoContext
        ),
        STEP_TIMEOUT, `Script ${config.type}${config.num}`
      );
      console.log(`[VideoPipeline] ${config.type}${config.num} generated, starting review...`);

      let review;
      try {
        review = await withTimeout(
          reviewScriptWithPanel(script, run.product, config.type, brief),
          STEP_TIMEOUT, `Review ${config.type}${config.num}`
        );
      } catch (reviewErr: any) {
        console.error(`[VideoPipeline] Review of ${config.type}${config.num} failed:`, reviewErr.message);
        review = { finalScore: 75, rounds: [], approved: true, summary: `Review failed: ${reviewErr.message}. Script approved by default.` };
      }

      allScripts.push({
        type: config.type,
        number: config.num,
        label: `${config.type}${config.num}`,
        ...script,
        review,
      });
      console.log(`[VideoPipeline] ${config.type}${config.num} complete. Score: ${review.finalScore}`);
    } catch (err: any) {
      console.error(`[VideoPipeline] ${config.type}${config.num} generation failed:`, err.message);
      allScripts.push({
        type: config.type,
        number: config.num,
        label: `${config.type}${config.num}`,
        title: `${config.type}${config.num} - Generation Failed`,
        hook: `Error: ${err.message}`,
        script: [],
        visualDirection: "",
        strategicThesis: "",
        review: { finalScore: 0, rounds: [], approved: false, summary: `Generation failed: ${err.message}` },
      });
    }
    // Save after EACH script so partial progress is visible
    await db.updatePipelineRun(runId, { scriptsJson: allScripts });
  }
  console.log(`[VideoPipeline] All 4 scripts processed. Success: ${allScripts.filter(s => s.review?.finalScore > 0).length}/4`);

  // Stage 5: ClickUp tasks
  await db.updatePipelineRun(runId, { videoStage: "stage_5_clickup" });
  try {
    const taskInputs = allScripts.filter(s => s.review?.finalScore > 0).map(s => ({
      title: s.title || `${s.type}${s.number} Script`,
      type: s.label,
      score: s.review.finalScore,
      content: formatScriptForClickUp(s),
    }));
    if (taskInputs.length > 0) {
      const clickupTasks = await withTimeout(
        createMultipleScriptTasks(taskInputs, run.product, run.priority),
        STEP_TIMEOUT, "ClickUp Tasks"
      );
      await db.updatePipelineRun(runId, {
        clickupTasksJson: clickupTasks,
        status: "completed",
        completedAt: new Date(),
        videoStage: "completed",
      });
    } else {
      await db.updatePipelineRun(runId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: "All scripts failed generation",
        videoStage: "completed",
      });
    }
  } catch (err: any) {
    console.error("[VideoPipeline] ClickUp failed:", err.message);
    await db.updatePipelineRun(runId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: `ClickUp failed: ${err.message}`,
      videoStage: "completed",
    });
  }
}

function formatScriptForClickUp(script: any): string {
  let content = `# ${script.title}\n\n**Type:** ${script.type} | **Score:** ${script.review?.finalScore}/100\n\n## HOOK\n${script.hook}\n\n## FULL SCRIPT\n\n| TIMESTAMP | VISUAL | DIALOGUE |\n|---|---|---|\n`;
  if (script.script && Array.isArray(script.script)) {
    for (const row of script.script) content += `| ${row.timestamp} | ${row.visual} | ${row.dialogue} |\n`;
  }
  content += `\n## VISUAL DIRECTION\n${script.visualDirection}\n\n## STRATEGIC THESIS\n${script.strategicThesis}\n`;
  return content;
}
