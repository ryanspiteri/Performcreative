/**
 * Hyros sync service.
 *
 * Fetches individual sales via /sales?fromDate=...&toDate=..., aggregates them
 * in-memory by (hyrosAdId, date, attributionModel), then upserts rows into
 * adAttributionStats. Uses firstSource.sourceLinkAd.adSourceId as the join key
 * to Meta ads (confirmed working in Phase 1 validation).
 *
 * Runs on a separate advisory lock from Meta sync so both can run concurrently.
 */
import { sql } from "drizzle-orm";
import { HyrosClient, parseHyrosDate, bucketDateToUtcMidnight, type HyrosSale } from "./hyrosClient";
import * as db from "../../db";
import type { InsertAdAttributionStat } from "../../../drizzle/schema";
import { ENV } from "../../_core/env";

const TAG = "[HyrosSync]";
const LOCK_NAME = "perform_hyros_sync_lock";

let _syncTimer: ReturnType<typeof setInterval> | null = null;
let _isSyncing = false;

interface AggregationKey {
  hyrosAdId: string;
  externalAdId: string;
  date: Date;
  attributionModel: "first_click" | "last_click";
}

interface AggregationBucket {
  key: AggregationKey;
  spendCents: number;
  conversions: number;
  revenueCents: number;
}

export interface HyrosSyncResult {
  salesProcessed: number;
  salesSkipped: number;
  rowsUpserted: number;
  errors: string[];
}

/**
 * Aggregate sales into daily per-ad buckets by attribution model.
 * For V1 we compute FIRST-click only. V1.5 can add last-click as a second model.
 */
function aggregateSalesToBuckets(sales: HyrosSale[]): Map<string, AggregationBucket> {
  const buckets = new Map<string, AggregationBucket>();

  for (const sale of sales) {
    const source = sale.firstSource;
    if (!source?.sourceLinkAd?.adSourceId) continue; // skip sales without ad-level attribution
    const hyrosAdId = source.sourceLinkAd.adSourceId;
    const externalAdId = source.adSource?.adSourceId ?? hyrosAdId;
    const saleDate = parseHyrosDate(sale.creationDate);
    if (!saleDate) continue;
    const bucketDate = bucketDateToUtcMidnight(saleDate);

    const bucketKey = `${hyrosAdId}|${bucketDate.toISOString()}|first_click`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        key: { hyrosAdId, externalAdId, date: bucketDate, attributionModel: "first_click" },
        spendCents: 0,
        conversions: 0,
        revenueCents: 0,
      };
      buckets.set(bucketKey, bucket);
    }
    bucket.conversions += sale.quantity ?? 1;
    bucket.revenueCents += Math.round((sale.usdPrice ?? 0) * 100);
  }

  return buckets;
}

/** Flush aggregated buckets to adAttributionStats. */
async function flushBuckets(buckets: Map<string, AggregationBucket>): Promise<number> {
  let upserted = 0;
  for (const bucket of Array.from(buckets.values())) {
    // Look up the corresponding ad in our DB if Meta sync has already synced it
    const existingAd = await db.getAdByExternalId("meta", bucket.key.hyrosAdId);
    const localAdId = existingAd?.id ?? null;

    const aovCents = bucket.conversions > 0 ? Math.round(bucket.revenueCents / bucket.conversions) : 0;

    // ROAS requires spend, which comes from Meta daily stats. We don't compute it here
    // because Hyros sales don't carry spend data. The report service joins adDailyStats
    // and adAttributionStats by (adId, date) to compute ROAS at query time.
    const row: InsertAdAttributionStat = {
      adId: localAdId,
      hyrosAdId: bucket.key.hyrosAdId,
      externalAdId: bucket.key.externalAdId,
      date: bucket.key.date,
      source: "hyros",
      attributionModel: bucket.key.attributionModel,
      spendCents: 0, // Hyros doesn't track spend in /sales; spend comes from Meta
      conversions: bucket.conversions,
      revenueCents: bucket.revenueCents,
      aovCents,
      roasBp: 0, // computed at query time from SUM(revenue) / SUM(spend)
      cpaCents: 0, // computed at query time from spend / conversions
    };

    try {
      await db.upsertAdAttributionStat(row);
      upserted++;
    } catch (err: any) {
      console.warn(`${TAG} Upsert failed for ${bucket.key.hyrosAdId} ${bucket.key.date.toISOString()}:`, err.message);
    }
  }
  return upserted;
}

