import { sql } from "drizzle-orm";
import { fetchVideoAds, fetchStaticAds, type ForeplayAd } from "./foreplay";
import * as db from "../db";
import { contentFingerprint } from "../db";
import type { InsertForeplayCreative } from "../../drizzle/schema";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Minimum gap between automatic syncs. Protects against restart-triggered
// duplicate syncs (DO App Platform restarts, deploys, autoscaling, etc).
const MIN_AUTO_SYNC_GAP_MS = 23 * 60 * 60 * 1000; // 23h — leaves room for timer jitter
const FOREPLAY_SOURCE = "foreplay";
const LOCK_NAME = "perform_foreplay_sync_lock";
const TAG = "[ForeplaySync]";

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _isSyncing = false;

/** Acquire a MySQL advisory lock so only one instance runs a sync at a time. */
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

/** Read the most recent successful Foreplay sync time from the DB. */
async function getLastSyncCompletedAt(): Promise<Date | null> {
  try {
    const state = await db.getSyncState(FOREPLAY_SOURCE);
    return state?.lastSyncCompletedAt ?? null;
  } catch (err: any) {
    console.warn(`${TAG} Failed to read sync state:`, err?.message);
    return null;
  }
}

/**
 * Sync creatives from Foreplay API into local database.
 * Returns the count of newly imported creatives (not duplicates).
 *
 * @param opts.force — when true, bypasses the 23h recent-sync guard. Use for
 *   user-initiated manual syncs (e.g. the "Sync now" button). Automatic
 *   callers should leave this false to avoid burning Foreplay credits on
 *   container restarts.
 */
export async function syncFromForeplay(
  opts: { force?: boolean } = {},
): Promise<{ newCount: number; totalFetched: number; error?: string; skipped?: boolean }> {
  if (_isSyncing) {
    console.log(`${TAG} Sync already in progress, skipping`);
    return { newCount: 0, totalFetched: 0, skipped: true, error: "Sync already in progress" };
  }

  // Guard: skip if last sync was < 23h ago (unless forced).
  // Prevents restart-triggered duplicate syncs across processes/instances.
  if (!opts.force) {
    const lastSync = await getLastSyncCompletedAt();
    if (lastSync) {
      const ageMs = Date.now() - lastSync.getTime();
      if (ageMs < MIN_AUTO_SYNC_GAP_MS) {
        const ageMin = Math.round(ageMs / 60000);
        console.log(`${TAG} Last sync was ${ageMin}min ago (< 23h), skipping`);
        return { newCount: 0, totalFetched: 0, skipped: true };
      }
    }
  }

  // Cross-instance lock — only one process runs a sync at a time.
  const locked = await acquireLock();
  if (!locked) {
    console.log(`${TAG} Another instance holds the sync lock, skipping`);
    return { newCount: 0, totalFetched: 0, skipped: true };
  }

  _isSyncing = true;
  console.log(`${TAG} Starting sync from Foreplay...`);

  try {
    await db.updateSyncState(FOREPLAY_SOURCE, undefined, {
      sourceName: FOREPLAY_SOURCE,
      lastSyncStartedAt: new Date(),
      lastSyncStatus: "running",
    });

    // Fetch from both boards — dedup handled by upsert (onDuplicateKeyUpdate on foreplayAdId)
    const [videoAds, staticAds] = await Promise.all([
      fetchVideoAds(1000),
      fetchStaticAds(1000),
    ]);

    const totalFetched = videoAds.length + staticAds.length;
    console.log(`${TAG} Fetched ${videoAds.length} video + ${staticAds.length} static = ${totalFetched} total from Foreplay`);

    // Load existing content fingerprints to skip ads whose content already exists
    // under a different foreplayAdId (same ad saved to Foreplay board multiple times)
    const existingFingerprints = await db.getExistingContentFingerprints();
    let newCount = 0;
    let contentDupes = 0;

    // Process video ads — upsert handles dedup via unique foreplayAdId constraint
    for (const ad of videoAds) {
      try {
        const fp = contentFingerprint(ad.thumbnailUrl || null, ad.title || null, ad.brandName || null);
        if (existingFingerprints.has(fp)) {
          contentDupes++;
          continue;
        }
        const creative: InsertForeplayCreative = {
          foreplayAdId: ad.id,
          type: "VIDEO",
          board: "inspo",
          title: ad.title || "Untitled Video",
          brandName: ad.brandName || null,
          thumbnailUrl: ad.thumbnailUrl || null,
          imageUrl: ad.imageUrl || null,
          mediaUrl: ad.mediaUrl || null,
          mediaType: ad.mediaType || null,
          platform: ad.platform || null,
          description: ad.description || null,
          headline: ad.headline || null,
          displayFormat: ad.displayFormat || null,
          transcription: ad.transcription || null,
          foreplayCreatedAt: ad.createdAt || null,
          isNew: 1,
        };
        const isNew = await db.upsertForeplayCreative(creative);
        if (isNew) {
          newCount++;
          existingFingerprints.add(fp); // Track within this sync batch too
        }
      } catch (err: any) {
        console.warn(`${TAG} Failed to upsert video ad ${ad.id}:`, err.message);
      }
    }

    // Process static ads
    for (const ad of staticAds) {
      try {
        const fp = contentFingerprint(ad.thumbnailUrl || null, ad.title || null, ad.brandName || null);
        if (existingFingerprints.has(fp)) {
          contentDupes++;
          continue;
        }
        const creative: InsertForeplayCreative = {
          foreplayAdId: ad.id,
          type: "STATIC",
          board: "static_inspo",
          title: ad.title || "Untitled Static",
          brandName: ad.brandName || null,
          thumbnailUrl: ad.thumbnailUrl || null,
          imageUrl: ad.imageUrl || null,
          mediaUrl: ad.mediaUrl || null,
          mediaType: ad.mediaType || null,
          platform: ad.platform || null,
          description: ad.description || null,
          headline: ad.headline || null,
          displayFormat: ad.displayFormat || null,
          transcription: ad.transcription || null,
          foreplayCreatedAt: ad.createdAt || null,
          isNew: 1,
        };
        const isNew = await db.upsertForeplayCreative(creative);
        if (isNew) {
          newCount++;
          existingFingerprints.add(fp);
        }
      } catch (err: any) {
        console.warn(`${TAG} Failed to upsert static ad ${ad.id}:`, err.message);
      }
    }

    if (contentDupes > 0) {
      console.log(`${TAG} Skipped ${contentDupes} content-duplicate ads (same ad, different Foreplay IDs)`);
    }

    await db.updateSyncState(FOREPLAY_SOURCE, undefined, {
      lastSyncCompletedAt: new Date(),
      lastSyncStatus: "success",
      lastSyncError: null,
      rowsFetched: totalFetched,
      rowsUpserted: newCount,
      consecutiveFailures: 0,
    });

    console.log(`${TAG} Sync complete: ${newCount} new creatives imported, ${totalFetched} total fetched`);
    return { newCount, totalFetched };
  } catch (err: any) {
    console.error(`${TAG} Sync failed:`, err.message);
    try {
      await db.updateSyncState(FOREPLAY_SOURCE, undefined, {
        lastSyncStatus: "failed",
        lastSyncError: err.message?.slice(0, 1000) ?? "unknown error",
      });
    } catch {
      // best-effort
    }
    return { newCount: 0, totalFetched: 0, error: err.message };
  } finally {
    _isSyncing = false;
    await releaseLock();
  }
}

