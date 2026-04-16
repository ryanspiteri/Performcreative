/**
 * Score recompute service.
 *
 * Responsible for:
 *   1. Computing account benchmarks from 90-day rolling window
 *   2. Aggregating ad-level stats up to creative-level (one creative may have N ads)
 *   3. Computing scores for each (creativeAssetId, date) and upserting creativeScores
 *
 * Called after each Meta/Hyros sync. Can also be run ad-hoc via admin.
 *
 * Aggregation rule (CRITICAL, per Codex review feedback):
 *   When one creative runs in multiple ads, ALWAYS sum the counts first, then
 *   compute rates. Averaging rates gives wrong answers.
 *
 *   thumbstopBp = SUM(videoPlayCount) / SUM(impressions) * 10000
 *   NOT AVG(thumbstopBp)
 */
import { sql } from "drizzle-orm";
import * as db from "../../db";
import { computeScores, computePercentiles, determineCoverage, type AccountBenchmarks, type ScoreInputs } from "./scoreEngine";
import { detectPatternBreakers } from "./patternMiner";

const TAG = "[ScoreRecompute]";

/**
 * Compute account-level benchmarks from the last 90 days of adDailyStats.
 * Samples the underlying metric distribution and returns P25/P50/P75/P90 per metric.
 */
export async function computeAccountBenchmarks(): Promise<AccountBenchmarks> {
  const dbConn = await db.getDb();
  if (!dbConn) {
    return {
      thumbstop: { p25: 0, p50: 0, p75: 0, p90: 0 },
      holdRate: { p25: 0, p50: 0, p75: 0, p90: 0 },
      ctr: { p25: 0, p50: 0, p75: 0, p90: 0 },
      roas: { p25: 0, p50: 0, p75: 0, p90: 0 },
      coverage: "cold_start",
      sampleSize: { ads: 0, days: 0 },
    };
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

  // Pull daily stats for ads with meaningful impressions (filters noise)
  const statsRows: any = await dbConn.execute(sql`
    SELECT thumbstopBp, holdRateBp, ctrBp, adId, DATE(date) as day
    FROM adDailyStats
    WHERE date >= ${ninetyDaysAgo}
      AND impressions >= 100
      AND source = 'meta'
  `);
  const stats: { thumbstopBp: number; holdRateBp: number; ctrBp: number; adId: number; day: string }[] =
    Array.isArray(statsRows[0]) ? statsRows[0] : statsRows;

  const thumbstopValues: number[] = [];
  const holdRateValues: number[] = [];
  const ctrValues: number[] = [];
  const uniqueAds = new Set<number>();
  const uniqueDays = new Set<string>();

  for (const row of stats) {
    if (row.thumbstopBp > 0) thumbstopValues.push(row.thumbstopBp);
    if (row.holdRateBp > 0) holdRateValues.push(row.holdRateBp);
    if (row.ctrBp > 0) ctrValues.push(row.ctrBp);
    uniqueAds.add(row.adId);
    uniqueDays.add(row.day);
  }

  // ROAS percentiles: join adDailyStats + adAttributionStats to compute per-ad ROAS
  const roasRows: any = await dbConn.execute(sql`
    SELECT
      SUM(attr.revenueCents) AS revenue,
      SUM(d.spendCents) AS spend,
      d.adId
    FROM adDailyStats d
    JOIN adAttributionStats attr ON attr.adId = d.adId AND DATE(attr.date) = DATE(d.date)
    WHERE d.date >= ${ninetyDaysAgo}
      AND d.impressions >= 100
      AND attr.attributionModel = 'first_click'
    GROUP BY d.adId
    HAVING spend > 100
  `);
  const roasPerAd: { revenue: number; spend: number }[] = Array.isArray(roasRows[0]) ? roasRows[0] : roasRows;
  const roasValues: number[] = roasPerAd
    .filter((r) => r.spend > 0)
    .map((r) => Math.round((Number(r.revenue) / Number(r.spend)) * 100));

  const coverage = determineCoverage(uniqueAds.size, uniqueDays.size);

  const benchmarks: AccountBenchmarks = {
    thumbstop: computePercentiles(thumbstopValues),
    holdRate: computePercentiles(holdRateValues),
    ctr: computePercentiles(ctrValues),
    roas: computePercentiles(roasValues),
    coverage,
    sampleSize: { ads: uniqueAds.size, days: uniqueDays.size },
  };

  console.log(
    `${TAG} Benchmarks computed: ${uniqueAds.size} ads, ${uniqueDays.size} days, coverage=${coverage}`
  );
  return benchmarks;
}

/**
 * Recompute creative-level scores for a date range.
 * Aggregates ads belonging to the same creativeAsset, computes scores, upserts.
 */
export async function recomputeForDateRange(dateFrom: Date, dateTo: Date): Promise<{ rowsUpserted: number }> {
  const dbConn = await db.getDb();
  if (!dbConn) return { rowsUpserted: 0 };

  const benchmarks = await computeAccountBenchmarks();

  // Persist benchmarks on adSyncState (Meta row, no specific account)
  await db.updateSyncState("meta", undefined, {
    sourceName: "meta",
    benchmarksJson: benchmarks as any,
  });

  // Aggregate daily stats by (creativeAssetId, date) with summed counts
  const aggRows: any = await dbConn.execute(sql`
    SELECT
      a.creativeAssetId,
      DATE(d.date) AS day,
      SUM(d.spendCents) AS spendCents,
      SUM(d.impressions) AS impressions,
      SUM(d.clicks) AS clicks,
      SUM(d.videoPlayCount) AS videoPlayCount,
      SUM(d.video50Count) AS video50Count
    FROM adDailyStats d
    JOIN ads a ON a.id = d.adId
    WHERE d.date >= ${dateFrom}
      AND d.date <= ${dateTo}
      AND d.source = 'meta'
    GROUP BY a.creativeAssetId, DATE(d.date)
  `);
  const aggregations: {
    creativeAssetId: number;
    day: string | Date;
    spendCents: number;
    impressions: number;
    clicks: number;
    videoPlayCount: number;
    video50Count: number;
  }[] = Array.isArray(aggRows[0]) ? aggRows[0] : aggRows;

  // Aggregate attribution stats by (creativeAssetId, date)
  const attrRows: any = await dbConn.execute(sql`
    SELECT
      a.creativeAssetId,
      DATE(attr.date) AS day,
      SUM(attr.revenueCents) AS revenueCents,
      SUM(attr.conversions) AS conversions
    FROM adAttributionStats attr
    JOIN ads a ON a.id = attr.adId
    WHERE attr.date >= ${dateFrom}
      AND attr.date <= ${dateTo}
      AND attr.attributionModel = 'first_click'
    GROUP BY a.creativeAssetId, DATE(attr.date)
  `);
  const attributions: {
    creativeAssetId: number;
    day: string | Date;
    revenueCents: number;
    conversions: number;
  }[] = Array.isArray(attrRows[0]) ? attrRows[0] : attrRows;

  const attrIndex = new Map<string, { revenueCents: number; conversions: number }>();
  for (const a of attributions) {
    const key = `${a.creativeAssetId}|${typeof a.day === "string" ? a.day : a.day.toISOString().slice(0, 10)}`;
    attrIndex.set(key, { revenueCents: Number(a.revenueCents), conversions: Number(a.conversions) });
  }

  let rowsUpserted = 0;
  for (const agg of aggregations) {
    const dayStr = typeof agg.day === "string" ? agg.day : agg.day.toISOString().slice(0, 10);
    const key = `${agg.creativeAssetId}|${dayStr}`;
    const attr = attrIndex.get(key) ?? { revenueCents: 0, conversions: 0 };

    const impressions = Number(agg.impressions);
    const videoPlayCount = Number(agg.videoPlayCount);
    const video50Count = Number(agg.video50Count);

    const inputs: ScoreInputs = {
      thumbstopBp: impressions > 0 ? Math.round((videoPlayCount / impressions) * 10000) : 0,
      holdRateBp: impressions > 0 ? Math.round((video50Count / impressions) * 10000) : 0,
      ctrBp: impressions > 0 ? Math.round((Number(agg.clicks) / impressions) * 10000) : 0,
      outboundCtrBp: 0,
      impressions,
      clicks: Number(agg.clicks),
      conversions: attr.conversions,
      spendCents: Number(agg.spendCents),
      revenueCents: attr.revenueCents,
    };

    const scores = computeScores(inputs, benchmarks);
    try {
      await db.upsertCreativeScore({
        creativeAssetId: agg.creativeAssetId,
        date: new Date(`${dayStr}T00:00:00Z`),
        hookScore: scores.hookScore,
        watchScore: scores.watchScore,
        clickScore: scores.clickScore,
        convertScore: scores.convertScore,
        aggregatedImpressions: impressions,
        aggregatedSpendCents: Number(agg.spendCents),
        coverage: scores.coverage,
      });
      rowsUpserted++;
    } catch (err: any) {
      console.warn(`${TAG} Upsert failed for creative ${agg.creativeAssetId} ${dayStr}:`, err.message);
    }
  }

  console.log(`${TAG} Recomputed ${rowsUpserted} creative score rows for ${dateFrom.toISOString().slice(0, 10)} → ${dateTo.toISOString().slice(0, 10)}`);

  // Run pattern breaker detection after scores are fresh
  try {
    const patternBreakers = await detectPatternBreakers();
    if (patternBreakers > 0) {
      console.log(`${TAG} Pattern breaker detection found ${patternBreakers} insights`);
    }
  } catch (err: any) {
    console.warn(`${TAG} Pattern breaker detection failed (non-blocking):`, err.message);
  }

  return { rowsUpserted };
}
