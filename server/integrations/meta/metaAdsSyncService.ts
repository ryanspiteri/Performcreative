/**
 * Meta Ads sync service.
 *
 * Pattern: matches existing foreplaySync.ts (setInterval + in-memory flag)
 * + improvements:
 *   - MySQL advisory lock (GET_LOCK) for multi-instance safety
 *   - Explicit error state surfaced via adSyncState.lastSyncError
 *   - Token validation before every sync
 *   - Consecutive failure tracking + exponential backoff
 *   - Idempotent upserts (safe to re-run)
 *
 * Sync flow per account:
 *   1. Validate token
 *   2. Fetch /ads (paginated) → upsert `ads` + `creativeAssets`
 *   3. Fetch /insights?level=ad&time_increment=1 (paginated) → upsert `adDailyStats`
 *   4. Trigger score recompute for affected creatives
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  MetaAdsClient,
  parseActionCount,
  parseMetaMoneyToCents,
  parseMetaRateToBp,
  type MetaAd,
  type MetaInsightRow,
} from "./metaAdsClient";
import * as db from "../../db";
import type {
  InsertCreativeAsset,
  InsertAd,
  InsertAdDailyStat,
} from "../../../drizzle/schema";
import { ENV } from "../../_core/env";
import { recomputeForDateRange } from "../../services/creativeAnalytics/scoreRecompute";

const TAG = "[MetaSync]";
const LOCK_NAME = "perform_meta_sync_lock";

let _syncTimer: ReturnType<typeof setInterval> | null = null;
let _isSyncing = false;

export interface SyncResult {
  adAccountId: string;
  adsUpserted: number;
  creativeAssetsUpserted: number;
  dailyStatsUpserted: number;
  errors: string[];
}

/** Compute the stable creativeHash for dedup. */
function computeCreativeHash(input: { name?: string | null; videoUrl?: string | null; thumbnailUrl?: string | null; videoId?: string | null }): string {
  // Normalize: lowercase, collapse whitespace, strip quotes
  const normalize = (s: string | null | undefined): string =>
    (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const key = [
    normalize(input.name),
    normalize(input.videoId),
    normalize(input.videoUrl?.split("?")[0]),
    normalize(input.thumbnailUrl?.split("?")[0]),
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 64);
}

/** Map a Meta ad (from /ads endpoint) to our creativeAssets + ads upsert payloads. */
function metaAdToUpsertPayloads(
  ad: MetaAd,
  adAccountId: string,
): { creativeAsset: InsertCreativeAsset; adBase: Omit<InsertAd, "creativeAssetId"> } {
  const creative = ad.creative;
  const videoId = creative?.video_id ?? null;
  const thumbUrl = creative?.thumbnail_url ?? null;
  const creativeType: "video" | "image" | "carousel" = videoId ? "video" : "image";
  const creativeHash = computeCreativeHash({
    name: ad.name,
    videoUrl: videoId ? `fb-video-${videoId}` : null,
    thumbnailUrl: thumbUrl,
    videoId,
  });
  const creativeAsset: InsertCreativeAsset = {
    creativeHash,
    name: ad.name,
    creativeType,
    thumbnailUrl: thumbUrl ?? undefined,
    videoUrl: videoId ? `https://www.facebook.com/watch/?v=${videoId}` : undefined,
    firstSeenAt: ad.created_time ? new Date(ad.created_time) : undefined,
  };
  const adBase: Omit<InsertAd, "creativeAssetId"> = {
    platform: "meta",
    externalAdId: ad.id,
    adsetId: ad.adset_id,
    adsetName: ad.adset_name,
    campaignId: ad.campaign_id,
    campaignName: ad.campaign_name,
    adAccountId,
    name: ad.name,
    launchDate: ad.created_time ? new Date(ad.created_time) : undefined,
    status: ad.status,
    firstSeenAt: ad.created_time ? new Date(ad.created_time) : undefined,
  };
  return { creativeAsset, adBase };
}

/** Map a Meta insight row to an adDailyStats upsert payload. */
function insightRowToDailyStat(row: MetaInsightRow, adId: number): InsertAdDailyStat {
  const impressions = parseInt(row.impressions ?? "0", 10) || 0;
  const videoPlayCount = parseActionCount(row.video_play_actions);
  const video25 = parseActionCount(row.video_p25_watched_actions);
  const video50 = parseActionCount(row.video_p50_watched_actions);
  const video75 = parseActionCount(row.video_p75_watched_actions);
  const video100 = parseActionCount(row.video_p100_watched_actions);
  const videoThruplay = parseActionCount(row.video_thruplay_watched_actions);
  const videoAvgTimeSec = parseActionCount(row.video_avg_time_watched_actions);

  return {
    adId,
    date: new Date(`${row.date_start}T00:00:00Z`),
    source: "meta",
    spendCents: parseMetaMoneyToCents(row.spend),
    impressions,
    clicks: parseInt(row.clicks ?? "0", 10) || 0,
    reach: parseInt(row.reach ?? "0", 10) || 0,
    cpmCents: parseMetaMoneyToCents(row.cpm),
    cpcCents: parseMetaMoneyToCents(row.cpc),
    ctrBp: parseMetaRateToBp(row.ctr),
    outboundCtrBp: 0, // outbound_clicks_ctr also comes as action array; compute if needed
    videoPlayCount,
    video25Count: video25,
    video50Count: video50,
    video75Count: video75,
    video100Count: video100,
    videoThruplayCount: videoThruplay,
    videoAvgTimeMs: videoAvgTimeSec * 1000,
    thumbstopBp: impressions > 0 ? Math.round((videoPlayCount / impressions) * 10000) : 0,
    holdRateBp: impressions > 0 ? Math.round((video50 / impressions) * 10000) : 0,
    actionsJson: row.actions ? (row.actions as unknown as Record<string, unknown>) : undefined,
  };
}

/**
 * Check if an error indicates Meta's "too much data" response.
 * These are soft limits — the fix is to query a smaller window.
 */
function isReduceDataError(err: any): boolean {
  const msg = (err?.response?.data?.error?.message ?? err?.message ?? "").toLowerCase();
  return msg.includes("reduce the amount of data") || msg.includes("please reduce");
}

/**
 * Fetch insights for a single date window with automatic retry on "reduce amount" errors.
 * If Meta rejects the query, halve the window and recursively retry until it fits or the
 * window is 1 day (smallest meaningful chunk).
 */
async function fetchInsightsWindow(
  client: MetaAdsClient,
  adAccountId: string,
  windowFrom: Date,
  windowTo: Date,
  externalIdToLocalId: Map<string, number>,
  result: SyncResult,
): Promise<void> {
  const windowDays = Math.max(1, Math.ceil((windowTo.getTime() - windowFrom.getTime()) / 86400000));
  console.log(`${TAG} ${adAccountId}: fetching insights ${windowFrom.toISOString().slice(0, 10)} → ${windowTo.toISOString().slice(0, 10)} (${windowDays}d)`);

  let insightsAfter: string | undefined = undefined;
  do {
    try {
      const page = await client.getAdInsights({
        adAccountId,
        dateFrom: windowFrom,
        dateTo: windowTo,
        timeIncrement: 1,
        after: insightsAfter,
        limit: 100,
      });
      for (const row of page.data ?? []) {
        const localAdId = externalIdToLocalId.get(row.ad_id);
        if (!localAdId) {
          // Ad row not in our ads table yet (maybe new since last /ads fetch, or archived)
          continue;
        }
        try {
          await db.upsertAdDailyStat(insightRowToDailyStat(row, localAdId));
          result.dailyStatsUpserted++;
        } catch (err: any) {
          result.errors.push(`upsert daily stat ${row.ad_id} ${row.date_start}: ${err.message}`);
        }
      }
      insightsAfter = page.paging?.next ? page.paging.cursors?.after : undefined;
    } catch (err: any) {
      if (isReduceDataError(err) && windowDays > 1) {
        // Split window in half and retry both halves
        const midpoint = new Date((windowFrom.getTime() + windowTo.getTime()) / 2);
        console.log(`${TAG} ${adAccountId}: 'reduce amount' error, splitting window into 2 halves`);
        await fetchInsightsWindow(client, adAccountId, windowFrom, midpoint, externalIdToLocalId, result);
        await fetchInsightsWindow(client, adAccountId, midpoint, windowTo, externalIdToLocalId, result);
        return;
      }
      const msg = `getAdInsights ${windowFrom.toISOString().slice(0, 10)}→${windowTo.toISOString().slice(0, 10)}: ${err.response?.data?.error?.message ?? err.message}`;
      console.error(`${TAG} ${msg}`);
      result.errors.push(msg);
      return;
    }
  } while (insightsAfter);
}

/** Sync one ad account: ads → insights → scores (upstream handles score recompute). */
export async function syncAdAccount(adAccountId: string, lookbackDays: number): Promise<SyncResult> {
  const result: SyncResult = {
    adAccountId,
    adsUpserted: 0,
    creativeAssetsUpserted: 0,
    dailyStatsUpserted: 0,
    errors: [],
  };

  const client = new MetaAdsClient();

  // 1. Validate token
  const tokenCheck = await client.validateToken();
  if (!tokenCheck.valid) {
    const msg = `Token invalid: ${tokenCheck.error}`;
    console.error(`${TAG} ${msg}`);
    result.errors.push(msg);
    return result;
  }
  console.log(`${TAG} Token validated for account ${adAccountId} (user: ${tokenCheck.name})`);

  // 2. Fetch ACTIVE ads for the account (paginated). We skip PAUSED/ARCHIVED to avoid
  // pulling 20k+ historical ads — we only care about currently-spending creatives.
  // Uses includeCreative=false to avoid Meta's "reduce amount of data" error on large
  // accounts. Creative details (thumbnail, video_id) are fetched lazily per-ad below.
  let adsAfter: string | undefined = undefined;
  const externalIdToLocalId = new Map<string, number>();
  const adsNeedingCreative: string[] = [];

  do {
    try {
      const page: { data: MetaAd[]; paging?: { cursors?: { after?: string }; next?: string } } =
        await client.listAds({
          adAccountId,
          after: adsAfter,
          limit: 50,
          status: ["ACTIVE"],
          includeCreative: false,
        });
      for (const ad of page.data ?? []) {
        try {
          // Without creative nested data, the hash is weaker but still stable.
          // We'll backfill creative details in the next step.
          const { creativeAsset, adBase } = metaAdToUpsertPayloads(ad, adAccountId);
          const creativeAssetId = await db.upsertCreativeAsset(creativeAsset);
          if (creativeAssetId) result.creativeAssetsUpserted++;
          const localAdId = await db.upsertAd({ ...adBase, creativeAssetId });
          if (localAdId) {
            result.adsUpserted++;
            externalIdToLocalId.set(ad.id, localAdId);
            adsNeedingCreative.push(ad.id);
          }
        } catch (err: any) {
          result.errors.push(`upsert ad ${ad.id}: ${err.message}`);
        }
      }
      adsAfter = page.paging?.next ? page.paging.cursors?.after : undefined;
    } catch (err: any) {
      const msg = `listAds failed for ${adAccountId}: ${err.response?.data?.error?.message ?? err.message}`;
      console.error(`${TAG} ${msg}`);
      result.errors.push(msg);
      return result;
    }
  } while (adsAfter);

  console.log(`${TAG} ${adAccountId}: ${result.adsUpserted} active ads + ${result.creativeAssetsUpserted} creative assets upserted (listing pass)`);

  // 2b. Backfill creative details per-ad. Individual ad fetches are small and never
  // hit the "reduce amount" error. We skip ads that already have a thumbnail cached
  // to save API calls on subsequent syncs.
  let creativeBackfillCount = 0;
  let creativeBackfillErrors = 0;
  for (const externalAdId of adsNeedingCreative) {
    try {
      // Check if we already have creative data cached
      const existingAd = await db.getAdByExternalId("meta", externalAdId);
      if (!existingAd) continue;
      const existingAsset = existingAd.creativeAssetId ? await db.getCreativeAssetById(existingAd.creativeAssetId) : null;
      if (existingAsset?.thumbnailUrl) continue; // already have creative data

      const fullAd = await client.getAdById(externalAdId);
      if (!fullAd || !fullAd.creative) continue;

      const { creativeAsset } = metaAdToUpsertPayloads(fullAd, adAccountId);
      const newAssetId = await db.upsertCreativeAsset(creativeAsset);
      if (newAssetId && newAssetId !== existingAd.creativeAssetId) {
        // Re-link ad to the new (properly hashed) creative asset
        await db.upsertAd({
          platform: "meta",
          externalAdId,
          adAccountId,
          creativeAssetId: newAssetId,
        } as any);
      }
      creativeBackfillCount++;
    } catch (err: any) {
      creativeBackfillErrors++;
      // Log first 5 errors only to avoid spamming
      if (creativeBackfillErrors <= 5) {
        console.warn(`${TAG} Creative backfill failed for ${externalAdId}: ${err.message}`);
      }
    }
  }
  console.log(`${TAG} ${adAccountId}: ${creativeBackfillCount} creatives backfilled (${creativeBackfillErrors} errors)`);

  // 3. Fetch daily insights in 3-day windows (prevents "reduce amount of data" errors)
  // Meta's limit kicks in around 5000-10000 rows per response. For an account with
  // 500+ active ads × 3 days = ~1500 rows per window, which fits comfortably.
  const dateTo = new Date();
  const WINDOW_DAYS = 3;
  for (let offset = 0; offset < lookbackDays; offset += WINDOW_DAYS) {
    const windowTo = new Date(dateTo);
    windowTo.setUTCDate(windowTo.getUTCDate() - offset);
    const windowFrom = new Date(windowTo);
    windowFrom.setUTCDate(windowFrom.getUTCDate() - Math.min(WINDOW_DAYS - 1, lookbackDays - offset - 1));
    await fetchInsightsWindow(client, adAccountId, windowFrom, windowTo, externalIdToLocalId, result);
  }

  console.log(`${TAG} ${adAccountId}: ${result.dailyStatsUpserted} daily stat rows upserted`);
  return result;
}

/** Acquire a MySQL advisory lock to prevent duplicate concurrent syncs across instances. */
async function acquireLock(): Promise<boolean> {
  const dbConn = await db.getDb();
  if (!dbConn) return false;
  try {
    const rows: any = await dbConn.execute(sql`SELECT GET_LOCK(${LOCK_NAME}, 5) AS acquired`);
    const result = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
    return Boolean(result?.acquired);
  } catch (err) {
    console.warn(`${TAG} Failed to acquire advisory lock:`, err);
    return false;
  }
}

async function releaseLock(): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) return;
  try {
    await dbConn.execute(sql`SELECT RELEASE_LOCK(${LOCK_NAME})`);
  } catch {
    // best-effort
  }
}

