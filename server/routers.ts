import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { fetchVideoAds, fetchStaticAds, listBoards } from "./services/foreplay";
import { syncFromForeplay, startAutoSync, getSyncStatus } from "./services/foreplaySync";
import { analyzeVideoFrames, generateScripts, reviewScript } from "./services/claude";
import { transcribeVideo } from "./services/whisper";
import { createMultipleScriptTasks } from "./services/clickup";
import { runStaticPipeline, runStaticStage4, runStaticStage7, runStaticRevision } from "./services/staticPipeline";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { SignJWT } from "jose";
import { storagePut } from "./storage";
import { ACTIVE_PRODUCTS } from "../drizzle/schema";

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

const STEP_TIMEOUT = 10 * 60 * 1000; // 10 minutes per step (Claude API calls can be slow)

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

    // Video pipeline trigger
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

    fetchForeplayVideos: publicProcedure.query(async () => {
      const creatives = await db.listForeplayCreatives("VIDEO", 50);
      // Fallback to live Foreplay API if cache is empty
      if (creatives.length === 0) {
        console.log("[Pipeline] Local cache empty, fetching from Foreplay API");
        const liveAds = await fetchVideoAds(10);
        return liveAds.map(ad => ({
          id: ad.id,
          type: "VIDEO" as const,
          title: ad.title,
          brandName: ad.brandName,
          thumbnailUrl: ad.thumbnailUrl,
          mediaUrl: ad.mediaUrl,
          isNew: false,
        }));
      }
      return creatives.map(c => ({
        id: c.foreplayAdId,
        type: "VIDEO",
        title: c.title,
        brandName: c.brandName,
        thumbnailUrl: c.thumbnailUrl,
        mediaUrl: c.mediaUrl,
        isNew: c.isNew === 1,
      }));
    }),

    fetchForeplayStatics: publicProcedure.query(async () => {
      const creatives = await db.listForeplayCreatives("STATIC", 50);
      // Fallback to live Foreplay API if cache is empty
      if (creatives.length === 0) {
        console.log("[Pipeline] Local cache empty, fetching from Foreplay API");
        const liveAds = await fetchStaticAds(30);
        return liveAds.map(ad => ({
          id: ad.id,
          type: "STATIC" as const,
          title: ad.title,
          brandName: ad.brandName,
          imageUrl: ad.imageUrl,
          thumbnailUrl: ad.thumbnailUrl,
          isNew: false,
        }));
      }
      return creatives.map(c => ({
        id: c.foreplayAdId,
        type: "STATIC",
        title: c.title,
        brandName: c.brandName,
        imageUrl: c.imageUrl,
        isNew: c.isNew === 1,
      }));
    }),

    syncForeplayNow: publicProcedure.mutation(async () => {
      const result = await syncFromForeplay();
      if (result.error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }
      return {
        newCount: result.newCount,
        totalFetched: result.totalFetched,
        message: `Imported ${result.newCount} new creatives from Foreplay`,
      };
    }),

    getSyncStatus: publicProcedure.query(async () => getSyncStatus()),

    listBoards: publicProcedure.query(async () => listBoards()),

    // Static pipeline trigger (Stages 1-3 + pause at 3b for selection)
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

    // Submit user selections at Stage 3b and resume pipeline
    submitSelections: publicProcedure
      .input(z.object({
        runId: z.number(),
        selections: z.object({
          images: z.array(z.object({
            headline: z.string(),
            subheadline: z.string().nullable(),
            background: z.object({
              title: z.string(),
              description: z.string(),
              prompt: z.string(),
            }),
          })).length(3),
          benefits: z.string(),
          productRenderUrl: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.staticStage !== "stage_3b_selection") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline is not in selection stage" });
        }

        // Store selections in DB
        await db.updatePipelineRun(input.runId, {
          userSelections: input.selections,
        });

        // Resume pipeline from Stage 4
        runStaticStage4(input.runId, run, input.selections).catch(err => {
          console.error("[Pipeline] Stage 4+ failed:", err);
          db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
        });

        return { success: true };
      }),

    // Generate headline-matched background concepts
    generateBackgrounds: publicProcedure
      .input(z.object({
        runId: z.number(),
        headlines: z.array(z.string()).length(3),
        product: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");

        // Get product info for context
        let productContext = "";
        try {
          const info = await db.getProductInfo(input.product);
          if (info) {
            const parts: string[] = [];
            if (info.benefits) parts.push(`Benefits: ${info.benefits}`);
            if (info.targetAudience) parts.push(`Target Audience: ${info.targetAudience}`);
            if (info.keySellingPoints) parts.push(`Key Selling Points: ${info.keySellingPoints}`);
            productContext = parts.join("\n");
          }
        } catch { /* ignore */ }

        // Get the competitor ad analysis from the pipeline run for style context
        let styleContext = "";
        try {
          const run = await db.getPipelineRun(input.runId);
          if (run?.briefOptionsJson) {
            const briefSnippet = typeof run.briefOptionsJson === 'string' ? run.briefOptionsJson.substring(0, 500) : JSON.stringify(run.briefOptionsJson).substring(0, 500);
            styleContext = `\nCompetitor ad analysis context: ${briefSnippet}`;
          }
        } catch { /* ignore */ }

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert creative director for DTC supplement advertising. Generate background scene concepts for ad creatives that MATCH the emotional tone and theme of each headline.

Rules:
- Each background must be a SCENE/ENVIRONMENT description (no text, no products, no logos)
- Backgrounds should evoke the feeling of the headline
- Use dramatic lighting, premium aesthetics, brand colors (#FF3838 red, #0347ED blue, #01040A black)
- Think about what visual environment would make someone stop scrolling
- Be specific and vivid — describe lighting, colors, textures, mood
- Each headline gets 3 different background options

Return ONLY valid JSON, no markdown.`,
            },
            {
              role: "user",
              content: `Product: ${input.product}
${productContext ? `Product Info:\n${productContext}` : ""}
${styleContext}

Generate 3 background concepts for EACH of these 3 headlines:

Headline 1: "${input.headlines[0]}"
Headline 2: "${input.headlines[1]}"
Headline 3: "${input.headlines[2]}"

Return JSON in this exact format:
{
  "images": [
    {
      "headline": "exact headline text",
      "backgrounds": [
        { "title": "Short Title", "description": "2-3 sentence visual description", "prompt": "Detailed image generation prompt for this background scene" },
        { "title": "Short Title", "description": "2-3 sentence visual description", "prompt": "Detailed image generation prompt" },
        { "title": "Short Title", "description": "2-3 sentence visual description", "prompt": "Detailed image generation prompt" }
      ]
    },
    { ... },
    { ... }
  ]
}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "background_concepts",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  images: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        headline: { type: "string" },
                        backgrounds: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              description: { type: "string" },
                              prompt: { type: "string" },
                            },
                            required: ["title", "description", "prompt"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["headline", "backgrounds"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["images"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No response from AI" });

        const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
        return parsed as { images: Array<{ headline: string; backgrounds: Array<{ title: string; description: string; prompt: string }> }> };
      }),

    // Get active products list
    getActiveProducts: publicProcedure.query(() => {
      return ACTIVE_PRODUCTS;
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
          runStaticStage7(input.runId, run).catch(err => {
            console.error("[Pipeline] Stage 7 failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        } else {
          await db.updatePipelineRun(input.runId, {
            teamApprovalStatus: "rejected",
            teamApprovalNotes: input.notes || "Changes requested",
            staticStage: "stage_6_revising",
          });
          runStaticRevision(input.runId, run, input.notes || "").catch(err => {
            console.error("[Pipeline] Revision failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        }

        return { success: true };
      }),
  }),

  // ============================================================
  // PRODUCT RENDER MANAGER
  // ============================================================
  renders: router({
    list: publicProcedure
      .input(z.object({ product: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.listProductRenders(input?.product);
      }),

    upload: publicProcedure
      .input(z.object({
        product: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileSize = buffer.length;
        const suffix = Math.random().toString(36).slice(2, 10);
        const fileKey = `product-renders/${input.product}/${input.fileName}-${suffix}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const id = await db.createProductRender({
          product: input.product,
          fileName: input.fileName,
          fileKey,
          url,
          mimeType: input.mimeType,
          fileSize,
        });
        return { id, url, fileKey };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProductRender(input.id);
        return { success: true };
      }),
  }),

  // ============================================================
  // PRODUCT INFORMATION HUB
  // ============================================================
  productInfo: router({
    list: publicProcedure.query(async () => {
      return db.listAllProductInfo();
    }),

    get: publicProcedure
      .input(z.object({ product: z.string() }))
      .query(async ({ input }) => {
        return db.getProductInfo(input.product);
      }),

    upsert: publicProcedure
      .input(z.object({
        product: z.string(),
        ingredients: z.string().optional(),
        benefits: z.string().optional(),
        claims: z.string().optional(),
        targetAudience: z.string().optional(),
        keySellingPoints: z.string().optional(),
        flavourVariants: z.string().optional(),
        pricing: z.string().optional(),
        additionalNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.upsertProductInfo(input);
        return { id, success: true };
      }),
  }),
});

// ============================================================
// VIDEO PIPELINE
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
    }
  } catch (err: any) {
    console.warn("[Pipeline] Failed to load product info:", err.message);
  }

  // Step 1: Transcribe video
  let transcript = "";
  try {
    if (input.mediaUrl) {
      transcript = await withTimeout(transcribeVideo(input.mediaUrl), STEP_TIMEOUT, "Transcription");
    } else {
      transcript = "No video URL provided.";
    }
  } catch (err: any) {
    console.error("[Pipeline] Transcription failed:", err.message);
    transcript = `Transcription failed: ${err.message}`;
    await db.updatePipelineRun(runId, { errorMessage: `Transcription error: ${err.message}` });
  }
  await db.updatePipelineRun(runId, { transcript });

  // Step 2: Visual analysis
  let visualAnalysis = "";
  try {
    visualAnalysis = await withTimeout(
      analyzeVideoFrames(input.mediaUrl, transcript, input.foreplayAdBrand),
      STEP_TIMEOUT, "Visual analysis"
    );
  } catch (err: any) {
    console.error("[Pipeline] Visual analysis failed:", err.message);
    visualAnalysis = `Visual analysis failed: ${err.message}`;
  }
  await db.updatePipelineRun(runId, { visualAnalysis });

  // Step 3: Generate scripts — always produce all 4 (2 DR + 2 UGC)
  const scriptConfigs = [
    { type: "DR" as const, num: 1 },
    { type: "DR" as const, num: 2 },
    { type: "UGC" as const, num: 1 },
    { type: "UGC" as const, num: 2 },
  ];
  const allScripts: any[] = [];
  for (const config of scriptConfigs) {
    console.log(`[Pipeline] Generating ${config.type}${config.num}...`);
    try {
      const script = await withTimeout(
        generateScripts(transcript, visualAnalysis, input.product, config.type, config.num, productInfoContext),
        STEP_TIMEOUT, `Script ${config.type}${config.num}`
      );
      console.log(`[Pipeline] ${config.type}${config.num} generated, starting review...`);
      let review;
      try {
        review = await withTimeout(
          reviewScript(script, input.product, config.type),
          STEP_TIMEOUT, `Review ${config.type}${config.num}`
        );
      } catch (reviewErr: any) {
        console.error(`[Pipeline] Review of ${config.type}${config.num} failed:`, reviewErr.message);
        review = { finalScore: 75, rounds: [], approved: true, summary: `Review failed: ${reviewErr.message}. Script approved by default.` };
      }
      allScripts.push({ type: config.type, number: config.num, label: `${config.type}${config.num}`, ...script, review });
      console.log(`[Pipeline] ${config.type}${config.num} complete. Score: ${review.finalScore}`);
    } catch (err: any) {
      console.error(`[Pipeline] ${config.type}${config.num} generation failed:`, err.message);
      allScripts.push({
        type: config.type, number: config.num, label: `${config.type}${config.num}`,
        title: `${config.type}${config.num} - Generation Failed`,
        hook: `Error: ${err.message}`,
        script: [], visualDirection: "", strategicThesis: "",
        review: { finalScore: 0, rounds: [], approved: false, summary: `Generation failed: ${err.message}` },
      });
    }
    // Save after EACH script so partial progress is always visible
    await db.updatePipelineRun(runId, { scriptsJson: allScripts });
  }
  console.log(`[Pipeline] All 4 scripts processed. Success: ${allScripts.filter(s => s.review?.finalScore > 0).length}/4`);

  // Step 4: ClickUp tasks
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
      await db.updatePipelineRun(runId, { status: "completed", completedAt: new Date(), errorMessage: "All scripts failed" });
    }
  } catch (err: any) {
    console.error("[Pipeline] ClickUp failed:", err.message);
    await db.updatePipelineRun(runId, { status: "completed", completedAt: new Date(), errorMessage: `ClickUp failed: ${err.message}` });
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

export type AppRouter = typeof appRouter;
