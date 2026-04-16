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
  type HyrosSale,
} from "./hyrosClient";
import * as db from "../../db";
import type { InsertAdAttributionStat } from "../../../drizzle/schema";
import { ENV } from "../../_core/env";
import { recomputeForDateRange } from "../../services/creativeAnalytics/scoreRecompute";
import { parseAndBucketToTz, REPORTING_TZ } from "../shared/tzDates";

/**
 * Sentinel hyrosAdId used to bucket sales that Hyros attributes only at the
 * campaign/adset/account level (no `firstSource.sourceLinkAd.adSourceId`).
 * We can't link these to a creative, but we still need their revenue to count
 * in the KPI strip totals — otherwise our "Total Revenue" is always lower
 * than the Hyros dashboard's "Revenue" card. The report layer includes this
 * row in summary sums but excludes it from the per-creative list (by design —
 * it has no adId to join through).
 */
export const UNATTRIBUTED_HYROS_AD_ID = "__unattributed__";

const TAG = "[HyrosSync]";
const LOCK_NAME = "perform_hyros_sync_lock";

let _syncTimer: ReturnType<typeof setInterval> | null = null;
let _isSyncing = false;

type AttributionModel = "first_click" | "last_click";

interface AggregationKey {
  hyrosAdId: string;
  externalAdId: string;
  date: Date;
  attributionModel: AttributionModel;
}

interface AggregationBucket {
  key: AggregationKey;
  spendCents: number;
  conversions: number;
  revenueCents: number;
}

export interface HyrosSyncResult {
  salesProcessed: number;
  /** Sales aggregated into the __unattributed__ bucket (no ad-level sourceLinkAd). */
  salesUnattributed: number;
  /** Sales skipped entirely because creationDate couldn't be parsed. */
  salesSkipped: number;
  /** Sales skipped because their currency wasn't in the allowlist (e.g. USD store dropped for V1). */
  salesSkippedCurrency: number;
  /** Sales skipped as duplicates (same sale.id seen on a later page). */
  salesDeduped: number;
  rowsUpserted: number;
  errors: string[];
}

/**
 * Currency allowlist. V1 only reports on the AUD (AU) store — the USD (USA) store
 * is dropped to avoid mixing two stores' numbers with different FX conversions. When
 * both stores are re-enabled, flip this to e.g. `["AUD", "USD"]` and add per-store
 * reporting filters.
 *
 * Check order: `sale.usdPrice.currency` (Hyros's primary), then `sale.price.currency`
 * (some responses put it here). If neither matches, the sale is skipped and counted
 * in `salesSkippedCurrency` so the admin UI can surface it.
 */
const ALLOWED_CURRENCIES = new Set(["AUD"]);

/** Returns true if the sale's currency is in the allowlist (or null/missing, which we keep by default to be safe). */
export function isSaleCurrencyAllowed(sale: HyrosSale): boolean {
  const usdCur = sale.usdPrice?.currency;
  const priceCur = (sale as any).price?.currency as string | undefined | null;
  // If neither field is populated, we keep the sale — matches pre-filter behavior.
  if (!usdCur && !priceCur) return true;
  if (usdCur && ALLOWED_CURRENCIES.has(usdCur)) return true;
  if (priceCur && ALLOWED_CURRENCIES.has(priceCur)) return true;
  return false;
}

/**
 * Extract revenue in cents from a Hyros sale.
 *
 * Hyros's `usdPrice` is an object: `{ price, discount, hardCost, refunded, currency }`.
 * A previous version assumed `usdPrice` was a plain number, producing NaN.
 *
 * Mode is controlled by `ENV.hyrosRevenueMode`:
 *   - "gross" (default) — just `price`. Matches Hyros dashboard's Revenue card.
 *   - "net" — `max(0, price - refunded)`. Useful for finance-style reporting.
 *
 * Returns an object so the caller can track *why* revenue is zero (missing
 * field vs. fully-refunded sale) via the sync result.
 */
export function extractRevenueCents(
  sale: HyrosSale,
  mode: "gross" | "net" = ENV.hyrosRevenueMode,
): { revenueCents: number; reason?: "missing" } {
  const price = sale.usdPrice?.price;
  if (price == null || !Number.isFinite(price)) {
    return { revenueCents: 0, reason: "missing" };
  }
  if (mode === "gross") {
    const cents = Math.round(price * 100);
    return { revenueCents: Number.isFinite(cents) && cents >= 0 ? cents : 0 };
  }
  const refunded = sale.usdPrice?.refunded;
  const refundedSafe = refunded != null && Number.isFinite(refunded) ? refunded : 0;
  const netDollars = Math.max(0, price - refundedSafe);
  const cents = Math.round(netDollars * 100);
  return { revenueCents: Number.isFinite(cents) ? cents : 0 };
}

