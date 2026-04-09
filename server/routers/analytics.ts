/**
 * Creative Analytics tRPC router (read-only).
 *
 * Endpoints:
 *   - getCreativePerformance: paginated table of creative performance with scores
 *   - getCreativePerformanceSummary: KPI strip aggregates (total spend, ROAS, etc.)
 *   - getCreativeDetail: full detail for a single creative (header + metrics + ads list)
 *   - getCreativeTimeSeries: daily spend + ROAS time series for the detail page chart
 *
 * All queries are protected (authenticated user). Admin-only sync controls live
 * in the separate adminSync router.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getCreativePerformance,
  getCreativePerformanceSummary,
  getCreativeTimeSeries,
  getCreativeRow,
  type CreativePerfQuery,
} from "../services/creativeAnalytics/reportService";
import { MetaAdsClient, type MetaAdPreviewFormat } from "../integrations/meta/metaAdsClient";
import * as db from "../db";

const sortByEnum = z.enum(["spendCents", "roasBp", "hookScore", "watchScore", "clickScore", "convertScore", "launchDate"]);
const sortDirEnum = z.enum(["asc", "desc"]);
const creativeTypeEnum = z.enum(["video", "image", "carousel"]).optional();

const creativePerfQuerySchema = z.object({
  dateFrom: z.date(),
  dateTo: z.date(),
  creativeType: creativeTypeEnum,
  campaignId: z.string().optional(),
  adAccountId: z.string().optional(),
  sortBy: sortByEnum.default("spendCents"),
  sortDirection: sortDirEnum.default("desc"),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
});

export const analyticsRouter = router({
  getCreativePerformance: protectedProcedure
    .input(creativePerfQuerySchema)
    .query(async ({ input }) => {
      const query: CreativePerfQuery = input;
      const rows = await getCreativePerformance(query);
      return { rows };
    }),

  getCreativePerformanceSummary: protectedProcedure
    .input(
      z.object({
        dateFrom: z.date(),
        dateTo: z.date(),
        creativeType: creativeTypeEnum,
        campaignId: z.string().optional(),
        adAccountId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getCreativePerformanceSummary(input);
    }),

  getCreativeDetail: protectedProcedure
    .input(z.object({ creativeAssetId: z.number().int() }))
    .query(async ({ input }) => {
      const asset = await db.getCreativeAssetById(input.creativeAssetId);
      if (!asset) return null;
      const ads = await db.listAdsForCreative(input.creativeAssetId);
      const latestScore = await db.getLatestCreativeScore(input.creativeAssetId);
      return {
        asset,
        ads,
        latestScore,
      };
    }),

  getCreativeTimeSeries: protectedProcedure
    .input(
      z.object({
        creativeAssetId: z.number().int(),
        dateFrom: z.date(),
        dateTo: z.date(),
      })
    )
    .query(async ({ input }) => {
      return getCreativeTimeSeries(input.creativeAssetId, input.dateFrom, input.dateTo);
    }),

  // Single-creative row lookup for AdDetail. Respects the caller's date range
  // (instead of hardcoding 30 days) and avoids the previous pattern of
  // refetching the top-500 list just to find one creative.
  getCreativeRow: protectedProcedure
    .input(
      z.object({
        creativeAssetId: z.number().int(),
        dateFrom: z.date(),
        dateTo: z.date(),
      })
    )
    .query(async ({ input }) => {
      return getCreativeRow(input.creativeAssetId, input.dateFrom, input.dateTo);
    }),

  /**
   * Fetch a signed Meta Ad Preview iframe for a creative.
   *
   * Picks the most-recently-launched ad that uses this creative as the
   * representative (matching what Motion does — one preview per creative
   * even when N ads reuse the same asset) and returns the iframe src so
   * the frontend can embed it directly.
   *
   * Uses Meta's /ads/{id}/previews endpoint because /videos/{id}?fields=source
   * is denied for our System User token. The iframe renders the full ad
   * (video + copy + CTA) exactly as it appears on Facebook/Instagram, which
   * is a better creative review UX than a bare MP4 anyway.
   */
  getAdPreview: protectedProcedure
    .input(
      z.object({
        creativeAssetId: z.number().int(),
        format: z
          .enum([
            "MOBILE_FEED_STANDARD",
            "DESKTOP_FEED_STANDARD",
            "INSTAGRAM_STANDARD",
            "INSTAGRAM_STORY",
            "INSTAGRAM_REELS",
          ])
          .default("MOBILE_FEED_STANDARD"),
      })
    )
    .query(async ({ input }) => {
      const ads = await db.listAdsForCreative(input.creativeAssetId);
      if (ads.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No ads found for this creative. Meta sync may not have caught up yet.",
        });
      }
      // listAdsForCreative already sorts by launchDate DESC — first row is
      // the most-recently-launched ad using this creative.
      const representativeAd = ads[0];
      const externalAdId = representativeAd.externalAdId;
      if (!externalAdId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Representative ad has no externalAdId.",
        });
      }

      try {
        const client = new MetaAdsClient();
        const preview = await client.getAdPreview(externalAdId, input.format as MetaAdPreviewFormat);
        return {
          adId: externalAdId,
          adName: representativeAd.name,
          format: input.format,
          iframeSrc: preview.iframeSrc,
          body: preview.body,
          permalink: representativeAd.permalink ?? null,
        };
      } catch (err: any) {
        // Surface a typed error so the dialog can show a graceful fallback.
        const status = err?.response?.status;
        const metaMessage = err?.response?.data?.error?.message ?? err?.message ?? "Unknown Meta API error";
        throw new TRPCError({
          code: status === 404 ? "NOT_FOUND" : "BAD_GATEWAY",
          message: `Meta preview failed: ${metaMessage}`,
          cause: err,
        });
      }
    }),
});