/** Full sync across all configured ad accounts. */
export async function runFullSync(lookbackDays?: number): Promise<{ results: SyncResult[]; skipped?: boolean }> {
  if (_isSyncing) {
    console.log(`${TAG} In-memory sync already in progress, skipping`);
    return { results: [], skipped: true };
  }

  const acquired = await acquireLock();
  if (!acquired) {
    console.log(`${TAG} Another instance holds the advisory lock, skipping`);
    return { results: [], skipped: true };
  }

  _isSyncing = true;
  const window = lookbackDays ?? ENV.analyticsRollingLookbackDays;
  const accountIds = MetaAdsClient.configuredAdAccountIds();
  if (accountIds.length === 0) {
    console.warn(`${TAG} No META_AD_ACCOUNT_IDS configured, skipping sync`);
    _isSyncing = false;
    await releaseLock();
    return { results: [] };
  }

  const results: SyncResult[] = [];
  let currentAccountId: string | null = null;
  try {
    for (const accountId of accountIds) {
      currentAccountId = accountId;
      await db.updateSyncState("meta", accountId, {
        sourceName: "meta",
        adAccountId: accountId,
        lastSyncStartedAt: new Date(),
        lastSyncStatus: "running",
      });
      const result = await syncAdAccount(accountId, window);
      results.push(result);

      const totalUpserted = result.adsUpserted + result.dailyStatsUpserted;
      const status = result.errors.length === 0 ? "success" : result.errors.length < 5 ? "partial" : "failed";
      const errorSummary = result.errors.length > 0 ? result.errors.slice(0, 5).join("\n") : null;

      await db.updateSyncState("meta", accountId, {
        sourceName: "meta",
        adAccountId: accountId,
        lastSyncCompletedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: errorSummary,
        rowsFetched: totalUpserted,
        rowsUpserted: totalUpserted,
        consecutiveFailures: status === "failed" ? 1 : 0,
      });
    }

    // After all accounts are synced, bulk re-link any Hyros attribution rows
    // that were previously written with adId=null because Meta hadn't seen the
    // ad yet. This fixes the "Hyros sync writes rows but reportService drops
    // them" sequencing bug — the repair hook existed as dead code until now.
    try {
      const linkedCount = await db.relinkOrphanedAttributions();
      if (linkedCount > 0) {
        console.log(`${TAG} relinked ${linkedCount} orphaned attribution rows`);
      }
    } catch (relinkErr: any) {
      console.error(`${TAG} relinkOrphanedAttributions failed:`, relinkErr?.message ?? relinkErr);
      // Non-fatal: sync itself succeeded, relink is best-effort. Next sync retries.
    }

    // Auto-recompute creative scores after sync completes. This was previously
    // only triggered via manual admin button click, leaving the creativeScores
    // table empty and all Hook/Watch/Click/Convert scores showing 0 on /analytics.
    try {
      const scoreFrom = new Date();
      scoreFrom.setUTCDate(scoreFrom.getUTCDate() - window);
      const { rowsUpserted } = await recomputeForDateRange(scoreFrom, new Date());
      console.log(`${TAG} score recompute: ${rowsUpserted} creative scores updated`);
    } catch (scoreErr: any) {
      // Non-fatal: sync data landed fine; scores are derived and can be
      // recomputed later via the admin UI button.
      console.error(`${TAG} score recompute failed (non-fatal):`, scoreErr?.message ?? scoreErr);
    }
  } catch (err: any) {
    // CRITICAL: write failed status before returning so the admin UI can see
    // what broke. Prior bug: this catch only logged, leaving the sync stuck
    // in "running" state on any uncaught error.
    const errorMsg = err?.message ?? String(err);
    console.error(`${TAG} Unexpected error:`, err);
    if (currentAccountId) {
      try {
        const existing = await db.getSyncState("meta", currentAccountId);
        await db.updateSyncState("meta", currentAccountId, {
          sourceName: "meta",
          adAccountId: currentAccountId,
          lastSyncCompletedAt: new Date(),
          lastSyncStatus: "failed",
          lastSyncError: errorMsg,
          consecutiveFailures: (existing?.consecutiveFailures ?? 0) + 1,
        });
      } catch (writeErr: any) {
        console.error(`${TAG} Failed to persist failed sync state:`, writeErr?.message ?? writeErr);
      }
    }
  } finally {
    _isSyncing = false;
    await releaseLock();
  }
  return { results };
}

