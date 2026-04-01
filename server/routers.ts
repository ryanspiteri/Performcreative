import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { fetchVideoAds, fetchStaticAds, listBoards } from "./services/foreplay";
import { syncFromForeplay, startAutoSync, getSyncStatus } from "./services/foreplaySync";
import { analyzeAndPersist } from "./services/creativeAnalysis";
import { analyzeVideoFrames, generateScripts, reviewScript } from "./services/claude";
import { transcribeVideo } from "./services/whisper";
import { createMultipleScriptTasks } from "./services/clickup";
import { runVideoPipelineStages1to3, runVideoPipelineStage4, runVideoPipelineStage5, completeVideoPipelineWithoutClickUp } from "./services/videoPipeline";
import { runStaticPipeline, runStaticStage4, runStaticStage7, runStaticRevision } from "./services/staticPipeline";
import { runIterationStages1to2, runIterationStage3, runIterationStage4, regenerateIterationVariation } from "./services/iterationPipeline";
import { generateProductAdWithNanoBananaPro } from "./services/nanoBananaPro";
import { pushIterationRunToClickUp } from "./services/iterationClickUp";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { SignJWT } from "jose";
import { storagePut } from "./storage";
import { ACTIVE_PRODUCTS } from "../drizzle/schema";
import { canvaRouter } from "./routers/canva";
import { organicRouter } from "./routers/organic";
import { scriptGeneratorRouter } from "./routers/scriptGenerator";
import { runFaceSwapPipeline } from "./services/faceSwapPipeline";
import { validatePortrait } from "./services/portraitValidator";
import { withTimeout, STEP_TIMEOUT } from "./services/_shared";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ============================================================
// FACE SWAP ROUTER — declared before appRouter to avoid hoisting issues
// ============================================================
const faceSwapRouter = router({
  create: protectedProcedure
    .input(z.object({
      sourceVideoUrl: z.string().optional(), // optional when ugcVariantId is provided
      portraitBase64: z.string(),
      portraitMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      portraitS3Url: z.string().url(),
      voiceId: z.string().optional(),
      voiceoverScript: z.string().optional(),
      videoDurationSeconds: z.number().optional().default(30),
      ugcVariantId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Resolve source video URL from ugcVariantId if not provided directly
      let sourceVideoUrl = input.sourceVideoUrl || "";
      if (!sourceVideoUrl && input.ugcVariantId) {
        const variant = await db.getUgcVariant(input.ugcVariantId);
        if (variant?.uploadId) {
          const upload = await db.getUgcUpload(variant.uploadId);
          sourceVideoUrl = upload?.videoUrl || "";
        }
      }
      if (!sourceVideoUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Source video URL is required" });

      const durationMins = (input.videoDurationSeconds ?? 30) / 60;
      const estimatedCostUsd = `$${(durationMins * 2.16).toFixed(2)}`;
      const jobId = await db.createFaceSwapJob({
        ugcVariantId: input.ugcVariantId ?? null,
        sourceVideoUrl,
        portraitUrl: input.portraitS3Url,
        voiceId: input.voiceId ?? null,
        voiceoverScript: input.voiceoverScript ?? null,
        estimatedCostUsd,
        status: "pending",
      });
      runFaceSwapPipeline({
        jobId,
        sourceVideoUrl,
        portraitBase64: input.portraitBase64,
        portraitMimeType: input.portraitMimeType,
        portraitS3Url: input.portraitS3Url,
        voiceId: input.voiceId,
        voiceoverScript: input.voiceoverScript,
        videoDurationSeconds: input.videoDurationSeconds ?? 30,
      }).catch(err => console.error(`[FaceSwap] Background pipeline error for job ${jobId}:`, err.message));
      return { jobId, estimatedCostUsd };
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const job = await db.getFaceSwapJob(input.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Face swap job not found" });
      return job;
    }),

  list: publicProcedure
    .query(async () => db.listFaceSwapJobs(50)),

  getByVariant: publicProcedure
    .input(z.object({ variantId: z.number() }))
    .query(async ({ input }) => {
      const jobs = await db.listFaceSwapJobs(200);
      // Return the most recent job linked to this variant
      return (jobs as any[]).find((j: any) => j.ugcVariantId === input.variantId) || null;
    }),

  validatePortrait: protectedProcedure
    .input(z.object({
      portraitBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
    }))
    .mutation(async ({ input }) => validatePortrait(input.portraitBase64, input.mimeType)),

  uploadPortrait: protectedProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
      fileName: z.string().default("portrait.jpg"),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.split("/")[1] || "jpg";
      const key = `face-swap-portraits/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),

  getVoicesByAccent: publicProcedure
    .input(z.object({
      accent: z.enum(["australian", "american", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
      });
      if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch ElevenLabs voices" });
      const data = await response.json() as { voices: any[] };
      const voices = (data.voices || []).map((v: any) => ({
        id: v.voice_id as string,
        name: v.name as string,
        accent: (v.labels?.accent || "") as string,
        gender: (v.labels?.gender || "") as string,
        age: (v.labels?.age || "") as string,
        useCase: (v.labels?.use_case || "") as string,
        previewUrl: (v.preview_url || "") as string,
      }));
      if (input.accent === "all") return voices.filter(v => v.accent === "australian" || v.accent === "american");
      return voices.filter(v => v.accent === input.accent);
    }),

  pushToClickUp: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      product: z.string(),
      priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("High"),
    }))
    .mutation(async ({ input }) => {
      const job = await db.getFaceSwapJob(input.jobId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Face swap job not found" });
      if (job.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Job is not completed yet" });
      const { createScriptTask } = await import("./services/clickup");
      const task = await createScriptTask(
        `UGC Clone - ${input.product} - ${new Date().toLocaleDateString()}`,
        "UGC Clone",
        100,
        `Character swap video ready for review.\n\nOutput Video: ${job.outputVideoUrl}\nCost: ${job.estimatedCostUsd}\nMagic Hour Job: ${job.magicHourJobId}`,
        input.product,
        input.priority,
      );
      await db.updateFaceSwapJob(input.jobId, { clickupTaskId: task.id, clickupTaskUrl: task.url });
      return { taskId: task.id, taskUrl: task.url };
    }),

  generateScript: protectedProcedure
    .input(z.object({
      uploadId: z.number(),
      actorArchetype: z.string(),
      voiceTone: z.string(),
      energyLevel: z.enum(["low", "medium", "high"]),
    }))
    .mutation(async ({ input }) => {
      const upload = await db.getUgcUpload(input.uploadId);
      if (!upload) throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      if (!upload.transcript) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload has no transcript yet" });
      if (!upload.structureBlueprint) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload has no structure blueprint yet — approve the blueprint first" });

      const { generateVariants } = await import("./services/ugcClone");
      const blueprint = upload.structureBlueprint as import("./services/ugcClone").StructureBlueprint;

      const variants = await generateVariants({
        uploadId: input.uploadId,
        product: upload.product,
        audienceTag: upload.audienceTag ?? undefined,
        desiredOutputVolume: 1,
        structureBlueprint: blueprint,
        transcript: upload.transcript,
      });

      // Override archetype/tone/energy with user's selection
      const variant = variants[0];
      if (!variant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Script generation failed" });

      // Re-generate with specific archetype/tone/energy if different from what was returned
      const { invokeLLM } = await import("./_core/llm");
      const prompt = `You are generating ONE UGC script variant with specific persona settings.

ORIGINAL TRANSCRIPT:
${upload.transcript}

STRUCTURE BLUEPRINT:
- Hook: "${blueprint.hook.text}" (${blueprint.hook.strength} strength)
- Body: ${blueprint.body.keyPoints.join(", ")}
- CTA: "${blueprint.cta.text}" (${blueprint.cta.urgency} urgency)
- Pacing: ${blueprint.pacing.wordsPerMinute} WPM, ${blueprint.pacing.energyLevel} energy
- Compliance: ${blueprint.complianceLanguage.join("; ")}

PRODUCT: ${upload.product}
AUDIENCE: ${upload.audienceTag || "general fitness audience"}

PERSONA SETTINGS:
- Actor Archetype: ${input.actorArchetype}
- Voice Tone: ${input.voiceTone}
- Energy Level: ${input.energyLevel}

Generate exactly ONE script variant matching these persona settings exactly. Preserve the structure, compliance language, and hook strength. Only change the surface phrasing to match the persona.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a UGC script variant generator. Return only the script text, no JSON, no labels." },
          { role: "user", content: prompt },
        ],
      });

      const scriptText = response.choices[0].message.content as string;
      return { scriptText: scriptText.trim() };
    }),
});

