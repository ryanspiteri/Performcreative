import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateIterationPSD } from "../services/psdBuilder";
import { storagePut } from "../storage";
import * as db from "../db";

/**
 * PSD Export Router
 * Handles generation and download of PSD files with editable layers
 */

export const psdRouter = router({
  /**
   * Generate PSD from iteration variation
   * Returns a download URL for the PSD file
   */
  generateFromIteration: publicProcedure
    .input(
      z.object({
        runId: z.number(),
        variationIndex: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });
      }

      try {
        // Get the pipeline run
        const run = await db.getPipelineRun(input.runId);
        if (!run) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline run not found" });
        }

        // Get variation data
        const variations = run.iterationVariations as any[];
        if (!variations || variations.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No variations found" });
        }

        const variation = variations[input.variationIndex];
        if (!variation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Variation not found" });
        }

        // Extract image URLs
        const compositeImageUrl = variation.url; // The final composited image
        const productImageUrl = variation.productImageUrl || run.iterationSourceUrl; // Product render
        const controlImageUrl = variation.controlImageUrl || run.iterationSourceUrl; // Control/source image

        if (!compositeImageUrl) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Missing composite image URL for PSD generation",
          });
        }

        // For PSD, we use the control image as background since we don't have separate background
        const backgroundImageUrl = controlImageUrl;

        // Get dimensions from aspect ratio
        const aspectRatio = run.aspectRatio || "1:1";
        let width = 1080;
        let height = 1080;

        if (aspectRatio === "4:5") {
          width = 1080;
          height = 1350;
        } else if (aspectRatio === "9:16") {
          width = 1080;
          height = 1920;
        }

        // Generate PSD
        console.log(`[PSD] Generating PSD for run ${input.runId}, variation ${input.variationIndex}`);
        const result = await generateIterationPSD({
          runId: input.runId,
          variationIndex: input.variationIndex,
          variationData: variation,
          width,
          height,
        });

        console.log(`[PSD] Generated and uploaded PSD: ${result.url}`);

        return {
          url: result.url,
          fileName: result.fileName,
          fileSize: 0, // Size not available in simplified approach
        };
      } catch (error) {
        console.error("[PSD] Generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `PSD generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),
});
