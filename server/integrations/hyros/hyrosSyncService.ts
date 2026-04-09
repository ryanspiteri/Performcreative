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
import {
  HyrosClient,
  HyrosShapeError,
  parseHyrosDate,
  bucketDateToUtcMidnight,
  type HyrosSale,
} from "./hyrosClient";
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
 * Extract net revenue in cents from a Hyros sale.
 *
 * Hyros's `usdPrice` is an object: `{ price, discount, hardCost, refunded, currency }`.
 * V1 uses NET revenue: `max(0, price - refunded)`, matching how Motion nets refunds
 * in its reporting. A previous version of this code assumed `usdPrice` was a plain
 * number, which made every sale produce NaN revenue and every upsert silently fail.
 *
 * Returns an object so the caller can track *why* revenue is zero (missing field
 * vs. fully-refunded sale) via the sync result.
 */
export function extractNetRevenueCents(sale: HyrosSale): { revenueCents: number; reason?: "missing" } {
  const price = sale.usdPrice?.price;
  if (price == null || !Number.isFinite(price)) {
    return { revenueCents: 0, reason: "missing" };
  }
  const refunded = sale.usdPrice?.refunded;
  const refundedSafe = refunded != null && Number.isFinite(refunded) ? refunded : 0;
  const netDollars = Math.max(0, price - refundedSafe);
  const cents = Math.round(netDollars * 100);
  return { revenueCents: Number.isFinite(cents) ? cents : 0 };
}

/**
 * Aggregate sales into daily per-ad buckets by attribution model.
 *
 * For V1 we compute FIRST-click only. V1.5 can add last-click as a second model.
 *
 * Single pass: skip-counting and bucketing happen together. Mutates `result`
 * to increment `salesSkipped` for skipped sales and pushes a log line for
 * sales where `usdPrice.price` is missing so the class of failure is visible.
 */
export function aggregateSalesToBuckets(
  sales: HyrosSale[],
  result: HyrosSyncResult,
): Map<string, AggregationBucket> {
  const buckets = new Map<string, AggregationBucket>();
  let missingPriceCount = 0;

  for (const sale of sales) {
    const source = sale.firstSource;
    const hyrosAdId = source?.sourceLinkAd?.adSourceId;
    if (!hyrosAdId) {
      result.salesSkipped++;
      continue;
    }
    const externalAdId = source?.adSource?.adSourceId ?? hyrosAdId;
    const saleDate = parseHyrosDate(sale.creationDate);
    if (!saleDate) {
      result.salesSkipped++;
      continue;
    }
    const bucketDate = bucketDateToUtcMidnight(saleDate);

    const { revenueCents, reason } = extractNetRevenueCents(sale);
    if (reason === "missing") {
      missingPriceCount++;
    }

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
    const quantity = sale.quantity ?? 1;
    bucket.conversions += quantity;
    bucket.revenueCents += revenueCents;
  }

  if (missingPriceCount > 0) {
    console.warn(`${TAG} ${missingPriceCount} sales had no usdPrice.price — recorded as $0 revenue`);
  }

  return buckets;
}

/**
 * Flush aggregated buckets to adAttributionStats.
 *
 * Upsert failures propagate to `result.errors[]` so the sync status ends as
 * `partial` or `failed` and the admin UI surfaces a real error message.
 * Per `.claude/rules/backend.md`: no silent swallows — use console.error and
 * track the failure in the sync result.
 */
async function flushBuckets(
  buckets: Map<string, AggregationBucket>,
  result: HyrosSyncResult,
): Promise<number> {
  let upserted = 0;
  for (const bucket of Array.from(buckets.values())) {
    // Look up the corresponding ad in our DB if Meta sync has already synced it.
    // If not found, we still upsert with adId=null — the orphan will be linked
    // on the next Meta sync via db.relinkOrphanedAttributions().
    const existingAd = await db.getAdByExternalId("meta", bucket.key.hyrosAdId);
    const localAdId = existingAd?.id ?? null;

    const aovCents = bucket.conversions > 0 ? Math.round(bucket.revenueCents / bucket.conversions) : 0;

    // ROAS requires spend, which comes from Meta daily stats. We don't compute it
    // here because Hyros sales don't carry spend data. reportService joins
    // adDailyStats and adAttributionStats by (adId, date) to compute ROAS at query
    // time.
    const row: InsertAdAttributionStat = {
      adId: localAdId,
      hyrosAdId: bucket.key.hyrosAdId,
      externalAdId: bucket.key.externalAdId,
      date: bucket.key.date,
      source: "hyros",
      attributionModel: bucket.key.attributionModel,
      spendCents: 0, // Hyros doesn't track spend in /sales
      conversions: bucket.conversions,
      revenueCents: bucket.revenueCents,
      aovCents,
      roasBp: 0, // computed at query time
      cpaCents: 0, // computed at query time
    };

    try {
      await db.upsertAdAttributionStat(row);
      upserted++;
    } catch (err: any) {
      const msg = `upsertAttributionStat failed for hyrosAdId=${bucket.key.hyrosAdId} date=${bucket.key.date.toISOString()}: ${err?.message ?? err}`;
      console.error(`${TAG} ${msg}`);
      result.errors.push(msg);
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
      const page = await client.listSales({
        fromDate: dateFrom,
        toDate: dateTo,
        pageId,
        pageSize: 200,
      });
      const sales = page.result ?? [];
      result.salesProcessed += sales.length;

      // Single pass: aggregateSalesToBuckets increments result.salesSkipped
      // for sales without ad-level attribution or with invalid creationDate.
      const pageBuckets = aggregateSalesToBuckets(sales, result);
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

      pageId = page.nextPageId ?? undefined;
    } catch (err: any) {
      // Zod shape-drift errors get a specific prefix so the admin UI can see
      // "Hyros response shape changed" vs. a generic HTTP error.
      const msg =
        err instanceof HyrosShapeError
          ? `Hyros shape drift: ${err.message}${err.fieldPath ? ` (field: ${err.fieldPath})` : ""}`
          : `listSales failed: ${err.response?.data?.message?.[0] ?? err.message}`;
      console.error(`${TAG} ${msg}`);
      result.errors.push(msg);
      break;
    }
  } while (pageId);

  console.log(
    `${TAG} Processed ${result.salesProcessed} sales (${result.salesSkipped} unattributed), ${allBuckets.size} buckets to flush`
  );

  result.rowsUpserted = await flushBuckets(allBuckets, result);
  console.log(
    `${TAG} done: processed=${result.salesProcessed} skipped=${result.salesSkipped} upserted=${result.rowsUpserted} errors=${result.errors.length}`
  );
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
    // CRITICAL: write failed status to adSyncState before returning, otherwise
    // the sync stays stuck in "running" forever and the admin UI keeps
    // showing the old success. Prior bug: this catch only logged.
    const errorMsg = err?.message ?? String(err);
    console.error(`${TAG} Unexpected error:`, err);
    try {
      const existing = await db.getSyncState("hyros");
      await db.updateSyncState("hyros", undefined, {
        sourceName: "hyros",
        adAccountId: null as any,
        lastSyncCompletedAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncError: errorMsg,
        consecutiveFailures: (existing?.consecutiveFailures ?? 0) + 1,
      });
    } catch (writeErr: any) {
      console.error(`${TAG} Failed to persist failed sync state:`, writeErr?.message ?? writeErr);
    }
    return { result: { ...emptyResult(), errors: [errorMsg] } };
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