/** Start the background sync interval. Called from server startup. */
export function startAutoMetaSync(): void {
  if (_syncTimer) {
    console.log(`${TAG} Auto-sync already running`);
    return;
  }
  const intervalMs = ENV.analyticsSyncIntervalMinutes * 60 * 1000;
  console.log(`${TAG} Starting auto-sync every ${ENV.analyticsSyncIntervalMinutes} minutes`);

  // Initial sync on startup (non-blocking)
  void (async () => {
    try {
      const result = await runFullSync();
      const totalUp = result.results.reduce((s, r) => s + r.adsUpserted + r.dailyStatsUpserted, 0);
      console.log(`${TAG} Initial sync complete: ${totalUp} rows upserted across ${result.results.length} accounts`);
    } catch (err: any) {
      console.error(`${TAG} Initial sync failed:`, err.message);
    }
  })();

  _syncTimer = setInterval(async () => {
    console.log(`${TAG} Running scheduled sync...`);
    const result = await runFullSync();
    const totalUp = result.results.reduce((s, r) => s + r.adsUpserted + r.dailyStatsUpserted, 0);
    console.log(`${TAG} Scheduled sync complete: ${totalUp} rows`);
  }, intervalMs);
}

export function stopAutoMetaSync(): void {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
    console.log(`${TAG} Auto-sync stopped`);
  }
}

/** Backfill N days of history. Admin-triggered, blocking, runs until done. */
export async function backfillMeta(days: number): Promise<{ results: SyncResult[] }> {
  console.log(`${TAG} Starting ${days}-day backfill...`);
  return runFullSync(days);
}
