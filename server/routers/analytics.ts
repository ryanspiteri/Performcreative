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
import { refreshAccessToken, computeExpiresAt } from "../services/meta";
import * as db from "../db";

const sortByEnum = z.enum(["spendCents", "revenueCents", "roasBp", "hookScore", "watchScore", "clickScore", "convertScore", "launchDate"]);
const sortDirEnum = z.enum(["asc", "desc"]);
const creativeTypeEnum = z.enum(["video", "image", "carousel"]).optional();

const creativePerfQuerySchema = z.object({
  dateFrom: z.date(),
  dateTo: z.date(),
  creativeType: creativeTypeEnum,
  campaignId: z.string().optional(),
  adAccountId: z.string().optional(),
  minSpendCents: z.number().int().min(0).optional(),
  // Wave 1e — AI tag filters
  messagingAngle: z.string().optional(),
  hookTactic: z.string().optional(),
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

  /**
   * Return distinct campaigns + ad accounts for the filter dropdowns.
   * Auto-updates as new campaigns sync — no hardcoding.
   */
  getFilterOptions: protectedProcedure.query(async () => {
    const dbConn = await db.getDb();
    if (!dbConn) return { campaigns: [], adAccounts: [] };

    const { sql: sqlTag } = await import("drizzle-orm");

    const campaignRows: any = await dbConn.execute(sqlTag`
      SELECT DISTINCT a.campaignId, a.campaignName
      FROM ads a
      WHERE a.campaignId IS NOT NULL AND a.campaignName IS NOT NULL
      ORDER BY a.campaignName ASC
      LIMIT 200
    `);
    const campaigns = (Array.isArray(campaignRows[0]) ? campaignRows[0] : campaignRows).map(
      (r: any) => ({ id: r.campaignId as string, name: r.campaignName as string }),
    );

    const accountRows: any = await dbConn.execute(sqlTag`
      SELECT DISTINCT a.adAccountId
      FROM ads a
      WHERE a.adAccountId IS NOT NULL
      ORDER BY a.adAccountId ASC
    `);
    const adAccounts = (Array.isArray(accountRows[0]) ? accountRows[0] : accountRows).map(
      (r: any) => r.adAccountId as string,
    );

    return { campaigns, adAccounts };
  }),

  /**
   * Wave 1e — Return distinct AI tag values (messagingAngle, hookTactic) that
   * have at least one tagged creative. Used to populate the tag filter
   * dropdowns on the Creative Performance page.
   */
  getTagFilterOptions: protectedProcedure.query(async () => {
    const dbConn = await db.getDb();
    if (!dbConn) return { messagingAngles: [], hookTactics: [] };

    const { sql: sqlTag } = await import("drizzle-orm");

    const angleRows: any = await dbConn.execute(sqlTag`
      SELECT messagingAngle, COUNT(*) AS cnt
      FROM creativeAiTags
      WHERE messagingAngle IS NOT NULL AND messagingAngle != ''
      GROUP BY messagingAngle
      ORDER BY cnt DESC
    `);
    const tacticRows: any = await dbConn.execute(sqlTag`
      SELECT hookTactic, COUNT(*) AS cnt
      FROM creativeAiTags
      WHERE hookTactic IS NOT NULL AND hookTactic != ''
      GROUP BY hookTactic
      ORDER BY cnt DESC
    `);

    return {
      messagingAngles: (Array.isArray(angleRows[0]) ? angleRows[0] : angleRows).map(
        (r: any) => ({ value: r.messagingAngle as string, count: Number(r.cnt) || 0 }),
      ),
      hookTactics: (Array.isArray(tacticRows[0]) ? tacticRows[0] : tacticRows).map(
        (r: any) => ({ value: r.hookTactic as string, count: Number(r.cnt) || 0 }),
      ),
    };
  }),

  /**
   * Wave 2 — Fatigue detection. Returns a map of creativeAssetId → fatigue status
   * for creatives where this week's scores are 15%+ below last week's.
   */
  getFatigueMap: protectedProcedure
    .input(z.object({ creativeAssetIds: z.array(z.number().int()).max(200) }))
    .query(async ({ input }) => {
      const { getFatigueMap } = await import("../services/creativeAnalytics/fatigueDetector");
      return getFatigueMap(input.creativeAssetIds);
    }),

  getCreativeDetail: protectedProcedure
    .input(z.object({ creativeAssetId: z.number().int() }))
    .query(async ({ input }) => {
      const asset = await db.getCreativeAssetById(input.creativeAssetId);
      if (!asset) return null;
      const [ads, latestScore, aiTag] = await Promise.all([
        db.listAdsForCreative(input.creativeAssetId),
        db.getLatestCreativeScore(input.creativeAssetId),
        db.getCreativeAiTag(input.creativeAssetId).catch(() => null),
      ]);
      return {
        asset,
        ads,
        latestScore,
        aiTag,
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

      // Fetch the creative asset so we can extract a video_id for the native
      // player path below.
      const creativeAsset = await db.getCreativeAssetById(input.creativeAssetId);
      const metaVideoId = extractVideoIdFromUrl(creativeAsset?.videoUrl ?? null);

      // --- Path 1: user-token native video source (preferred when connected) ---
      //
      // If an admin has connected their Facebook account via /settings AND the
      // creative is a video AND we can resolve its Meta video_id, try to fetch
      // the signed MP4 source URL. This is the "play inline" path.
      //
      // Token refresh runs here too: if the stored token is expired, exchange
      // it for a fresh long-lived token before calling. On refresh failure,
      // clear the token silently and fall through to the shareable-link path —
      // the user will see the fallback UI until they reconnect.
      let videoSourceUrl: string | null = null;
      let videoLength: number | null = null;
      let userTokenUsed = false;
      let userTokenRefreshAttempted = false;
      let userTokenError: string | null = null;

      if (metaVideoId && creativeAsset?.creativeType === "video") {
        try {
          const adminTokens = await db.getAdminMetaTokens();
          if (adminTokens?.accessToken) {
            let token = adminTokens.accessToken;
            const now = new Date();
            const expiresAt = adminTokens.expiresAt ? new Date(adminTokens.expiresAt) : null;
            if (expiresAt && expiresAt.getTime() < now.getTime()) {
              // Expired — attempt refresh.
              userTokenRefreshAttempted = true;
              try {
                const refreshed = await refreshAccessToken(token);
                token = refreshed.access_token;
                const newExpiresAt = computeExpiresAt(refreshed);
                await db.updateUserMetaTokens(adminTokens.openId!, token, newExpiresAt);
              } catch (refreshErr: any) {
                // Refresh failed — clear token and fall through.
                console.warn(
                  `[meta.getAdPreview] Token refresh failed, clearing:`,
                  refreshErr?.message ?? refreshErr,
                );
                await db.updateUserMetaTokens(adminTokens.openId!, null, null);
                throw refreshErr;
              }
            }

            const videoSource = await client.getVideoSource(metaVideoId, token);
            if (videoSource.source) {
              videoSourceUrl = videoSource.source;
              videoLength = videoSource.length;
              userTokenUsed = true;
            }
          }
        } catch (err: any) {
          userTokenError =
            err?.response?.data?.error?.message ??
            err?.message ??
            "Unknown error fetching video source";
          console.warn(`[meta.getAdPreview] user-token video source failed: ${userTokenError}`);
          // Fall through to the shareable-link path — not a fatal error.
        }
      }

      // --- Path 2: fallback shareable link + iframe (PR #5 behavior) ---
      //
      // Always fetch these in parallel. They're used as a fallback if the
      // user token path didn't produce a sourceUrl (creative isn't a video,
      // no token connected, token refresh failed, Meta permission denied).
      const [shareableRes, previewRes] = await Promise.allSettled([
        client.getAdShareableLink(externalAdId),
        client.getAdPreview(externalAdId, input.format as MetaAdPreviewFormat),
      ]);

      const previewShareableLink =
        shareableRes.status === "fulfilled" ? shareableRes.value : null;
      const preview =
        previewRes.status === "fulfilled" ? previewRes.value : null;

      // If BOTH calls failed AND we don't have a video source URL, there's
      // nothing to return. Surface the clearest error.
      if (!videoSourceUrl && !previewShareableLink && !preview) {
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
        // Native video path (preferred) — null if user token path didn't work
        sourceUrl: videoSourceUrl,
        videoLength,
        // Fallback paths (always populated when available)
        previewShareableLink,
        iframeSrc: preview?.iframeSrc ?? null,
        adPermalinkUrl: representativeAd.permalink ?? null,
        thumbnailUrl: creativeAsset?.thumbnailUrl ?? null,
        creativeType: creativeAsset?.creativeType ?? null,
        // Diagnostics — surfaced in the dialog for error states
        providerUsed: userTokenUsed
          ? ("user-video-source" as const)
          : previewShareableLink
            ? ("shareable-link" as const)
            : ("iframe-fallback" as const),
        userTokenRefreshAttempted,
        userTokenError,
      };
    }),
});

/**
 * Extract the Meta video_id from a `videoUrl` stored on a creativeAsset.
 * The Meta sync writes these as `https://www.facebook.com/watch/?v={videoId}`.
 * Returns null if the URL is empty or doesn't match the expected shape.
 */
function extractVideoIdFromUrl(videoUrl: string | null | undefined): string | null {
  if (!videoUrl) return null;
  const match = videoUrl.match(/[?&]v=(\d+)/);
  return match?.[1] ?? null;
}
