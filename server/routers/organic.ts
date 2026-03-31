import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { runOrganicVideoStages1to3, approveTranscript } from "../services/organicVideoPipeline";
import { generateCaption, generateBatchCaptions } from "../services/captionGenerator";
import { checkHealth } from "../services/autoEditClient";
import { runVisualContentPipeline } from "../services/visualContentPipeline";
import { storagePut } from "../storage";

export const organicRouter = router({
  // ──────────────────────────────────────────────────────────────────────────
  // Video Pipeline
  // ──────────────────────────────────────────────────────────────────────────

  triggerVideo: protectedProcedure
    .input(
      z.object({
        videoInputPaths: z.array(z.string()).min(1).max(10),
        subtitleStyle: z.string().default("tiktok_bold"),
        contentPillar: z.string().optional(),
        contentPurpose: z.string().optional(),
        topic: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const runId = await db.createOrganicRun({
        type: "organic_video",
        status: "running",
        stage: "uploading",
        videoInputPath: JSON.stringify(input.videoInputPaths),
        subtitleStyle: input.subtitleStyle,
        contentPillar: input.contentPillar,
        contentPurpose: input.contentPurpose,
        topic: input.topic,
      });

      // Fire-and-forget: run stages 1-3 in the background
      runOrganicVideoStages1to3(runId, {
        videoInputPaths: input.videoInputPaths,
        subtitleStyle: input.subtitleStyle as any,
        contentPillar: input.contentPillar,
        contentPurpose: input.contentPurpose,
        topic: input.topic,
      }).catch((err) => {
        console.error(`[Organic] triggerVideo background failed for run #${runId}:`, err.message);
      });

      return { runId };
    }),

  approveTranscript: protectedProcedure
    .input(
      z.object({
        runId: z.number(),
        editedSegments: z
          .array(
            z.object({
              word: z.string(),
              start: z.number(),
              end: z.number(),
              confidence: z.number(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await approveTranscript(input.runId, input.editedSegments);
      return { success: true };
    }),

  getRun: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const run = await db.getOrganicRun(input.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Organic run #${input.id} not found` });
      }
      return run;
    }),

  // ──────────────────────────────────────────────────────────────────────────
  // Caption Generator
  // ──────────────────────────────────────────────────────────────────────────

  generateCaption: protectedProcedure
    .input(
      z.object({
        pillar: z.string(),
        purpose: z.string(),
        topic: z.string(),
        context: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await generateCaption(input);
      return { captions: result };
    }),

  generateBatchCaptions: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              pillar: z.string(),
              purpose: z.string(),
              topic: z.string(),
              context: z.string().optional(),
            }),
          )
          .max(20),
      }),
    )
    .mutation(async ({ input }) => {
      const results = await generateBatchCaptions(input.items);
      return results;
    }),

  // ──────────────────────────────────────────────────────────────────────────
  // Caption Examples
  // ──────────────────────────────────────────────────────────────────────────

  addCaptionExample: protectedProcedure
    .input(
      z.object({
        pillar: z.string(),
        purpose: z.string(),
        topic: z.string(),
        platform: z.string(),
        captionText: z.string(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await db.createCaptionExample(input);
      return { id };
    }),

  listCaptionExamples: publicProcedure
    .input(
      z.object({
        pillar: z.string().optional(),
        purpose: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const examples = await db.listCaptionExamples(input.pillar, input.purpose);
      return examples;
    }),

  deleteCaptionExample: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCaptionExample(input.id);
      return { success: true };
    }),

  // ──────────────────────────────────────────────────────────────────────────
  // Content Library
  // ──────────────────────────────────────────────────────────────────────────

  listContent: publicProcedure.query(async () => {
    const content = await db.listAllContent();
    return content;
  }),

  listOrganicRuns: publicProcedure
    .input(
      z.object({
        type: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const runs = await db.listOrganicRuns(input.type);
      return runs;
    }),

  // ──────────────────────────────────────────────────────────────────────────
  // AutoEdit
  // ──────────────────────────────────────────────────────────────────────────

  checkAutoEditHealth: publicProcedure.query(async () => {
    const available = await checkHealth();
    return { available };
  }),

  // ──────────────────────────────────────────────────────────────────────────
  // Visual Content Pipeline
  // ──────────────────────────────────────────────────────────────────────────

  triggerVisualContent: publicProcedure
    .input(
      z.object({
        pillar: z.string(),
        purpose: z.string(),
        topic: z.string(),
        format: z.enum(["single", "carousel"]),
        slideCount: z.number().min(1).max(8),
        slides: z.array(
          z.object({
            source: z.enum(["ai", "upload"]),
            headline: z.string().default(""),
            body: z.string().default(""),
            uploadedImageUrl: z.string().optional(),
          }),
        ),
        product: z.string().optional(),
        overlayProduct: z.boolean().default(false),
        aspectRatio: z.enum(["1:1", "4:5", "9:16"]).default("1:1"),
      }),
    )
    .mutation(async ({ input }) => {
      const runId = await db.createOrganicRun({
        type: "visual_content",
        status: "running",
        stage: "planning",
        contentPillar: input.pillar,
        contentPurpose: input.purpose,
        topic: input.topic,
        contentFormat: input.format,
        slideCount: input.slideCount,
        product: input.product || null,
        slidesJson: JSON.stringify(input.slides),
      });

      runVisualContentPipeline(runId, input).catch((err) => {
        console.error(`[VisualContent] Background pipeline failed for run #${runId}:`, err.message);
      });

      return { runId };
    }),

  uploadSlideImage: publicProcedure
    .input(
      z.object({
        base64Data: z.string(),
        mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        fileName: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const suffix = Math.random().toString(36).slice(2, 8);
      const s3Key = `visual-content/uploads/${Date.now()}-${suffix}-${input.fileName}`;
      const { url } = await storagePut(s3Key, buffer, input.mimeType);
      return { imageUrl: url, s3Key };
    }),
});
