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
import {
  getCreativePerformance,
  getCreativePerformanceSummary,
  getCreativeTimeSeries,
  getCreativeRow,
  type CreativePerfQuery,
} from "../services/creativeAnalytics/reportService";
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
});