export const appRouter = router({
  system: systemRouter,
  canva: canvaRouter,
  faceSwap: faceSwapRouter,
  organic: organicRouter,
  scriptGenerator: scriptGeneratorRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.username);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const secretKey = new TextEncoder().encode(ENV.cookieSecret);
        const token = await new SignJWT({ openId: user.openId, appId: ENV.appId, name: user.name || "" })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
          .sign(secretKey);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user: { name: user.name || user.email || "" } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  team: router({
    list: adminProcedure.query(async () => db.listUsers()),

    invite: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        email: z.string().email().max(320),
        password: z.string().min(8).max(128),
        role: z.enum(["user", "admin"]).default("user"),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
        const passwordHash = await bcrypt.hash(input.password, 10);
        const openId = `local-${crypto.randomUUID()}`;
        await db.upsertUser({
          openId,
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash,
        });
        return { success: true };
      }),

    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    remove: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (user?.openId === "onest-admin-user") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove the owner account" });
        }
        await db.deleteUser(input.userId);
        return { success: true };
      }),

    resetPassword: adminProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(8).max(128) }))
      .mutation(async ({ input }) => {
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateUserPasswordHash(input.userId, passwordHash);
        return { success: true };
      }),
  }),

  pipeline: router({
    list: publicProcedure
      .input(z.object({ pipelineType: z.string().optional() }).optional())
      .query(async ({ input }) => db.listPipelineRuns(50, input?.pipelineType)),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const run = await db.getPipelineRun(input.id);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline run not found" });
        return run;
      }),

    // Video pipeline trigger — v3.0 with funnel stage + archetype
    triggerVideo: protectedProcedure
      .input(z.object({
        product: z.string(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]),
        foreplayAdId: z.string().optional(),
        foreplayAdTitle: z.string().optional(),
        foreplayAdBrand: z.string().optional(),
        mediaUrl: z.string(),
        thumbnailUrl: z.string().optional(),
        sourceType: z.enum(["competitor", "winning_ad"]).optional(),
        duration: z.number().optional(),
        funnelStage: z.enum(["cold", "warm", "retargeting", "retention"]).optional(),
        actorArchetype: z.enum(["FitnessEnthusiast", "BusyMum", "Athlete", "Biohacker", "WellnessAdvocate", "HealthyAger", "WeightLossBeginner", "WellnessSwitcher"]).optional(),
        styleConfig: z.array(z.object({
          styleId: z.enum(["DR", "UGC", "FOUNDER", "EDUCATION", "LIFESTYLE", "DEMO"]),
          quantity: z.number(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const runId = await db.createPipelineRun({
          pipelineType: "video",
          status: "running",
          product: input.product,
          priority: input.priority,
          triggerSource: "manual",
          foreplayAdId: input.foreplayAdId || "",
          foreplayAdTitle: input.foreplayAdTitle || "",
          foreplayAdBrand: input.foreplayAdBrand || "",
          videoUrl: input.mediaUrl,
          thumbnailUrl: input.thumbnailUrl || "",
          videoStage: "stage_1_transcription",
          videoSourceType: input.sourceType || "competitor",
          videoDuration: input.duration || 60,
          videoStyleConfig: input.styleConfig || null,
          videoFunnelStage: input.funnelStage || "cold",
          videoArchetypes: input.actorArchetype ? [input.actorArchetype] : null,
        });
        runVideoPipelineStages1to3(runId, {
          ...input,
          sourceType: input.sourceType || "competitor",
          duration: input.duration || 60,
          funnelStage: input.funnelStage || "cold",
          actorArchetype: input.actorArchetype,
          styleConfig: input.styleConfig || [{ styleId: "DR", quantity: 2 }, { styleId: "UGC", quantity: 2 }],
        }).catch(err => {
          console.error("[Pipeline] Video pipeline stages 1-3 failed:", err);
          db.updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Pipeline failed" });
        });
        return { runId, status: "running" };
      }),

    fetchForeplayVideos: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50), offset: z.number().min(0).default(0) }).default({ limit: 50, offset: 0 }))
      .query(async ({ input }) => {
      const creatives = await db.listForeplayCreatives("VIDEO", input.limit, input.offset);
      // Fallback to live Foreplay API if cache is empty and no offset (first page only)
      if (creatives.length === 0 && input.offset === 0) {
        console.log("[Pipeline] Local cache empty, fetching from Foreplay API");
        const liveAds = await fetchVideoAds(20);
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
        dbId: c.id,
        type: "VIDEO",
        title: c.title,
        brandName: c.brandName,
        thumbnailUrl: c.thumbnailUrl,
        mediaUrl: c.mediaUrl,
        isNew: c.isNew === 1,
        summary: c.summary,
        qualityScore: c.qualityScore,
        suggestedConfig: c.suggestedConfig,
      }));
    }),

    fetchForeplayStatics: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50), offset: z.number().min(0).default(0) }).default({ limit: 50, offset: 0 }))
      .query(async ({ input }) => {
      const creatives = await db.listForeplayCreatives("STATIC", input.limit, input.offset);
      // Fallback to live Foreplay API if cache is empty and no offset (first page only)
      if (creatives.length === 0 && input.offset === 0) {
        console.log("[Pipeline] Local cache empty, fetching from Foreplay API");
        const liveAds = await fetchStaticAds(20);
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
        dbId: c.id,
        type: "STATIC",
        title: c.title,
        brandName: c.brandName,
        imageUrl: c.imageUrl,
        thumbnailUrl: c.thumbnailUrl,
        isNew: c.isNew === 1,
        summary: c.summary,
        qualityScore: c.qualityScore,
        suggestedConfig: c.suggestedConfig,
      }));
    }),

    syncForeplayNow: protectedProcedure.mutation(async () => {
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

    getSyncStatus: protectedProcedure.query(async () => getSyncStatus()),

    listBoards: protectedProcedure.query(async () => listBoards()),

    statusByAdIds: protectedProcedure
      .input(z.object({ adIds: z.array(z.string()).max(200) }))
      .query(async ({ input }) => db.getPipelineStatusByAdIds(input.adIds)),

    analyzeCreative: protectedProcedure
      .input(z.object({ dbId: z.number() }))
      .mutation(async ({ input }) => {
        const result = await analyzeAndPersist(input.dbId);
        if (!result) return { success: false as const };
        return { success: true as const, ...result };
      }),

    // Static pipeline trigger (Stages 1-3 + pause at 3b for selection)
    triggerStatic: protectedProcedure
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
    submitSelections: protectedProcedure
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
    generateBackgrounds: protectedProcedure
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
    teamApprove: protectedProcedure
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

    // Upload video for winning ad mode
    uploadWinningAdVideo: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (buffer.length > maxSize) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "File too large. Maximum 100MB." });
        }
        const ext = input.fileName.split(".").pop() || "mp4";
        const key = `winning-ads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url, key };
      }),

    // Video brief approval — user approves the brief before scripts are generated
    approveVideoBrief: protectedProcedure
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
    approveVideoScripts: protectedProcedure
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
    triggerIteration: protectedProcedure
      .input(z.object({
        product: z.string(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]),
        sourceImageUrl: z.string(),
        sourceImageName: z.string().optional(),
        sourceType: z.enum(["own_ad", "competitor_ad"]).optional(),
        adaptationMode: z.enum(["concept", "style"]).optional(),
        foreplayAdId: z.string().optional(),
        foreplayAdTitle: z.string().optional(),
        foreplayAdBrand: z.string().optional(),
        creativityLevel: z.enum(["SAFE", "BOLD", "WILD"]).optional(),
        variationTypes: z.array(z.enum(["headline_only", "background_only", "layout_only", "benefit_callouts_only", "props_only", "talent_swap", "full_remix"])).optional(),
        variationCount: z.number().min(1).max(50).optional(),
        aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
        imageModel: z.enum(["nano_banana_pro", "nano_banana_2"]).optional(),
        selectedRenderId: z.number().optional(),
        selectedFlavour: z.string().optional(),
        selectedPersonId: z.number().optional(),
        selectedAudience: z.string().optional(),
        resolution: z.enum(["2K", "4K"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const sourceType = input.sourceType ?? "own_ad";
        if (sourceType === "competitor_ad" && !input.adaptationMode) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "adaptationMode (concept or style) is required when sourceType is competitor_ad" });
        }
        // Validate selected render belongs to this product
        if (input.selectedRenderId) {
          const render = await db.getProductRenderById(input.selectedRenderId);
          if (!render || render.product !== input.product) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Selected render does not exist or does not belong to this product" });
          }
        }
        const runId = await db.createPipelineRun({
          pipelineType: "iteration",
          status: "running",
          product: input.product,
          priority: input.priority,
          triggerSource: "manual",
          foreplayAdId: input.foreplayAdId ?? "iteration-" + Date.now(),
          foreplayAdTitle: input.foreplayAdTitle ?? input.sourceImageName ?? (sourceType === "competitor_ad" ? "Competitor Ad" : "Winning Ad Iteration"),
          foreplayAdBrand: input.foreplayAdBrand ?? (sourceType === "own_ad" ? "ONEST Health" : undefined),
          iterationSourceUrl: input.sourceImageUrl,
          iterationStage: "stage_1_analysis",
          iterationSourceType: sourceType,
          iterationAdaptationMode: sourceType === "competitor_ad" ? input.adaptationMode ?? null : null,
          creativityLevel: input.creativityLevel || "BOLD",
          aspectRatio: input.aspectRatio || "1:1",
          variationTypes: input.variationTypes ? JSON.stringify(input.variationTypes) : null,
          variationCount: input.variationCount || 3,
          imageModel: input.imageModel || "nano_banana_pro",
          selectedRenderId: input.selectedRenderId ?? null,
          selectedFlavour: input.selectedFlavour ?? null,
          selectedPersonId: input.selectedPersonId ?? null,
          selectedAudience: input.selectedAudience ?? null,
          resolution: input.resolution ?? "2K",
        });
        runIterationStages1to2(runId, input).catch(err => {
          console.error("[Pipeline] Iteration pipeline stages 1-2 failed:", err);
          db.updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Pipeline failed" });
        });
        return { runId, status: "running" };
      }),

    approveIterationBrief: protectedProcedure
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
    approveIterationVariations: protectedProcedure
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
    regenerateVariation: protectedProcedure
      .input(z.object({
        runId: z.number(),
        variationIndex: z.number().min(0).max(49),
        headline: z.string().optional(),
        subheadline: z.string().optional(),
        backgroundPrompt: z.string().optional(),
        referenceImageUrl: z.string().url().optional(),
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
              referenceImageUrl: input.referenceImageUrl || undefined,
            }
          );
          return { success: true, url: result.url, variation: result.variation };
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
        }
      }),

    // Push completed iteration variations to ClickUp
    pushIterationToClickUp: protectedProcedure
      .input(z.object({
        runId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const run = await db.getPipelineRun(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.status !== "completed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pipeline must be completed before pushing to ClickUp" });
        }
        if (!run.iterationVariations) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No variations found to push" });
        }

        const variations = typeof run.iterationVariations === 'string' 
          ? JSON.parse(run.iterationVariations) 
          : run.iterationVariations;
        const result = await pushIterationRunToClickUp({
          runId: input.runId,
          variations,
          product: run.product,
        });

        return {
          success: true,
          taskIds: result.taskIds,
          taskUrls: result.taskUrls,
          pushedCount: result.taskIds.length,
        };
      }),

    // Generate child variations from selected parent runs
    generateChildren: protectedProcedure
      .input(z.object({
        parentRunIds: z.array(z.number()).min(1).max(10),
        childCount: z.number().min(1).max(10).default(5),
      }))
      .mutation(async ({ input }) => {
        // Validate all parent runs exist and are completed
        const parents = await Promise.all(
          input.parentRunIds.map(id => db.getPipelineRun(id))
        );
        
        for (const parent of parents) {
          if (!parent) {
            throw new TRPCError({ code: "NOT_FOUND", message: "One or more parent runs not found" });
          }
          if (parent.status !== "completed" || parent.iterationStage !== "stage_4_clickup_complete") {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: `Parent run #${parent.id} is not completed. Only completed parent variations can generate children.` 
            });
          }
          if (parent.variationLayer === "child") {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: `Run #${parent.id} is already a child variation. Cannot generate children from children.` 
            });
          }
        }

        // Start child generation for all selected parents
        const { generateChildVariationsForParents } = await import("./services/childVariationGeneration");
        
        generateChildVariationsForParents(input.parentRunIds, input.childCount).catch((err: any) => {
          console.error("[Pipeline] Child generation failed:", err);
        });

        return { 
          success: true, 
          message: `Generating ${input.childCount} children for each of ${input.parentRunIds.length} parents (${input.parentRunIds.length * input.childCount} total)`,
          totalChildren: input.parentRunIds.length * input.childCount
        };
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

    upload: protectedProcedure
      .input(z.object({
        product: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
        flavour: z.string().optional(),
        angle: z.string().optional(),
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
          flavour: input.flavour || null,
          angle: input.angle || null,
        });
        return { id, url, fileKey };
      }),

    listByFlavour: publicProcedure
      .input(z.object({ product: z.string(), flavour: z.string() }))
      .query(async ({ input }) => {
        return db.listProductRendersByFlavour(input.product, input.flavour);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProductRender(input.id);
        return { success: true };
      }),

    setDefault: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.setDefaultProductRender(input.id);
        return { success: true };
      }),
  }),

  // ============================================================
  // PEOPLE TYPE REFERENCE LIBRARY
  // ============================================================
  people: router({
    list: publicProcedure.query(async () => db.listPeople()),

    upload: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        description: z.string().optional(),
        tags: z.string().optional(),
        mimeType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileSize = buffer.length;
        const suffix = Math.random().toString(36).slice(2, 10);
        const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
        const fileKey = `people/${input.name.toLowerCase().replace(/\s+/g, "-")}-${suffix}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const id = await db.createPerson({
          name: input.name,
          description: input.description || null,
          tags: input.tags || null,
          fileKey,
          url,
          mimeType: input.mimeType,
          fileSize,
        });
        return { id, url, fileKey };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePerson(input.id);
        return { success: true };
      }),

    generate: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        description: z.string().min(1),
        tags: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `Generate a hyper-realistic portrait photograph of a person for use in fitness supplement advertising.
The image should look like a professional photoshoot, indistinguishable from a real photograph.
Shot on a high-end DSLR camera with shallow depth of field, natural skin texture, realistic lighting.
Studio or environmental lighting. No AI artifacts, no uncanny valley effects. The person should look completely real.
Professional color grading, sharp focus on the face, natural skin pores and texture visible.

Subject: ${input.description}

Style: Professional fitness/lifestyle photography. Magazine quality. The person should look like they could appear in a supplement brand campaign.`;

        const result = await generateProductAdWithNanoBananaPro({
          prompt,
          aspectRatio: "1:1",
          resolution: "2K",
          model: "nano_banana_pro",
          useCompositing: false,
        });

        const id = await db.createPerson({
          name: input.name,
          description: input.description,
          tags: input.tags || null,
          fileKey: result.s3Key,
          url: result.imageUrl,
          mimeType: "image/png",
        });

        return { id, url: result.imageUrl };
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

    upsert: protectedProcedure
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

    upload: protectedProcedure
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

    delete: protectedProcedure
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
    upload: protectedProcedure
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
    startExtraction: protectedProcedure
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
            const { compressAudioForWhisper } = await import("./services/audioCompression");
            const { unlink } = await import("fs/promises");
            
            // Step 1: Compress audio to meet Whisper's 16MB limit
            console.log(`[UGC] Starting audio compression for upload #${input.uploadId}, videoUrl: ${upload.videoUrl}`);
            const compressedAudioPath = await compressAudioForWhisper(upload.videoUrl);
            console.log(`[UGC] Audio compressed to: ${compressedAudioPath}`);
            
            // Step 2: Transcribe compressed audio
            console.log(`[UGC] Starting transcription...`);
            const transcriptResult = await transcribeAudio({ audioPath: compressedAudioPath });
            
            // Clean up compressed audio file
            await unlink(compressedAudioPath).catch(() => {});
            
            console.log(`[UGC] Transcription result:`, transcriptResult);
            if (!('text' in transcriptResult)) {
              const errorMsg = 'error' in transcriptResult ? transcriptResult.error : 'Unknown error';
              throw new Error(`Transcription failed: ${errorMsg}`);
            }
            console.log(`[UGC] Transcription successful, length: ${transcriptResult.text.length} chars`);
            
            // Step 3: Extract structure
            console.log(`[UGC] Starting structure extraction for upload #${input.uploadId}`);
            const blueprint = await extractStructureBlueprint(transcriptResult.text, upload.product);
            console.log(`[UGC] Structure extraction complete, blueprint:`, JSON.stringify(blueprint).substring(0, 200));
            await db.updateUgcUpload(input.uploadId, {
              status: "structure_extracted",
              transcript: transcriptResult.text,
              structureBlueprint: blueprint,
            });
          } catch (error: any) {
            console.error("[UGC] Extraction failed:", error);
            await db.updateUgcUpload(input.uploadId, {
              status: "failed",
              errorMessage: error.message,
            });
          }
        })();
        
        return { success: true, uploadId: input.uploadId };
      }),

    // Approve structure blueprint
    approveBlueprint: protectedProcedure
      .input(z.object({ uploadId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUgcUpload(input.uploadId, {
          status: "blueprint_approved",
          blueprintApprovedAt: new Date(),
        });
        return { success: true };
      }),

    // Generate variants
    generateVariants: protectedProcedure
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
              status: "failed",
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
    approveVariants: protectedProcedure
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
    rejectVariants: protectedProcedure
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
    pushToClickup: protectedProcedure
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

    // Retry transcription for a failed upload
    retryTranscription: protectedProcedure
      .input(z.object({ uploadId: z.number() }))
      .mutation(async ({ input }) => {
        const upload = await db.getUgcUpload(input.uploadId);
        if (!upload) throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
        
        // Reset to transcribing status
        await db.updateUgcUpload(input.uploadId, { status: "transcribing", errorMessage: null });
        
        // Re-run background transcription
        (async () => {
          try {
            console.log(`[UGC Retry] Retrying transcription for upload #${input.uploadId}`);
            const { transcribeVideo } = await import("./services/whisper");
            const { extractStructureBlueprint } = await import("./services/ugcClone");
            
            const transcriptText = await transcribeVideo(upload.videoUrl);
            console.log(`[UGC Retry] Transcription complete for upload #${input.uploadId}`);
            
            const blueprint = await extractStructureBlueprint(transcriptText, upload.videoUrl);
            console.log(`[UGC Retry] Structure extraction complete for upload #${input.uploadId}`);
            
            await db.updateUgcUpload(input.uploadId, {
              transcript: transcriptText,
              structureBlueprint: blueprint,
              status: "structure_extracted",
            });
          } catch (error: any) {
            console.error(`[UGC Retry] Failed for upload #${input.uploadId}:`, error);
            await db.updateUgcUpload(input.uploadId, {
              status: "failed",
              errorMessage: error.message,
            });
          }
        })();
        
        return { success: true };
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
    create: protectedProcedure
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
    update: protectedProcedure
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
    delete: protectedProcedure
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
