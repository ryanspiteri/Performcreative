import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { runOrganicVideoStages1to3, approveTranscript } from "../services/organicVideoPipeline";
import { generateCaption, generateBatchCaptions } from "../services/captionGenerator";
import { checkHealth } from "../services/autoEditClient";

export const organicRouter = router({
  // ──────────────────────────────────────────────────────────────────────────
  // Video Pipeline
  // ──────────────────────────────────────────────────────────────────────────

  triggerVideo: publicProcedure
    .input(
      z.object({
        videoInputPath: z.string(),
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
        videoInputPath: input.videoInputPath,
        subtitleStyle: input.subtitleStyle,
        contentPillar: input.contentPillar,
        contentPurpose: input.contentPurpose,
        topic: input.topic,
      });

      // Fire-and-forget: run stages 1-3 in the background
      runOrganicVideoStages1to3(runId, {
        videoInputPath: input.videoInputPath,
        subtitleStyle: input.subtitleStyle as any,
        contentPillar: input.contentPillar,
        contentPurpose: input.contentPurpose,
        topic: input.topic,
      }).catch((err) => {
        console.error(`[Organic] triggerVideo background failed for run #${runId}:`, err.message);
      });

      return { runId };
    }),

  approveTranscript: publicProcedure
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

  generateCaption: publicProcedure
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
      return result;
    }),

  generateBatchCaptions: publicProcedure
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

  addCaptionExample: publicProcedure
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

  deleteCaptionExample: publicProcedure
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
});
