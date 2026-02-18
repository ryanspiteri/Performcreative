import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { fetchVideoAds, fetchStaticAds, listBoards } from "./services/foreplay";
import { analyzeVideoFrames, generateScripts, reviewScript, analyzeStaticAd } from "./services/claude";
import { transcribeVideo } from "./services/whisper";
import { createMultipleScriptTasks } from "./services/clickup";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { SignJWT } from "jose";

const VALID_USERNAME = "ONEST";
const VALID_PASSWORD = "UnlockGrowth";

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

    triggerVideo: publicProcedure
      .input(z.object({ product: z.string(), priority: z.enum(["Low", "Medium", "High", "Urgent"]) }))
      .mutation(async ({ input }) => {
        const runId = await db.createPipelineRun({
          pipelineType: "video",
          status: "running",
          product: input.product,
          priority: input.priority,
          triggerSource: "manual",
        });
        runVideoPipeline(runId, input.product, input.priority).catch(err => {
          console.error("[Pipeline] Video pipeline failed:", err);
          db.updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Pipeline failed" });
        });
        return { runId, status: "running" };
      }),

    fetchForeplayVideos: publicProcedure.query(async () => fetchVideoAds(10)),
    fetchForeplayStatics: publicProcedure.query(async () => fetchStaticAds(30)),
    listBoards: publicProcedure.query(async () => listBoards()),

    triggerStatic: publicProcedure
      .input(z.object({
        product: z.string(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]),
        selectedAdIds: z.array(z.string()),
        selectedAdImages: z.array(z.object({
          id: z.string(),
          imageUrl: z.string(),
          brandName: z.string().optional(),
          title: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const runId = await db.createPipelineRun({
          pipelineType: "static",
          status: "running",
          product: input.product,
          priority: input.priority,
          triggerSource: "manual",
          staticAdImages: input.selectedAdImages,
        });
        runStaticPipeline(runId, input).catch(err => {
          console.error("[Pipeline] Static pipeline failed:", err);
          db.updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Static pipeline failed" });
        });
        return { runId, status: "running" };
      }),
  }),
});

async function runVideoPipeline(runId: number, product: string, priority: string) {
  console.log(`[Pipeline] Starting video pipeline run #${runId}`);
  console.log("[Pipeline] Step 1: Fetching from Foreplay...");
  const ads = await fetchVideoAds(5);
  if (ads.length === 0) throw new Error("No video ads found on Foreplay board");
  const ad = ads[0];
  await db.updatePipelineRun(runId, {
    foreplayAdId: ad.id,
    foreplayAdTitle: ad.title || "Untitled",
    foreplayAdBrand: ad.brandName || "Unknown",
    videoUrl: ad.mediaUrl || "",
    thumbnailUrl: ad.thumbnailUrl || "",
  });

  console.log("[Pipeline] Step 2: Transcribing video...");
  let transcript = "";
  try {
    if (ad.mediaUrl) transcript = await transcribeVideo(ad.mediaUrl);
  } catch (err: any) {
    console.warn("[Pipeline] Transcription failed:", err.message);
    transcript = "Transcription unavailable - video could not be processed.";
  }
  await db.updatePipelineRun(runId, { transcript });

  console.log("[Pipeline] Step 3: Running visual analysis...");
  const visualAnalysis = await analyzeVideoFrames(ad.mediaUrl || "", transcript, ad.brandName || "Competitor");
  await db.updatePipelineRun(runId, { visualAnalysis });

  console.log("[Pipeline] Step 4: Generating scripts...");
  const scriptConfigs = [
    { type: "DR" as const, num: 1 },
    { type: "DR" as const, num: 2 },
    { type: "UGC" as const, num: 1 },
    { type: "UGC" as const, num: 2 },
  ];
  const allScripts: any[] = [];
  for (const config of scriptConfigs) {
    console.log(`[Pipeline] Generating ${config.type}${config.num}...`);
    const script = await generateScripts(transcript, visualAnalysis, product, config.type, config.num);
    console.log(`[Pipeline] Running expert review for ${config.type}${config.num}...`);
    const review = await reviewScript(script, product, config.type);
    allScripts.push({ type: config.type, number: config.num, label: `${config.type}${config.num}`, ...script, review });
  }
  await db.updatePipelineRun(runId, { scriptsJson: allScripts });

  console.log("[Pipeline] Step 6: Creating ClickUp tasks...");
  const taskInputs = allScripts.map(s => ({
    title: s.title || `${s.type}${s.number} Script`,
    type: s.label,
    score: s.review.finalScore,
    content: formatScriptForClickUp(s),
  }));
  const clickupTasks = await createMultipleScriptTasks(taskInputs, product, priority);
  await db.updatePipelineRun(runId, { clickupTasksJson: clickupTasks, status: "completed", completedAt: new Date() });
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

async function runStaticPipeline(runId: number, input: any) {
  console.log(`[Pipeline] Starting static pipeline run #${runId}`);
  const analyses: string[] = [];
  for (const ad of input.selectedAdImages) {
    if (ad.imageUrl) {
      const analysis = await analyzeStaticAd(ad.imageUrl, ad.brandName || "Competitor");
      analyses.push(analysis);
    }
  }
  await db.updatePipelineRun(runId, { staticAnalysis: analyses.join("\n\n---\n\n") });
  try {
    const { generateImage } = await import("./_core/imageGeneration");
    const prompt = `Create a premium health supplement advertisement for ONEST Health. Dark background (#01040A). Product: ${input.product}. Style: modern, clean, professional fitness/health aesthetic. Bold typography and vibrant product imagery. Brand colors: deep black, white text, orange accents (#FF3838), electric blue (#0347ED).`;
    const result = await generateImage({ prompt });
    await db.updatePipelineRun(runId, { generatedImageUrl: result.url, status: "completed", completedAt: new Date() });
  } catch (err: any) {
    console.warn("[Pipeline] Image generation failed:", err.message);
    await db.updatePipelineRun(runId, { status: "completed", completedAt: new Date(), errorMessage: "Image generation unavailable: " + err.message });
  }
  console.log(`[Pipeline] Static pipeline run #${runId} completed!`);
}

export type AppRouter = typeof appRouter;
