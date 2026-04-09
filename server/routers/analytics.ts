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
   * Fetch the best-available Meta preview URLs for a creative.
   *
   * Picks the most-recently-launched ad that uses this creative and returns
   * multiple URLs the frontend can use to open the ad preview in a NEW TAB.
   *
   * Why a new tab and not an inline iframe: Meta's preview iframe
   * (business.facebook.com/ads/api/preview_iframe.php) and the shareable
   * fb.me link both require a Facebook Business login session. Modern
   * browsers block third-party cookies in cross-origin iframes, so the
   * iframe loads Meta's auth-check page instead of the ad and renders as
   * a broken-doc icon. Opening in a new tab is a top-level navigation →
   * cookies work → FB login context applies → preview renders correctly.
   *
   * Returned URL priority (frontend picks first non-null):
   *   1. previewShareableLink (fb.me short link) — mobile-friendly
   *   2. adPermalinkUrl        — direct Facebook ad post URL (if we have it)
   *   3. iframeSrc             — signed preview_iframe URL as last resort
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

      const client = new MetaAdsClient();

      // Fetch preview_shareable_link + the iframe preview in parallel.
      // Either can fail independently; we want to return whatever works.
      const [shareableRes, previewRes] = await Promise.allSettled([
        client.getAdShareableLink(externalAdId),
        client.getAdPreview(externalAdId, input.format as MetaAdPreviewFormat),
      ]);

      const previewShareableLink =
        shareableRes.status === "fulfilled" ? shareableRes.value : null;
      const preview =
        previewRes.status === "fulfilled" ? previewRes.value : null;

      // If BOTH calls failed, surface the clearer error (shareable link
      // tends to have the cleaner failure message).
      if (!previewShareableLink && !preview) {
        const err: any =
          shareableRes.status === "rejected"
            ? shareableRes.reason
            : previewRes.status === "rejected"
              ? previewRes.reason
              : new Error("Unknown Meta API error");
        const status = err?.response?.status;
        const metaMessage =
          err?.response?.data?.error?.message ?? err?.message ?? "Unknown Meta API error";
        throw new TRPCError({
          code: status === 404 ? "NOT_FOUND" : "BAD_GATEWAY",
          message: `Meta preview failed: ${metaMessage}`,
          cause: err,
        });
      }

      return {
        adId: externalAdId,
        adName: representativeAd.name,
        format: input.format,
        previewShareableLink,
        iframeSrc: preview?.iframeSrc ?? null,
        adPermalinkUrl: representativeAd.permalink ?? null,
      };
    }),
});
