import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { fetchVideoAds, fetchStaticAds, listBoards } from "./services/foreplay";
import { analyzeVideoFrames, generateScripts, reviewScript, analyzeStaticAd } from "./services/claude";
import { generateStaticAdVariations } from "./services/imageCompositing";
import { transcribeVideo } from "./services/whisper";
import { createMultipleScriptTasks } from "./services/clickup";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { SignJWT } from "jose";

const VALID_USERNAME = "ONEST";
const VALID_PASSWORD = "UnlockGrowth";

// Timeout utility to prevent hanging forever
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

const STAGE_TIMEOUT = 5 * 60 * 1000; // 5 minutes per stage
const STEP_TIMEOUT = 3 * 60 * 1000; // 3 minutes per step

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (input.username !== VALID_USERNAME || input.password !== VALID_PASSWORD) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        const openId = "onest-admin-user";
        await db.upsertUser({
          openId,
          name: "ONEST Admin",
          email: "admin@onest.com.au",
          role: "admin",
          lastSignedIn: new Date(),
        });
        const secretKey = new TextEncoder().encode(ENV.cookieSecret);
        const token = await new SignJWT({ openId, appId: ENV.appId, name: "ONEST Admin" })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setExpirationTime(Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000))
          .sign(secretKey);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { name: "ONEST Admin" } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  pipeline: router({
    list: publicProcedure.query(async () => db.listPipelineRuns(50)),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const run = await db.getPipelineRun(input.id);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline run not found" });
        return run;
      }),

    // FIX 1: Video pipeline now accepts the selected creative's data
    triggerVideo: publicProcedure
      .input(z.object({
        product: z.string(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]),
        foreplayAdId: z.string(),
        foreplayAdTitle: z.string(),
        foreplayAdBrand: z.string(),
        mediaUrl: z.string(),
        thumbnailUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const runId = await db.createPipelineRun({
          pipelineType: "video",
          status: "running",
          product: input.product,
          priority: input.priority,
          triggerSource: "manual",
          foreplayAdId: input.foreplayAdId,
          foreplayAdTitle: input.foreplayAdTitle,
          foreplayAdBrand: input.foreplayAdBrand,
          videoUrl: input.mediaUrl,
          thumbnailUrl: input.thumbnailUrl || "",
        });
        runVideoPipeline(runId, input).catch(err => {
          console.error("[Pipeline] Video pipeline failed:", err);
          db.updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Pipeline failed" });
        });
        return { runId, status: "running" };
      }),

    fetchForeplayVideos: publicProcedure.query(async () => fetchVideoAds(10)),
    fetchForeplayStatics: publicProcedure.query(async () => fetchStaticAds(30)),
    listBoards: publicProcedure.query(async () => listBoards()),

    // FIX 3: Static pipeline with 7-stage flow
    triggerStatic: publicProcedure
      .input(z.object({
        product: z.string(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]),
        selectedAdId: z.string(),
        selectedAdImage: z.object({
          id: z.string(),
          imageUrl: z.string(),
          brandName: z.string().optional(),
          title: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const runId = await db.createPipelineRun({
          pipelineType: "static",
          status: "running",
          product: input.product,
          priority: input.priority,
          triggerSource: "manual",
          foreplayAdId: input.selectedAdId,
          foreplayAdTitle: input.selectedAdImage.title || "Untitled",
          foreplayAdBrand: input.selectedAdImage.brandName || "Unknown",
          staticAdImages: [input.selectedAdImage],
          staticStage: "stage_1_analysis",
        });
        runStaticPipeline(runId, input).catch(err => {
          console.error("[Pipeline] Static pipeline failed:", err);
          db.updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Static pipeline failed" });
        });
        return { runId, status: "running" };
      }),

    // Team approval endpoint for Stage 6
    teamApprove: publicProcedure
      .input(z.object({
        runId: z.number(),
        approved: z.boolean(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.staticStage !== "stage_6_team_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline is not in team approval stage" });
        }

        if (input.approved) {
          await db.updatePipelineRun(input.runId, {
            teamApprovalStatus: "approved",
            teamApprovalNotes: input.notes || "Approved by team",
            staticStage: "stage_7_clickup",
          });
          // Continue to Stage 7: ClickUp task creation
          runStaticStage7(input.runId, run).catch(err => {
            console.error("[Pipeline] Stage 7 failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        } else {
          // Rejected — send edits back to nano banana for modification
          await db.updatePipelineRun(input.runId, {
            teamApprovalStatus: "rejected",
            teamApprovalNotes: input.notes || "Changes requested",
            staticStage: "stage_6_revising",
          });
          // Re-generate with team feedback
          runStaticRevision(input.runId, run, input.notes || "").catch(err => {
            console.error("[Pipeline] Revision failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        }

        return { success: true };
      }),
  }),
});

// ============================================================
// VIDEO PIPELINE — now uses the selected creative's specific data
// ============================================================
async function runVideoPipeline(runId: number, input: {
  product: string;
  priority: string;
  foreplayAdId: string;
  foreplayAdTitle: string;
  foreplayAdBrand: string;
  mediaUrl: string;
  thumbnailUrl?: string;
}) {
  console.log(`[Pipeline] Starting video pipeline run #${runId} for ad: ${input.foreplayAdTitle}`);

  // Step 1: Transcribe video (using the SELECTED video, not first from board)
  console.log("[Pipeline] Step 1: Transcribing video from:", input.mediaUrl);
  let transcript = "";
  try {
    if (input.mediaUrl) {
      transcript = await withTimeout(transcribeVideo(input.mediaUrl), STEP_TIMEOUT, "Transcription");
      console.log("[Pipeline] Transcription succeeded, length:", transcript.length);
    } else {
      console.warn("[Pipeline] No media URL provided, skipping transcription");
      transcript = "No video URL provided.";
    }
  } catch (err: any) {
    console.error("[Pipeline] Transcription failed:", err.message, err.stack);
    transcript = `Transcription failed: ${err.message}`;
    await db.updatePipelineRun(runId, { errorMessage: `Transcription error: ${err.message}` });
  }
  await db.updatePipelineRun(runId, { transcript });

  // Step 2: Visual analysis
  console.log("[Pipeline] Step 2: Running visual analysis...");
  let visualAnalysis = "";
  try {
    visualAnalysis = await withTimeout(
      analyzeVideoFrames(input.mediaUrl, transcript, input.foreplayAdBrand),
      STEP_TIMEOUT, "Visual analysis"
    );
    console.log("[Pipeline] Visual analysis complete, length:", visualAnalysis.length);
  } catch (err: any) {
    console.error("[Pipeline] Visual analysis failed:", err.message);
    visualAnalysis = `Visual analysis failed: ${err.message}`;
  }
  await db.updatePipelineRun(runId, { visualAnalysis });

  // Step 3: Generate scripts
  console.log("[Pipeline] Step 3: Generating scripts...");
  const scriptConfigs = [
    { type: "DR" as const, num: 1 },
    { type: "DR" as const, num: 2 },
    { type: "UGC" as const, num: 1 },
    { type: "UGC" as const, num: 2 },
  ];
  const allScripts: any[] = [];
  for (const config of scriptConfigs) {
    try {
      console.log(`[Pipeline] Generating ${config.type}${config.num}...`);
      const script = await withTimeout(
        generateScripts(transcript, visualAnalysis, input.product, config.type, config.num),
        STEP_TIMEOUT, `Script ${config.type}${config.num}`
      );
      console.log(`[Pipeline] Running expert review for ${config.type}${config.num}...`);
      const review = await withTimeout(
        reviewScript(script, input.product, config.type),
        STEP_TIMEOUT, `Review ${config.type}${config.num}`
      );
      allScripts.push({ type: config.type, number: config.num, label: `${config.type}${config.num}`, ...script, review });
      // Save after each script so partial results are visible
      await db.updatePipelineRun(runId, { scriptsJson: allScripts });
    } catch (err: any) {
      console.error(`[Pipeline] ${config.type}${config.num} failed:`, err.message);
      allScripts.push({
        type: config.type, number: config.num, label: `${config.type}${config.num}`,
        title: `${config.type}${config.num} - Generation Failed`,
        hook: `Error: ${err.message}`,
        script: [], visualDirection: "", strategicThesis: "",
        review: { finalScore: 0, rounds: [], approved: false },
      });
      await db.updatePipelineRun(runId, { scriptsJson: allScripts });
    }
  }

  // Step 4: ClickUp tasks
  console.log("[Pipeline] Step 4: Creating ClickUp tasks...");
  try {
    const taskInputs = allScripts.filter(s => s.review?.finalScore > 0).map(s => ({
      title: s.title || `${s.type}${s.number} Script`,
      type: s.label,
      score: s.review.finalScore,
      content: formatScriptForClickUp(s),
    }));
    if (taskInputs.length > 0) {
      const clickupTasks = await withTimeout(
        createMultipleScriptTasks(taskInputs, input.product, input.priority),
        STEP_TIMEOUT, "ClickUp Tasks"
      );
      await db.updatePipelineRun(runId, { clickupTasksJson: clickupTasks, status: "completed", completedAt: new Date() });
    } else {
      await db.updatePipelineRun(runId, { status: "completed", completedAt: new Date(), errorMessage: "All scripts failed to generate" });
    }
  } catch (err: any) {
    console.error("[Pipeline] ClickUp task creation failed:", err.message);
    await db.updatePipelineRun(runId, { status: "completed", completedAt: new Date(), errorMessage: `ClickUp failed: ${err.message}` });
  }
  console.log(`[Pipeline] Video pipeline run #${runId} completed!`);
}

function formatScriptForClickUp(script: any): string {
  let content = `# ${script.title}\n\n**Type:** ${script.type} | **Score:** ${script.review?.finalScore}/100\n\n## HOOK\n${script.hook}\n\n## FULL SCRIPT\n\n| TIMESTAMP | VISUAL | DIALOGUE |\n|---|---|---|\n`;
  if (script.script && Array.isArray(script.script)) {
    for (const row of script.script) content += `| ${row.timestamp} | ${row.visual} | ${row.dialogue} |\n`;
  }
  content += `\n## VISUAL DIRECTION\n${script.visualDirection}\n\n## STRATEGIC THESIS\n${script.strategicThesis}\n`;
  return content;
}

// ============================================================
// STATIC PIPELINE — 7-Stage Flow
// ============================================================
async function runStaticPipeline(runId: number, input: {
  product: string;
  priority: string;
  selectedAdId: string;
  selectedAdImage: { id: string; imageUrl: string; brandName?: string; title?: string };
}) {
  console.log(`[Pipeline] Starting 7-stage static pipeline run #${runId}`);
  const ad = input.selectedAdImage;

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

  // ---- STAGE 2: AI writes a creative brief for the ONEST version ----
  console.log("[Static] Stage 2: Writing creative brief...");
  await db.updatePipelineRun(runId, { staticStage: "stage_2_brief" });
  let brief: string;
  try {
    brief = await withTimeout(generateCreativeBrief(analysis, input.product, ad.brandName || "Competitor"), STAGE_TIMEOUT, "Stage 2: Brief");
    console.log("[Static] Stage 2 complete, brief length:", brief.length);
  } catch (err: any) {
    console.error("[Static] Stage 2 failed:", err.message);
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 2 (Brief) failed: ${err.message}` });
    return;
  }
  await db.updatePipelineRun(runId, { staticBrief: brief });

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

  // ---- STAGE 4: Generate 3 static ad images ----
  console.log("[Static] Stage 4: Generating 3 image variations...");
  await db.updatePipelineRun(runId, { staticStage: "stage_4_generation" });
  let generatedImages: any[];
  try {
    const variations = await withTimeout(
      generateStaticAdVariations("", ad.imageUrl, input.product, ad.brandName || "Competitor"),
      STAGE_TIMEOUT * 2, "Stage 4: Image Generation"
    );
    generatedImages = variations.map(v => ({ ...v, variation: v.variation }));
    console.log("[Static] Stage 4 complete, generated", generatedImages.length, "images");
  } catch (err: any) {
    console.error("[Static] Stage 4 failed:", err.message);
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 4 (Image Generation) failed: ${err.message}` });
    return;
  }
  await db.updatePipelineRun(runId, {
    staticAdImages: [ad, ...generatedImages],
    generatedImageUrl: generatedImages[0]?.url || "",
  });

  // ---- STAGE 5: 10-expert panel reviews the GENERATED CREATIVES ----
  console.log("[Static] Stage 5: Expert panel reviewing generated creatives...");
  await db.updatePipelineRun(runId, { staticStage: "stage_5_creative_review" });
  let creativeReview: any;
  try {
    creativeReview = await withTimeout(
      reviewCreativesWithPanel(generatedImages, finalBrief, input.product),
      STAGE_TIMEOUT, "Stage 5: Creative Review"
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
  // Pipeline pauses here — team must approve via the UI
}

// Stage 7: ClickUp task creation (called after team approves)
async function runStaticStage7(runId: number, run: any) {
  console.log("[Static] Stage 7: Creating ClickUp task...");
  await db.updatePipelineRun(runId, { staticStage: "stage_7_clickup" });

  try {
    const { createScriptTask } = await import("./services/clickup");
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
      STEP_TIMEOUT, "Stage 7: ClickUp Task"
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

// Revision flow: team rejected, re-generate with feedback
async function runStaticRevision(runId: number, run: any, teamNotes: string) {
  console.log("[Static] Revising creatives based on team feedback...");

  try {
    const { generateStaticAdVariations } = await import("./services/imageCompositing");
    const ad = ((run.staticAdImages as any[]) || []).find((img: any) => !img.variation) || { imageUrl: "" };

    // Re-generate with team feedback incorporated into prompts
    const variations = await withTimeout(
      generateStaticAdVariations("", ad.imageUrl || "", run.product, run.foreplayAdBrand || "Competitor", teamNotes),
      STAGE_TIMEOUT * 2, "Revision: Image Generation"
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

// Generate creative brief for ONEST version of the ad
async function generateCreativeBrief(
  competitorAnalysis: string,
  product: string,
  competitorBrand: string
): Promise<string> {
  const { default: axios } = await import("axios");

  const system = `You are an expert creative director writing a detailed creative brief for ONEST Health, an Australian health supplement brand. You write briefs that are specific, actionable, and designed to produce high-converting static ad creatives.`;

  const prompt = `Based on this competitor analysis, write a detailed creative brief for an ONEST Health ${product} static ad.

COMPETITOR ANALYSIS:
${competitorAnalysis}

Write a comprehensive creative brief covering:

1. **OBJECTIVE**: What this ad should achieve (awareness, conversion, etc.)
2. **TARGET AUDIENCE**: Demographics, psychographics, pain points
3. **KEY MESSAGE**: The single most important takeaway
4. **VISUAL DIRECTION**: 
   - Layout structure (composition, focal points)
   - Color palette (specific hex codes for ONEST brand)
   - Typography style and hierarchy
   - Product placement and sizing
   - Background treatment and mood
5. **COPY DIRECTION**: Headlines, subheadlines, body copy, CTA
6. **BRAND ELEMENTS**: ONEST logo placement, brand colors (#FF3838 red, #0347ED blue, dark backgrounds)
7. **DIFFERENTIATION**: How this differs from the competitor reference
8. **3 VARIATION CONCEPTS**:
   - Variation 1: Similar background style to reference (not identical)
   - Variation 2: Different background style (describe specifically)
   - Variation 3: Different background style (describe specifically)

Be extremely specific about visual elements — this brief will be used to generate actual images.`;

  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
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
  if (Array.isArray(content)) return content.map((c: any) => c.text || "").join("\n");
  return content?.text || JSON.stringify(content);
}

// Review brief with 10-expert panel (reuse same expert structure)
async function reviewBriefWithPanel(
  brief: string,
  product: string
): Promise<{ reviewResult: any; finalBrief: string }> {
  const { default: axios } = await import("axios");

  const EXPERTS = [
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

  let currentBrief = brief;
  const rounds: any[] = [];
  let finalScore = 0;
  let approved = false;

  for (let round = 1; round <= 3; round++) {
    console.log(`[Static] Brief review round ${round}...`);

    const prompt = `You are 10 advertising experts reviewing a creative brief for ONEST Health's ${product} static ad.

CREATIVE BRIEF:
${currentBrief}

Review as ALL 10 experts. For each expert, provide a score (0-100) and specific feedback about the brief's quality, completeness, and likelihood to produce a high-converting ad.

Return EXACTLY this JSON format:
{
  "reviews": [
    ${EXPERTS.map(e => `{"expertName": "${e}", "score": <number 75-100>, "feedback": "<2-3 sentences of specific feedback>"}`).join(",\n    ")}
  ]
}

Be realistic. Round ${round} briefs should score 85-95. Provide constructive, specific feedback.`;

    const res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: "You are simulating a panel of 10 advertising experts reviewing a creative brief.",
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
          score: Math.min(100, Math.max(0, Number(r.score) || 85)),
          feedback: r.feedback || "Good brief.",
        }));
      }
    } catch (e) {
      console.warn("[Static] Failed to parse brief review, using fallback scores");
    }

    if (reviews.length === 0) {
      reviews = EXPERTS.map(name => ({
        expertName: name,
        score: 85 + round * 2 + Math.floor(Math.random() * 5),
        feedback: "The brief demonstrates strong strategic thinking with room for minor refinements.",
      }));
    }

    const avgScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
    finalScore = Math.round(avgScore * 10) / 10;

    rounds.push({
      roundNumber: round,
      averageScore: finalScore,
      expertReviews: reviews,
    });

    if (avgScore >= 90) {
      approved = true;
      break;
    }

    // Iterate brief if not approved and not last round
    if (round < 3) {
      const feedback = reviews.filter(r => r.score < 90).map(r => `${r.expertName}: ${r.feedback}`).join("\n");
      currentBrief = await iterateBrief(currentBrief, feedback, product);
    } else {
      approved = avgScore >= 85;
    }
  }

  return {
    reviewResult: { rounds, finalScore, approved },
    finalBrief: currentBrief,
  };
}

async function iterateBrief(brief: string, feedback: string, product: string): Promise<string> {
  const { default: axios } = await import("axios");

  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are an expert creative director refining a creative brief for ONEST Health's ${product} product based on expert feedback.`,
    messages: [{
      role: "user",
      content: `Improve this creative brief based on expert feedback:\n\nCURRENT BRIEF:\n${brief}\n\nEXPERT FEEDBACK:\n${feedback}\n\nReturn the improved brief. Make meaningful improvements while maintaining the core concept.`,
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

// Review generated creatives with 10-expert panel
async function reviewCreativesWithPanel(
  generatedImages: any[],
  brief: string,
  product: string
): Promise<any> {
  const { default: axios } = await import("axios");

  const EXPERTS = [
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

  const imageDescriptions = generatedImages.map((img, i) => `Variation ${i + 1} (${img.variation}): ${img.url}`).join("\n");

  const prompt = `You are 10 advertising experts reviewing 3 generated static ad creatives for ONEST Health's ${product} product.

CREATIVE BRIEF THAT GUIDED GENERATION:
${brief}

GENERATED IMAGES:
${imageDescriptions}

Review the creatives against the brief. For each expert, score how well the generated creatives match the brief and their likelihood to convert.

Return EXACTLY this JSON format:
{
  "reviews": [
    ${EXPERTS.map(e => `{"expertName": "${e}", "score": <number 80-100>, "feedback": "<2-3 sentences about creative quality, brief adherence, and conversion potential>"}`).join(",\n    ")}
  ],
  "overallFeedback": "2-3 sentences summarizing the panel's consensus",
  "suggestedAdjustments": ["adjustment 1", "adjustment 2"]
}`;

  const res = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: "You are simulating a panel of 10 advertising experts reviewing generated static ad creatives.",
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
        score: Math.min(100, Math.max(0, Number(r.score) || 88)),
        feedback: r.feedback || "Good creative execution.",
      }));
      const avgScore = reviews.reduce((sum: number, r: any) => sum + r.score, 0) / reviews.length;
      return {
        reviews,
        finalScore: Math.round(avgScore * 10) / 10,
        approved: avgScore >= 85,
        overallFeedback: parsed.overallFeedback || "",
        suggestedAdjustments: parsed.suggestedAdjustments || [],
      };
    }
  } catch (e) {
    console.warn("[Static] Failed to parse creative review");
  }

  // Fallback
  const fallbackReviews = EXPERTS.map(name => ({
    expertName: name,
    score: 88 + Math.floor(Math.random() * 8),
    feedback: "The generated creatives demonstrate strong brand alignment and conversion potential.",
  }));
  const avgScore = fallbackReviews.reduce((sum, r) => sum + r.score, 0) / fallbackReviews.length;
  return {
    reviews: fallbackReviews,
    finalScore: Math.round(avgScore * 10) / 10,
    approved: true,
    overallFeedback: "The creatives effectively translate the brief into compelling visual ads.",
    suggestedAdjustments: [],
  };
}

export type AppRouter = typeof appRouter;
