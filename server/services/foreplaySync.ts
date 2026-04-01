import { fetchVideoAds, fetchStaticAds, type ForeplayAd } from "./foreplay";
import * as db from "../db";
import type { InsertForeplayCreative } from "../../drizzle/schema";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let _syncTimer: ReturnType<typeof setInterval> | null = null;
let _lastSyncAt: Date | null = null;
// NOTE: In-memory flag — only prevents concurrent syncs within a single process.
// If scaling to multiple instances, use a DB advisory lock instead.
let _isSyncing = false;

/**
 * Sync creatives from Foreplay API into local database.
 * Returns the count of newly imported creatives (not duplicates).
 */
export async function syncFromForeplay(): Promise<{ newCount: number; totalFetched: number; error?: string }> {
  if (_isSyncing) {
    console.log("[ForeplaySync] Sync already in progress, skipping");
    return { newCount: 0, totalFetched: 0, error: "Sync already in progress" };
  }

  _isSyncing = true;
  console.log("[ForeplaySync] Starting sync from Foreplay...");

  try {
    // Fetch from both boards — dedup handled by upsert (onDuplicateKeyUpdate on foreplayAdId)
    const [videoAds, staticAds] = await Promise.all([
      fetchVideoAds(1000),
      fetchStaticAds(1000),
    ]);

    const totalFetched = videoAds.length + staticAds.length;
    console.log(`[ForeplaySync] Fetched ${videoAds.length} video + ${staticAds.length} static = ${totalFetched} total from Foreplay`);

    let newCount = 0;

    // Process video ads — upsert handles dedup via unique foreplayAdId constraint
    for (const ad of videoAds) {
      try {
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
        if (isNew) newCount++;
      } catch (err: any) {
        console.warn(`[ForeplaySync] Failed to upsert video ad ${ad.id}:`, err.message);
      }
    }

    // Process static ads
    for (const ad of staticAds) {
      try {
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
        if (isNew) newCount++;
      } catch (err: any) {
        console.warn(`[ForeplaySync] Failed to upsert static ad ${ad.id}:`, err.message);
      }
    }

    _lastSyncAt = new Date();
    console.log(`[ForeplaySync] Sync complete: ${newCount} new creatives imported, ${totalFetched} total fetched`);
    return { newCount, totalFetched };
  } catch (err: any) {
    console.error("[ForeplaySync] Sync failed:", err.message);
    return { newCount: 0, totalFetched: 0, error: err.message };
  } finally {
    _isSyncing = false;
  }
}

/**
 * Start the daily (24h) background sync job.
 * Also runs an initial sync immediately on startup.
 */
export function startAutoSync(): void {
  if (_syncTimer) {
    console.log("[ForeplaySync] Auto-sync already running");
    return;
  }

  console.log("[ForeplaySync] Starting auto-sync (every 24 hours)");

  // Run initial sync immediately
  (async () => {
    console.log("[ForeplaySync] Running initial sync...");
    const result = await syncFromForeplay();
    console.log(`[ForeplaySync] Initial sync: ${result.newCount} new creatives`);
  })();

  // Set up 24-hour interval
  _syncTimer = setInterval(async () => {
    console.log("[ForeplaySync] Running scheduled daily sync...");
    const result = await syncFromForeplay();
    console.log(`[ForeplaySync] Daily sync: ${result.newCount} new creatives`);
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the auto-sync job (for cleanup/testing).
 */
export function stopAutoSync(): void {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
    console.log("[ForeplaySync] Auto-sync stopped");
  }
}

/**
 * Get sync status info.
 */
export function getSyncStatus(): { lastSyncAt: Date | null; isSyncing: boolean; autoSyncActive: boolean } {
  return {
    lastSyncAt: _lastSyncAt,
    isSyncing: _isSyncing,
    autoSyncActive: _syncTimer !== null,
  };
}