/** Sync Hyros sales into adAttributionStats for a date range. */
export async function syncHyrosRange(dateFrom: Date, dateTo: Date): Promise<HyrosSyncResult> {
  const result: HyrosSyncResult = {
    salesProcessed: 0,
    salesSkipped: 0,
    rowsUpserted: 0,
    errors: [],
  };

  const client = new HyrosClient();
  const tokenCheck = await client.validateApiKey();
  if (!tokenCheck.valid) {
    result.errors.push(`Hyros key invalid: ${tokenCheck.error}`);
    return result;
  }

  // Paginate through sales
  let pageId: string | undefined = undefined;
  const allBuckets = new Map<string, AggregationBucket>();

  do {
    try {
      const page: { result: HyrosSale[]; nextPageId?: string } = await client.listSales({
        fromDate: dateFrom,
        toDate: dateTo,
        pageId,
        pageSize: 200,
      });
      const sales = page.result ?? [];
      result.salesProcessed += sales.length;

      for (const sale of sales) {
        if (!sale.firstSource?.sourceLinkAd?.adSourceId) {
          result.salesSkipped++;
        }
      }

      // Aggregate this page and merge into the master buckets map
      const pageBuckets = aggregateSalesToBuckets(sales);
      for (const [k, v] of Array.from(pageBuckets.entries())) {
        const existing = allBuckets.get(k);
        if (existing) {
          existing.spendCents += v.spendCents;
          existing.conversions += v.conversions;
          existing.revenueCents += v.revenueCents;
        } else {
          allBuckets.set(k, v);
        }
      }

      pageId = page.nextPageId;
    } catch (err: any) {
      const msg = `listSales failed: ${err.response?.data?.message?.[0] ?? err.message}`;
      console.error(`${TAG} ${msg}`);
      result.errors.push(msg);
      break;
    }
  } while (pageId);

  console.log(
    `${TAG} Processed ${result.salesProcessed} sales (${result.salesSkipped} unattributed), ${allBuckets.size} buckets to flush`
  );

  result.rowsUpserted = await flushBuckets(allBuckets);
  return result;
}

async function acquireLock(): Promise<boolean> {
  const dbConn = await db.getDb();
  if (!dbConn) return false;
  try {
    const rows: any = await dbConn.execute(sql`SELECT GET_LOCK(${LOCK_NAME}, 5) AS acquired`);
    const result = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
    return Boolean(result?.acquired);
  } catch {
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

export async function runHyrosSync(lookbackDays?: number): Promise<{ result: HyrosSyncResult; skipped?: boolean }> {
  if (_isSyncing) {
    console.log(`${TAG} Sync already in progress (in-memory), skipping`);
    return { result: emptyResult(), skipped: true };
  }
  const acquired = await acquireLock();
  if (!acquired) {
    console.log(`${TAG} Another instance holds the lock, skipping`);
    return { result: emptyResult(), skipped: true };
  }

  _isSyncing = true;
  const window = lookbackDays ?? ENV.analyticsRollingLookbackDays;
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setUTCDate(dateFrom.getUTCDate() - window);

  try {
    await db.updateSyncState("hyros", undefined, {
      sourceName: "hyros",
      adAccountId: null as any,
      lastSyncStartedAt: new Date(),
      lastSyncStatus: "running",
    });
    const result = await syncHyrosRange(dateFrom, dateTo);
    const status = result.errors.length === 0 ? "success" : result.errors.length < 3 ? "partial" : "failed";
    await db.updateSyncState("hyros", undefined, {
      sourceName: "hyros",
      adAccountId: null as any,
      lastSyncCompletedAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: result.errors.length > 0 ? result.errors.slice(0, 5).join("\n") : null,
      rowsFetched: result.salesProcessed,
      rowsUpserted: result.rowsUpserted,
      consecutiveFailures: status === "failed" ? 1 : 0,
    });
    return { result };
  } catch (err: any) {
    console.error(`${TAG} Unexpected error:`, err);
    return { result: { ...emptyResult(), errors: [err.message] } };
  } finally {
    _isSyncing = false;
    await releaseLock();
  }
}

function emptyResult(): HyrosSyncResult {
  return { salesProcessed: 0, salesSkipped: 0, rowsUpserted: 0, errors: [] };
}

export function startAutoHyrosSync(): void {
  if (_syncTimer) {
    console.log(`${TAG} Auto-sync already running`);
    return;
  }
  const intervalMs = ENV.analyticsSyncIntervalMinutes * 60 * 1000;
  console.log(`${TAG} Starting auto-sync every ${ENV.analyticsSyncIntervalMinutes} minutes`);

  void (async () => {
    try {
      const { result } = await runHyrosSync();
      console.log(`${TAG} Initial sync complete: ${result.salesProcessed} sales → ${result.rowsUpserted} attribution rows`);
    } catch (err: any) {
      console.error(`${TAG} Initial sync failed:`, err.message);
    }
  })();

  _syncTimer = setInterval(async () => {
    const { result } = await runHyrosSync();
    console.log(`${TAG} Scheduled sync: ${result.rowsUpserted} rows`);
  }, intervalMs);
}

export function stopAutoHyrosSync(): void {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
    console.log(`${TAG} Auto-sync stopped`);
  }
}

export async function backfillHyros(days: number): Promise<{ result: HyrosSyncResult }> {
  console.log(`${TAG} Starting ${days}-day backfill...`);
  return runHyrosSync(days);
}
