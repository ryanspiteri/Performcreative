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
import { runVideoPipelineStages1to3, runVideoPipelineStage4, runVideoPipelineStage5, completeVideoPipelineWithoutClickUp } from "./services/videoPipeline";
import { runStaticPipeline, runStaticStage4, runStaticStage7, runStaticRevision } from "./services/staticPipeline";
import { runIterationStages1to2, runIterationStage3, runIterationStage4, regenerateIterationVariation } from "./services/iterationPipeline";
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
          videoStage: "stage_1_transcription",
        });
        runVideoPipelineStages1to3(runId, input).catch(err => {
          console.error("[Pipeline] Video pipeline stages 1-3 failed:", err);
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
        thumbnailUrl: c.thumbnailUrl,
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
            background: z.union([
              z.object({
                type: z.literal("uploaded"),
                url: z.string(),
                title: z.string(),
              }),
              z.object({
                type: z.literal("preset"),
                presetId: z.string(),
                css: z.string(),
                title: z.string(),
              }),
              z.object({
                type: z.literal("flux"),
                title: z.string(),
                description: z.string().optional(),
                prompt: z.string(),
              }),
            ]),
          })).length(3),
          benefits: z.string(),
          productRenderUrl: z.string().optional(),
          bannerbearTemplate: z.string().optional(),
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

    // Get available Bannerbear templates (fetched live from Bannerbear API)
    getBannerbearTemplates: publicProcedure.query(async () => {
      const { listBannerbearTemplates } = await import("./services/bannerbear");
      try {
        const templates = await listBannerbearTemplates();
        return templates.map(t => ({
          uid: t.uid,
          name: t.name,
          width: t.width,
          height: t.height,
          layers: t.layers,
          previewUrl: t.previewUrl,
          tags: t.tags,
          layerMapping: t.layerMapping || null,
        }));
      } catch (err: any) {
        console.error("[Router] Failed to list Bannerbear templates:", err.message);
        // Fallback to hardcoded list if API fails
        return [
          { uid: 'wXmzGBDakV3vZLN7gj', name: 'Hyperburn Helps', width: 0, height: 0, layers: [] as string[], previewUrl: undefined, tags: [] as string[], layerMapping: null as Record<string, string> | null },
          { uid: 'E9YaWrZMqPrNZnRd74', name: 'Blue Purple Gradient', width: 0, height: 0, layers: [] as string[], previewUrl: undefined, tags: [] as string[], layerMapping: null as Record<string, string> | null },
        ];
      }
    }),

    // Get template details including layer names
    getBannerbearTemplateLayers: publicProcedure
      .input(z.object({ templateUid: z.string() }))
      .query(async ({ input }) => {
        const { getTemplateInfo } = await import("./services/bannerbear");
        const info = await getTemplateInfo(input.templateUid);
        return {
          uid: info.uid,
          name: info.name,
          width: info.width,
          height: info.height,
          layers: ((info as any).current_defaults || info.available_modifications || []).map((m: any) => ({
            name: m.name,
            type: m.type || 'unknown',
          })),
          previewUrl: info.preview_url,
        };
      }),

    // Preview/test a Bannerbear template with dummy or custom data
    previewBannerbearTemplate: publicProcedure
      .input(z.object({
        templateUid: z.string(),
        headline: z.string().optional(),
        subheadline: z.string().optional(),
        benefitCallout: z.string().optional(),
        backgroundImageUrl: z.string().optional(),
        productRenderUrl: z.string().optional(),
        logoUrl: z.string().optional(),
        textColor: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { previewBannerbearTemplate } = await import("./services/bannerbear");

        // If no product render URL provided, fetch the latest from DB
        let productRenderUrl = input.productRenderUrl;
        if (!productRenderUrl) {
          const renders = await db.listProductRenders('Hyperburn');
          if (renders.length > 0) {
            productRenderUrl = renders[0].url;
            console.log(`[Preview] Using DB product render: ${renders[0].fileName}`);
          }
        }

        const result = await previewBannerbearTemplate({
          ...input,
          productRenderUrl,
          textColor: input.textColor || '#FFFFFF',
        });
        return result;
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

    // Video brief approval — user approves the brief before scripts are generated
    approveVideoBrief: publicProcedure
      .input(z.object({
        runId: z.number(),
        approved: z.boolean(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.videoStage !== "stage_3b_brief_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline is not in brief approval stage" });
        }

        if (input.approved) {
          await db.updatePipelineRun(input.runId, {
            videoStage: "stage_4_scripts",
          });
          // Resume pipeline from Stage 4 (scripts only — pauses at script approval)
          runVideoPipelineStage4(input.runId, run).catch((err: any) => {
            console.error("[Pipeline] Video stage 4 failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        } else {
          // User rejected — mark as failed with notes
          await db.updatePipelineRun(input.runId, {
            status: "failed",
            errorMessage: `Brief rejected by user: ${input.notes || "No reason given"}`,
            videoStage: "stage_3b_brief_approval",
          });
        }

        return { success: true };
      }),

    // Video script approval — user approves scripts before ClickUp push
    approveVideoScripts: publicProcedure
      .input(z.object({
        runId: z.number(),
        approved: z.boolean(),
        appUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.videoStage !== "stage_4b_script_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline is not in script approval stage" });
        }

        if (input.approved) {
          // Push to ClickUp
          runVideoPipelineStage5(input.runId, run, input.appUrl).catch((err: any) => {
            console.error("[Pipeline] Video stage 5 (ClickUp) failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        } else {
          // Complete without ClickUp
          await completeVideoPipelineWithoutClickUp(input.runId);
        }

        return { success: true };
      }),

    // ============================================================
    // ITERATION PIPELINE — Iterate on your own winning ads
    // ============================================================
    triggerIteration: publicProcedure
      .input(z.object({
        product: z.string(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]),
        sourceImageUrl: z.string(),
        sourceImageName: z.string().optional(),
        creativityLevel: z.enum(["SAFE", "BOLD", "WILD"]).optional(),
        variationTypes: z.array(z.enum(["headline_only", "background_only", "layout_only", "benefit_callouts_only", "props_only", "talent_swap", "full_remix"])).optional(),
        variationCount: z.number().min(1).max(50).optional(),
        aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const runId = await db.createPipelineRun({
          pipelineType: "iteration",
          status: "running",
          product: input.product,
          priority: input.priority,
          triggerSource: "manual",
          foreplayAdId: "iteration-" + Date.now(),
          foreplayAdTitle: input.sourceImageName || "Winning Ad Iteration",
          foreplayAdBrand: "ONEST Health",
          iterationSourceUrl: input.sourceImageUrl,
          iterationStage: "stage_1_analysis",
          creativityLevel: input.creativityLevel || "BOLD",
          aspectRatio: input.aspectRatio || "1:1",
          variationTypes: input.variationTypes ? JSON.stringify(input.variationTypes) : null,
          variationCount: input.variationCount || 3,
        });
        runIterationStages1to2(runId, input).catch(err => {
          console.error("[Pipeline] Iteration pipeline stages 1-2 failed:", err);
          db.updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Pipeline failed" });
        });
        return { runId, status: "running" };
      }),

    approveIterationBrief: publicProcedure
      .input(z.object({
        runId: z.number(),
        approved: z.boolean(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.iterationStage !== "stage_2b_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline is not in iteration brief approval stage" });
        }

        if (input.approved) {
          await db.updatePipelineRun(input.runId, {
            iterationStage: "stage_3_generation",
          });
          runIterationStage3(input.runId, run).catch(err => {
            console.error("[Pipeline] Iteration stage 3 failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        } else {
          await db.updatePipelineRun(input.runId, {
            status: "failed",
            errorMessage: `Iteration brief rejected: ${input.notes || "No reason given"}`,
            iterationStage: "stage_2b_approval",
          });
        }

        return { success: true };
      }),

    // Approve iteration variations and push to ClickUp
    approveIterationVariations: publicProcedure
      .input(z.object({
        runId: z.number(),
        approved: z.boolean(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.iterationStage !== "stage_3b_variation_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline is not in variation approval stage" });
        }

        if (input.approved) {
          runIterationStage4(input.runId, run).catch(err => {
            console.error("[Pipeline] Iteration stage 4 failed:", err);
            db.updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
          });
        } else {
          // Mark as completed without ClickUp tasks (user chose not to push)
          await db.updatePipelineRun(input.runId, {
            status: "completed",
            iterationStage: "completed",
            completedAt: new Date(),
            teamApprovalNotes: input.notes || "Variations completed without ClickUp push",
          });
        }

        return { success: true };
      }),

    // Regenerate a single iteration variation
    regenerateVariation: publicProcedure
      .input(z.object({
        runId: z.number(),
        variationIndex: z.number().min(0).max(2),
        headline: z.string().optional(),
        subheadline: z.string().optional(),
        backgroundPrompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.iterationStage !== "stage_3b_variation_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline is not in variation approval stage" });
        }

        try {
          const result = await regenerateIterationVariation(
            input.runId,
            input.variationIndex,
            {
              headline: input.headline || undefined,
              subheadline: input.subheadline || undefined,
              backgroundPrompt: input.backgroundPrompt || undefined,
            }
          );
          return { success: true, url: result.url, variation: result.variation };
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
        }
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

  // ============================================================
  // BACKGROUND MANAGER
  // ============================================================
  backgrounds: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.listBackgrounds(input?.category);
      }),

    upload: publicProcedure
      .input(z.object({
        name: z.string(),
        category: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileSize = buffer.length;
        const suffix = Math.random().toString(36).slice(2, 10);
        const fileKey = `backgrounds/${input.category.toLowerCase()}/${input.name}-${suffix}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const id = await db.createBackground({
          name: input.name,
          category: input.category,
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
        await db.deleteBackground(input.id);
        return { success: true };
      }),
  }),

  ugc: router({
    // List all UGC uploads
    list: publicProcedure.query(async () => db.listUgcUploads()),

    // Get single UGC upload with variants
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const upload = await db.getUgcUpload(input.id);
        if (!upload) throw new TRPCError({ code: "NOT_FOUND", message: "UGC upload not found" });
        const variants = await db.listUgcVariants(input.id);
        return { upload, variants };
      }),

    // Upload video and create UGC record
    upload: publicProcedure
      .input(z.object({
        fileName: z.string(),
        base64Data: z.string(),
        mimeType: z.string(),
        product: z.string(),
        audienceTag: z.string().optional(),
        desiredOutputVolume: z.number().min(1).max(200),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log(`[UGC Upload] Starting upload: ${input.fileName}, base64 length: ${input.base64Data.length}`);
          
          const buffer = Buffer.from(input.base64Data, "base64");
          const fileSize = buffer.length;
          const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
          
          console.log(`[UGC Upload] Buffer created: ${fileSizeMB}MB`);
          
          if (fileSize > 500 * 1024 * 1024) {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: `File too large: ${fileSizeMB}MB (max 500MB)` 
            });
          }
          
          const suffix = Math.random().toString(36).slice(2, 10);
          const fileKey = `ugc-uploads/${input.product.toLowerCase()}/${input.fileName}-${suffix}`;
          
          console.log(`[UGC Upload] Uploading to S3: ${fileKey}`);
          const { url } = await storagePut(fileKey, buffer, input.mimeType);
          console.log(`[UGC Upload] S3 upload complete: ${url}`);
          
          const id = await db.createUgcUpload({
            fileName: input.fileName,
            fileKey,
            videoUrl: url,
            product: input.product,
            audienceTag: input.audienceTag,
            desiredOutputVolume: input.desiredOutputVolume,
            status: "transcribing",
          });
          
          console.log(`[UGC Upload] Database record created: ID ${id}`);
          
          // Automatically start extraction in background
          (async () => {
            try {
              const { extractStructureBlueprint } = await import("./services/ugcClone");
              const { transcribeAudio } = await import("./_core/voiceTranscription");
              
              console.log(`[UGC Upload] Starting transcription for upload ${id}`);
              const transcriptResult = await transcribeAudio({ audioUrl: url });
              if (!('text' in transcriptResult)) {
                throw new Error("Transcription failed");
              }
              
              console.log(`[UGC Upload] Transcription complete, extracting structure`);
              const blueprint = await extractStructureBlueprint(transcriptResult.text, input.product);
              await db.updateUgcUpload(id, {
                status: "structure_extracted",
                transcript: transcriptResult.text,
                structureBlueprint: blueprint,
              });
              console.log(`[UGC Upload] Structure extraction complete for upload ${id}`);
            } catch (error: any) {
              console.error(`[UGC Upload] Extraction failed for upload ${id}:`, error);
              await db.updateUgcUpload(id, {
                status: "error",
                errorMessage: error.message,
              });
            }
          })();
          
          return { id, url };
        } catch (error: any) {
          console.error(`[UGC Upload] Error:`, error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Upload failed",
            cause: error,
          });
        }
      }),

    // Start transcription + structure extraction
    startExtraction: publicProcedure
      .input(z.object({ uploadId: z.number() }))
      .mutation(async ({ input }) => {
        const upload = await db.getUgcUpload(input.uploadId);
        if (!upload) throw new TRPCError({ code: "NOT_FOUND", message: "UGC upload not found" });
        
        await db.updateUgcUpload(input.uploadId, { status: "transcribing" });
        
        // Start async extraction in background
        (async () => {
          try {
            const { extractStructureBlueprint } = await import("./services/ugcClone");
            const { transcribeAudio } = await import("./_core/voiceTranscription");
            
            // Step 1: Transcribe
            const transcriptResult = await transcribeAudio({ audioUrl: upload.videoUrl });
            if (!('text' in transcriptResult)) {
              throw new Error("Transcription failed");
            }
            
            // Step 2: Extract structure
            const blueprint = await extractStructureBlueprint(transcriptResult.text, upload.product);
            await db.updateUgcUpload(input.uploadId, {
              status: "structure_extracted",
              transcript: transcriptResult.text,
              structureBlueprint: blueprint,
            });
          } catch (error: any) {
            console.error("[UGC] Extraction failed:", error);
            await db.updateUgcUpload(input.uploadId, {
              status: "error",
              errorMessage: error.message,
            });
          }
        })();
        
        return { success: true, uploadId: input.uploadId };
      }),

    // Approve structure blueprint
    approveBlueprint: publicProcedure
      .input(z.object({ uploadId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUgcUpload(input.uploadId, {
          status: "blueprint_approved",
          blueprintApprovedAt: new Date(),
        });
        return { success: true };
      }),

    // Generate variants
    generateVariants: publicProcedure
      .input(z.object({ uploadId: z.number() }))
      .mutation(async ({ input }) => {
        const upload = await db.getUgcUpload(input.uploadId);
        if (!upload) throw new TRPCError({ code: "NOT_FOUND", message: "UGC upload not found" });
        if (!upload.structureBlueprint) throw new TRPCError({ code: "BAD_REQUEST", message: "Blueprint not extracted yet" });
        
        await db.updateUgcUpload(input.uploadId, { status: "generating_variants" });
        
        // Start async variant generation in background
        (async () => {
          try {
            const { generateVariants } = await import("./services/ugcClone");
            const variants = await generateVariants({
              uploadId: input.uploadId,
              product: upload.product,
              audienceTag: upload.audienceTag,
              desiredOutputVolume: upload.desiredOutputVolume,
              structureBlueprint: upload.structureBlueprint as any,
              transcript: upload.transcript || "",
            });
            
            // Save all variants to database
            for (const variant of variants) {
              await db.createUgcVariant({
                uploadId: input.uploadId,
                variantNumber: variant.variantNumber,
                actorArchetype: variant.actorArchetype,
                voiceTone: variant.voiceTone,
                energyLevel: variant.energyLevel,
                scriptText: variant.scriptText,
                hookVariation: variant.hookVariation,
                ctaVariation: variant.ctaVariation,
                runtime: variant.runtime,
                status: "awaiting_approval",
              });
            }
            
            await db.updateUgcUpload(input.uploadId, { status: "completed" });
          } catch (error: any) {
            console.error("[UGC] Variant generation failed:", error);
            await db.updateUgcUpload(input.uploadId, {
              status: "error",
              errorMessage: error.message,
            });
          }
        })();
        
        return { success: true, uploadId: input.uploadId };
      }),

    // List variants for an upload
    listVariants: publicProcedure
      .input(z.object({ uploadId: z.number() }))
      .query(async ({ input }) => db.listUgcVariants(input.uploadId)),

    // Approve selected variants
    approveVariants: publicProcedure
      .input(z.object({ variantIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        for (const id of input.variantIds) {
          await db.updateUgcVariant(id, {
            status: "approved",
            approvedAt: new Date(),
          });
        }
        return { success: true, count: input.variantIds.length };
      }),

    // Reject selected variants
    rejectVariants: publicProcedure
      .input(z.object({ variantIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        for (const id of input.variantIds) {
          await db.updateUgcVariant(id, {
            status: "rejected",
            rejectedAt: new Date(),
          });
        }
        return { success: true, count: input.variantIds.length };
      }),

    // Push approved variants to ClickUp
    pushToClickup: publicProcedure
      .input(z.object({ variantIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const { pushUgcVariantsToClickup } = await import("./services/clickup");
        
        // Fetch all variants with upload info
        const variantsToPush: any[] = [];
        for (const variantId of input.variantIds) {
          const variants = await db.listUgcVariants(0); // Get all variants
          const variant = variants.find((v: any) => v.id === variantId);
          if (variant) {
            const upload = await db.getUgcUpload(variant.uploadId);
            variantsToPush.push({
              ...variant,
              product: upload?.product || "Unknown",
            });
          }
        }
        
        // Push to ClickUp
        const results = await pushUgcVariantsToClickup(variantsToPush);
        
        // Update variants with ClickUp task info
        for (const result of results) {
          await db.updateUgcVariant(result.variantId, {
            status: "pushed_to_clickup",
            clickupTaskId: result.task.id,
            clickupTaskUrl: result.task.url,
            pushedToClickupAt: new Date(),
          });
        }
        
        return { success: true, count: results.length };
      }),
  }),

  headlineBank: router({
    // List all headlines
    list: publicProcedure.query(async () => {
      return db.listHeadlines();
    }),

    // Get single headline
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const headline = await db.getHeadline(input.id);
        if (!headline) throw new TRPCError({ code: "NOT_FOUND", message: "Headline not found" });
        return headline;
      }),

    // Create headline
    create: publicProcedure
      .input(z.object({
        headline: z.string(),
        subheadline: z.string().optional(),
        rating: z.number().min(1).max(5).default(3),
        roas: z.string().optional(),
        spend: z.string().optional(),
        weeksActive: z.number().optional(),
        product: z.string().optional(),
        angle: z.string().optional(),
        format: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createHeadline(input);
      }),

    // Update headline
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        headline: z.string(),
        subheadline: z.string().optional(),
        rating: z.number().min(1).max(5),
        roas: z.string().optional(),
        spend: z.string().optional(),
        weeksActive: z.number().optional(),
        product: z.string().optional(),
        angle: z.string().optional(),
        format: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.updateHeadline(input.id, input);
      }),

    // Delete headline
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteHeadline(input.id);
        return { success: true };
      }),
  }),
});

// ============================================================
// LEGACY VIDEO PIPELINE (kept for reference, no longer called)
// ============================================================
async function _legacyRunVideoPipeline(runId: number, input: {
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