/**
 * Start the background sync job.
 *
 * Behavior:
 *  - Reads lastSyncCompletedAt from the DB (adSyncState).
 *  - If the last sync was < 23h ago, skips the initial sync and schedules the
 *    next one for (24h - elapsed). This is what prevents container restarts
 *    (deploys, health checks, OOM, autoscaling) from burning Foreplay credits.
 *  - If there's no recent sync, runs one immediately.
 */
export function startAutoSync(): void {
  if (_syncTimer) {
    console.log(`${TAG} Auto-sync already scheduled`);
    return;
  }

  console.log(`${TAG} Starting auto-sync (every 24 hours)`);

  (async () => {
    const lastSync = await getLastSyncCompletedAt();
    const now = Date.now();
    const elapsedMs = lastSync ? now - lastSync.getTime() : Infinity;

    if (lastSync && elapsedMs < MIN_AUTO_SYNC_GAP_MS) {
      const nextInMs = SYNC_INTERVAL_MS - elapsedMs;
      const nextInMin = Math.round(nextInMs / 60000);
      console.log(`${TAG} Last sync was ${Math.round(elapsedMs / 60000)}min ago — skipping initial sync, next in ${nextInMin}min`);
      scheduleNext(nextInMs);
      return;
    }

    // First sync in >23h (or none ever) — run immediately, but still dedupe content first
    console.log(`${TAG} Cleaning up content-duplicate creatives...`);
    const deleted = await db.deduplicateExistingCreatives();
    if (deleted > 0) console.log(`${TAG} Removed ${deleted} content-duplicate rows`);

    console.log(`${TAG} Running initial sync...`);
    const result = await syncFromForeplay();
    console.log(`${TAG} Initial sync: ${result.newCount} new creatives`);
    scheduleNext(SYNC_INTERVAL_MS);
  })();
}

/** Schedule the next sync as a single-shot timeout, then re-arm on completion. */
function scheduleNext(delayMs: number): void {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    console.log(`${TAG} Running scheduled daily sync...`);
    const result = await syncFromForeplay();
    console.log(`${TAG} Daily sync: ${result.newCount} new creatives`);
    scheduleNext(SYNC_INTERVAL_MS);
  }, delayMs);
}

/**
 * Stop the auto-sync job (for cleanup/testing).
 */
export function stopAutoSync(): void {
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
    console.log(`${TAG} Auto-sync stopped`);
  }
}

/**
 * Get sync status info.
 */
export async function getSyncStatus(): Promise<{ lastSyncAt: Date | null; isSyncing: boolean; autoSyncActive: boolean }> {
  const lastSyncAt = await getLastSyncCompletedAt();
  return {
    lastSyncAt,
    isSyncing: _isSyncing,
    autoSyncActive: _syncTimer !== null,
  };
}