/** Back-compat alias — existing callers (and tests) still reference the old name. */
export const extractNetRevenueCents = (sale: HyrosSale) => extractRevenueCents(sale, "net");

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
  seenSaleIds?: Set<string>,
): Map<string, AggregationBucket> {
  const buckets = new Map<string, AggregationBucket>();
  let missingPriceCount = 0;
  const attributionModel: AttributionModel = ENV.hyrosAttributionModel;

  for (const sale of sales) {
    // Dedup by sale.id. Hyros pagination can return the same sale twice on
    // boundary rows, especially when new sales arrive mid-fetch.
    if (seenSaleIds && sale.id) {
      if (seenSaleIds.has(sale.id)) {
        result.salesDeduped++;
        continue;
      }
      seenSaleIds.add(sale.id);
    }

    // Currency filter — V1 is AUD-only. Other-currency sales are tracked separately
    // from the ad-attribution skip count so we can see "how much are we dropping
    // because of the store filter" vs "how much are we dropping because Hyros didn't
    // attribute to an ad".
    if (!isSaleCurrencyAllowed(sale)) {
      result.salesSkippedCurrency++;
      continue;
    }

    // Pick the attribution source based on env. Hyros returns both firstSource
    // and lastSource per sale; the dashboard reports whichever model the user
    // has selected, so we mirror that here to keep numbers aligned.
    const source = attributionModel === "last_click" ? sale.lastSource : sale.firstSource;
    // Bucket by Sydney calendar day of the sale's creationDate, not UTC. Hyros
    // sums sales the user sees as "today" in the dashboard, which is Sydney
    // local — bucketing in UTC shifted ~5-15% of sales by a day near midnight.
    const bucketDate = parseAndBucketToTz(sale.creationDate, REPORTING_TZ);
    if (!bucketDate) {
      result.salesSkipped++;
      continue;
    }

    const { revenueCents, reason } = extractRevenueCents(sale);
    if (reason === "missing") {
      missingPriceCount++;
    }

    // If Hyros has no ad-level attribution, fold the sale into an UNATTRIBUTED
    // bucket so its revenue still counts in KPI totals. Without this, every
    // campaign/adset/organic sale was silently dropped and our "Total Revenue"
    // was always lower than Hyros's. adId stays null — the report layer
    // recognises the sentinel and includes these rows in summary sums only.
    const hyrosAdId = source?.sourceLinkAd?.adSourceId ?? UNATTRIBUTED_HYROS_AD_ID;
    const externalAdId = source?.adSource?.adSourceId ?? hyrosAdId;
    if (hyrosAdId === UNATTRIBUTED_HYROS_AD_ID) {
      result.salesUnattributed++;
    }

    const bucketKey = `${hyrosAdId}|${bucketDate.toISOString()}|${attributionModel}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        key: { hyrosAdId, externalAdId, date: bucketDate, attributionModel },
        spendCents: 0,
        conversions: 0,
        revenueCents: 0,
      };
      buckets.set(bucketKey, bucket);
    }
    // One sale = one conversion. Earlier code summed `sale.quantity ?? 1`,
    // which inflated conversions on multi-unit orders and made CPA look
    // artificially low vs. the Hyros "Sales" column (which counts transactions).
    bucket.conversions += 1;
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
    // The UNATTRIBUTED sentinel never maps to an ad — skip the lookup.
    // Every other bucket gets looked up in our DB. If not found, we still
    // upsert with adId=null — the orphan will be linked by the post-flush
    // `relinkOrphanedAttributions()` call once Meta sync has seen the ad.
    let localAdId: number | null = null;
    if (bucket.key.hyrosAdId !== UNATTRIBUTED_HYROS_AD_ID) {
      const existingAd = await db.getAdByExternalId("meta", bucket.key.hyrosAdId);
      localAdId = existingAd?.id ?? null;
    }

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
    salesUnattributed: 0,
    salesSkipped: 0,
    salesSkippedCurrency: 0,
    salesDeduped: 0,
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
  // Shared across pages so the same sale.id appearing on two pages only counts once.
  const seenSaleIds = new Set<string>();

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
      const pageBuckets = aggregateSalesToBuckets(sales, result, seenSaleIds);
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
    `${TAG} Processed ${result.salesProcessed} sales (unattributed=${result.salesUnattributed}, bad-date=${result.salesSkipped}, non-AUD=${result.salesSkippedCurrency}, deduped=${result.salesDeduped}), ${allBuckets.size} buckets to flush`
  );

  result.rowsUpserted = await flushBuckets(allBuckets, result);

  // Relink any rows we just wrote with adId=null that now have a matching ad
  // in our DB (Meta sync may have run in between, or between pages). Previously
  // this only ran after Meta sync, so Hyros-first orphans stayed hidden until
  // the next Meta cycle.
  try {
    const linkedCount = await db.relinkOrphanedAttributions();
    if (linkedCount > 0) {
      console.log(`${TAG} relinked ${linkedCount} orphaned attribution rows post-flush`);
    }
  } catch (relinkErr: any) {
    console.error(`${TAG} relinkOrphanedAttributions failed (non-fatal):`, relinkErr?.message ?? relinkErr);
  }

  console.log(
    `${TAG} done: processed=${result.salesProcessed} unattributed=${result.salesUnattributed} skipped=${result.salesSkipped} nonAud=${result.salesSkippedCurrency} deduped=${result.salesDeduped} upserted=${result.rowsUpserted} errors=${result.errors.length}`
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

    // Auto-recompute creative scores after Hyros attribution data lands.
    // Revenue/ROAS from Hyros affects the Convert score; without this the
    // score stays stale until the next Meta sync or manual recompute.
    if (result.rowsUpserted > 0) {
      try {
        const { rowsUpserted: scoresUpdated } = await recomputeForDateRange(dateFrom, dateTo);
        console.log(`${TAG} score recompute: ${scoresUpdated} creative scores updated`);
      } catch (scoreErr: any) {
        console.error(`${TAG} score recompute failed (non-fatal):`, scoreErr?.message ?? scoreErr);
      }
    }

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
  return {
    salesProcessed: 0,
    salesUnattributed: 0,
    salesSkipped: 0,
    salesSkippedCurrency: 0,
    salesDeduped: 0,
    rowsUpserted: 0,
    errors: [],
  };
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
