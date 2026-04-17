/**
 * Report service — single hardcoded "Creative Performance" query for V1.
 *
 * This is intentionally not a dynamic report builder. V1 ships with ONE trusted
 * report. We prove the numbers match Motion, then productize in V1.5.
 *
 * Aggregation rules (LOCKED, per Codex review):
 *   - spend, impressions, clicks, video*Count, revenue, conversions → SUM across ads × days
 *   - thumbstop, holdRate, ctr, roas → computed from summed counts, NOT averaged from rates
 *   - ROAS = SUM(revenue) / SUM(spend) × 10000 (basis points x100 → basis points)
 *   - CPA = SUM(spend) / SUM(conversions) (returns cents)
 *
 * Query validation:
 *   - sortBy + sortDirection validated via Zod enum at the router layer
 *   - No raw string concatenation, all values parameterized via Drizzle template sql``
 */
import { sql } from "drizzle-orm";
import * as db from "../../db";
import { ENV } from "../../_core/env";
import { UNATTRIBUTED_HYROS_AD_ID } from "../../integrations/hyros/hyrosSyncService";
import { computeScores, PLATFORM_FALLBACK, type AccountBenchmarks, type ScoreInputs } from "./scoreEngine";

/**
 * Fetch the cached account benchmarks from the meta adSyncState row. The
 * score recompute job computes these from a 90-day rolling window and writes
 * them here. Fallback to PLATFORM_FALLBACK if the cache is empty (fresh
 * install, or the recompute has never run).
 */
async function getCachedBenchmarks(): Promise<AccountBenchmarks> {
  const state = await db.getSyncState("meta");
  const cached = (state as any)?.benchmarksJson as AccountBenchmarks | null | undefined;
  if (cached && cached.thumbstop && cached.holdRate && cached.ctr && cached.roas) {
    return cached;
  }
  return PLATFORM_FALLBACK;
}

/**
 * Compute scores on-the-fly from aggregated metrics over the displayed date range.
 *
 * We used to read scores from the latest per-day creativeScores row, which caused
 * the displayed Hook/Watch/Click/Convert to reflect only ONE day out of the 7-day
 * window — usually the most recent, which could be a partial/in-progress day with
 * 0 clicks or 0 video50 watchers. That pinned Watch and Click near 0 on ads that
 * actually had healthy 7-day averages. Computing from the same SUM() aggregates
 * we display as Spend/Impressions keeps the score self-consistent with the row.
 *
 * creativeScores is still written per-day by scoreRecompute and used by the
 * fatigue detector, pattern miner, and the time-series chart — those legitimately
 * need per-day granularity.
 */
function scoresFromAggregates(
  agg: {
    impressions: number;
    clicks: number;
    videoPlayCount: number;
    video50Count: number;
    conversions: number;
    spendCents: number;
    revenueCents: number;
  },
  benchmarks: AccountBenchmarks,
): { hookScore: number; watchScore: number; clickScore: number; convertScore: number } {
  const inputs: ScoreInputs = {
    // thumbstopBp / holdRateBp convention: fraction × 10000 (matches adDailyStats storage).
    thumbstopBp: agg.impressions > 0 ? Math.round((agg.videoPlayCount / agg.impressions) * 10000) : 0,
    holdRateBp: agg.impressions > 0 ? Math.round((agg.video50Count / agg.impressions) * 10000) : 0,
    // ctrBp convention: percentage × 10000 (matches parseMetaRateToBp + adDailyStats.ctrBp).
    // fraction × 1_000_000 = percentage × 10000 — see commit 525d81b for the scale fix.
    ctrBp: agg.impressions > 0 ? Math.round((agg.clicks / agg.impressions) * 1_000_000) : 0,
    outboundCtrBp: 0,
    impressions: agg.impressions,
    clicks: agg.clicks,
    conversions: agg.conversions,
    spendCents: agg.spendCents,
    revenueCents: agg.revenueCents,
  };
  const r = computeScores(inputs, benchmarks);
  return {
    hookScore: r.hookScore,
    watchScore: r.watchScore,
    clickScore: r.clickScore,
    convertScore: r.convertScore,
  };
}

export type SortByField = "spendCents" | "revenueCents" | "roasBp" | "hookScore" | "watchScore" | "clickScore" | "convertScore" | "launchDate";
export type SortDirection = "asc" | "desc";

export interface CreativePerfQuery {
  dateFrom: Date;
  dateTo: Date;
  creativeType?: "video" | "image" | "carousel";
  campaignId?: string;
  adAccountId?: string;
  minSpendCents?: number;
  /** Wave 1e — filter by AI tag (messagingAngle) */
  messagingAngle?: string;
  /** Wave 1e — filter by AI tag (hookTactic) */
  hookTactic?: string;
  sortBy: SortByField;
  sortDirection: SortDirection;
  limit: number;
  offset: number;
}

export interface CreativePerfRow {
  creativeAssetId: number;
  creativeName: string;
  thumbnailUrl: string | null;
  creativeType: string;
  launchDate: Date | null;
  adCount: number;
  // Aggregated delivery metrics from Meta
  spendCents: number;
  impressions: number;
  clicks: number;
  reach: number;
  videoPlayCount: number;
  video50Count: number;
  // Computed rates (basis points)
  ctrBp: number;
  thumbstopBp: number;
  holdRateBp: number;
  cpmCents: number; // average CPM, for display
  // Aggregated attribution metrics from Hyros
  revenueCents: number;
  conversions: number;
  aovCents: number;
  roasBp: number;
  cpaCents: number;
  // Latest scores (from most recent creativeScores row in range)
  hookScore: number;
  watchScore: number;
  clickScore: number;
  convertScore: number;
  // Linked pipeline asset
  pipelineRunId: number | null;
}

export interface CreativePerfSummary {
  totalSpendCents: number;
  totalRevenueCents: number;
  blendedRoasBp: number;
  totalConversions: number;
  activeCreativesCount: number;
}

/** Validate sort field against an allowlist. Prevents SQL injection. */
const ALLOWED_SORT_FIELDS: Readonly<Record<SortByField, string>> = {
  spendCents: "spendCents",
  revenueCents: "revenueCents",
  roasBp: "roasBp",
  hookScore: "hookScore",
  watchScore: "watchScore",
  clickScore: "clickScore",
  convertScore: "convertScore",
  launchDate: "launchDate",
};

export function isValidSortField(field: string): field is SortByField {
  return field in ALLOWED_SORT_FIELDS;
}

/**
 * Main query: aggregated creative performance for a date range.
 *
 * Returns one row per creativeAsset with:
 *   - summed spend/impressions/etc across all ads using that creative
 *   - computed rates from summed counts
 *   - summed Hyros attribution joined by (adId, date)
 *   - latest score from creativeScores
 */
export async function getCreativePerformance(query: CreativePerfQuery): Promise<CreativePerfRow[]> {
  const dbConn = await db.getDb();
  if (!dbConn) return [];

  if (!isValidSortField(query.sortBy)) {
    throw new Error(`Invalid sortBy field: ${query.sortBy}`);
  }
  if (query.sortDirection !== "asc" && query.sortDirection !== "desc") {
    throw new Error(`Invalid sortDirection: ${query.sortDirection}`);
  }

  // Build WHERE clauses as separate SQL fragments
  const creativeTypeFilter = query.creativeType ? sql`AND ca.creativeType = ${query.creativeType}` : sql``;
  const campaignFilter = query.campaignId ? sql`AND a.campaignId = ${query.campaignId}` : sql``;
  const accountFilter = query.adAccountId ? sql`AND a.adAccountId = ${query.adAccountId}` : sql``;
  const angleFilter = query.messagingAngle ? sql`AND t.messagingAngle = ${query.messagingAngle}` : sql``;
  const tacticFilter = query.hookTactic ? sql`AND t.hookTactic = ${query.hookTactic}` : sql``;
  const needsTagJoin = !!(query.messagingAngle || query.hookTactic);

  // sortBy is pre-validated; use sql.raw carefully
  const sortColumn = ALLOWED_SORT_FIELDS[query.sortBy];
  const sortDir = query.sortDirection === "asc" ? sql`ASC` : sql`DESC`;

  const rows: any = await dbConn.execute(sql`
    SELECT
      ca.id AS creativeAssetId,
      ca.name AS creativeName,
      ca.thumbnailUrl,
      ca.creativeType,
      ca.pipelineRunId,
      MIN(a.launchDate) AS launchDate,
      COUNT(DISTINCT a.id) AS adCount,
      COALESCE(SUM(d.spendCents), 0) AS spendCents,
      COALESCE(SUM(d.impressions), 0) AS impressions,
      COALESCE(SUM(d.clicks), 0) AS clicks,
      COALESCE(SUM(d.reach), 0) AS reach,
      COALESCE(SUM(d.videoPlayCount), 0) AS videoPlayCount,
      COALESCE(SUM(d.video50Count), 0) AS video50Count,
      COALESCE(SUM(d.cpmCents), 0) AS sumCpmCents,
      COALESCE(COUNT(DISTINCT d.id), 0) AS dailyStatRowCount,
      COALESCE(attr.revenueCents, 0) AS revenueCents,
      COALESCE(attr.conversions, 0) AS conversions
    FROM creativeAssets ca
    JOIN ads a ON a.creativeAssetId = ca.id
    LEFT JOIN adDailyStats d ON d.adId = a.id
      AND d.date >= ${query.dateFrom}
      AND d.date <= ${query.dateTo}
      AND d.source = 'meta'
    LEFT JOIN (
      SELECT a2.creativeAssetId, SUM(attr.revenueCents) AS revenueCents, SUM(attr.conversions) AS conversions
      FROM adAttributionStats attr
      JOIN ads a2 ON a2.id = attr.adId
      WHERE attr.date >= ${query.dateFrom}
        AND attr.date <= ${query.dateTo}
        AND attr.attributionModel = ${ENV.hyrosAttributionModel}
      GROUP BY a2.creativeAssetId
    ) attr ON attr.creativeAssetId = ca.id
    ${needsTagJoin ? sql`INNER JOIN creativeAiTags t ON t.creativeAssetId = ca.id AND t.tagVersion = 1` : sql``}
    WHERE 1 = 1
      ${creativeTypeFilter}
      ${campaignFilter}
      ${accountFilter}
      ${angleFilter}
      ${tacticFilter}
    GROUP BY ca.id, ca.name, ca.thumbnailUrl, ca.creativeType, ca.pipelineRunId,
             attr.revenueCents, attr.conversions
    HAVING (spendCents > 0 OR revenueCents > 0)
      ${query.minSpendCents ? sql`AND spendCents >= ${query.minSpendCents}` : sql``}
    ORDER BY ${sql.raw(sortColumn)} ${sortDir}
    LIMIT ${query.limit}
    OFFSET ${query.offset}
  `);

  const resultRows: any[] = Array.isArray(rows[0]) ? rows[0] : rows;
  // Benchmarks are fetched once per request and reused for every row — they're
  // global to the account, not per-creative.
  const benchmarks = await getCachedBenchmarks();

  const mapped = resultRows.map((row: any) => {
    const impressions = Number(row.impressions) || 0;
    const spendCents = Number(row.spendCents) || 0;
    const clicks = Number(row.clicks) || 0;
    const videoPlayCount = Number(row.videoPlayCount) || 0;
    const video50Count = Number(row.video50Count) || 0;
    const revenueCents = Number(row.revenueCents) || 0;
    const conversions = Number(row.conversions) || 0;

    // Compute rates from summed counts (NEVER average rates)
    const ctrBp = impressions > 0 ? Math.round((clicks / impressions) * 10000) : 0;
    const thumbstopBp = impressions > 0 ? Math.round((videoPlayCount / impressions) * 10000) : 0;
    const holdRateBp = impressions > 0 ? Math.round((video50Count / impressions) * 10000) : 0;
    const roasBp = spendCents > 0 ? Math.round((revenueCents / spendCents) * 100) : 0;
    const cpaCents = conversions > 0 ? Math.round(spendCents / conversions) : 0;
    const aovCents = conversions > 0 ? Math.round(revenueCents / conversions) : 0;
    const dailyStatRowCount = Number(row.dailyStatRowCount) || 0;
    const cpmCents = dailyStatRowCount > 0 ? Math.round(Number(row.sumCpmCents) / dailyStatRowCount) : 0;

    // Scores computed from the same aggregates shown in the row — stays
    // self-consistent with spend/impressions/clicks/etc. no matter what
    // partial data sits in the latest creativeScores row.
    const scores = scoresFromAggregates(
      { impressions, clicks, videoPlayCount, video50Count, conversions, spendCents, revenueCents },
      benchmarks,
    );

    return {
      creativeAssetId: Number(row.creativeAssetId),
      creativeName: row.creativeName ?? "",
      thumbnailUrl: row.thumbnailUrl ?? null,
      creativeType: row.creativeType ?? "image",
      launchDate: row.launchDate ? new Date(row.launchDate) : null,
      adCount: Number(row.adCount) || 0,
      spendCents,
      impressions,
      clicks,
      reach: Number(row.reach) || 0,
      videoPlayCount,
      video50Count,
      ctrBp,
      thumbstopBp,
      holdRateBp,
      cpmCents,
      revenueCents,
      conversions,
      aovCents,
      roasBp,
      cpaCents,
      hookScore: scores.hookScore,
      watchScore: scores.watchScore,
      clickScore: scores.clickScore,
      convertScore: scores.convertScore,
      pipelineRunId: row.pipelineRunId ? Number(row.pipelineRunId) : null,
    };
  });

  // When the user sorts by a score column, SQL can't order by the on-the-fly
  // computed value — the DB query's ORDER BY hookScore is effectively a no-op
  // now that we removed the creativeScores JOIN. Re-sort in memory. The list
  // is capped to `query.limit` so the cost is bounded.
  if (["hookScore", "watchScore", "clickScore", "convertScore"].includes(query.sortBy)) {
    const key = query.sortBy as "hookScore" | "watchScore" | "clickScore" | "convertScore";
    const dir = query.sortDirection === "asc" ? 1 : -1;
    mapped.sort((a, b) => ((a[key] as number) - (b[key] as number)) * dir);
  }

  return mapped;
}

/**
 * Get the KPI strip summary for the same date range + filters.
 *
 * Each KPI is computed in its OWN isolated subquery rather than one big
 * multi-join, because the prior one-big-query approach could produce ~10x
 * inflated totals when a creative had many (ads × days) join rows — the
 * outer-level SUM(d.spendCents) + MAX(attr.*) relied on every (ca, a, d)
 * combination being 1:1 with a distinct adDailyStats row, which is only
 * true when the JOINs are tight. Any stray duplicate row downstream
 * multiplied spend and revenue by the same factor. Isolating each KPI in
 * its own SELECT makes the arithmetic inspectable and impossible to
 * cross-join. See ground-truth check in the /investigate report for
 * 2026-04-17 where dashboard was ~10x real.
 *
 * Also fixes activeCreatives — it used to COUNT(DISTINCT ca.id) across
 * every creative with any ad ever, ignoring the date window. Now it only
 * counts creatives with real spend in the window.
 */
export async function getCreativePerformanceSummary(query: Omit<CreativePerfQuery, "sortBy" | "sortDirection" | "limit" | "offset">): Promise<CreativePerfSummary> {
  const dbConn = await db.getDb();
  if (!dbConn) {
    return { totalSpendCents: 0, totalRevenueCents: 0, blendedRoasBp: 0, totalConversions: 0, activeCreativesCount: 0 };
  }

  // Filters applied to every subquery via JOIN through ads + creativeAssets
  // so outer filters (creativeType/campaign/account) scope all three KPIs.
  const creativeTypeFilter = query.creativeType ? sql`AND ca.creativeType = ${query.creativeType}` : sql``;
  const campaignFilter = query.campaignId ? sql`AND a.campaignId = ${query.campaignId}` : sql``;
  const accountFilter = query.adAccountId ? sql`AND a.adAccountId = ${query.adAccountId}` : sql``;

  // KPI 1 — Total Meta spend in the window.
  const spendRows: any = await dbConn.execute(sql`
    SELECT COALESCE(SUM(d.spendCents), 0) AS totalSpend
    FROM adDailyStats d
    JOIN ads a ON a.id = d.adId
    JOIN creativeAssets ca ON ca.id = a.creativeAssetId
    WHERE d.source = 'meta'
      AND d.date >= ${query.dateFrom}
      AND d.date <= ${query.dateTo}
      ${creativeTypeFilter}
      ${campaignFilter}
      ${accountFilter}
  `);
  const spendRow: any = (Array.isArray(spendRows[0]) ? spendRows[0][0] : spendRows[0]) ?? {};
  const totalSpend = Number(spendRow.totalSpend) || 0;

  // KPI 2 — Total Hyros attributed revenue + conversions in the window.
  // Explicit source='hyros' guard in case adAttributionStats ever holds
  // non-Hyros rows (e.g., future Meta/TikTok attribution feeds).
  const revenueRows: any = await dbConn.execute(sql`
    SELECT
      COALESCE(SUM(attr.revenueCents), 0) AS totalRevenue,
      COALESCE(SUM(attr.conversions), 0) AS totalConversions
    FROM adAttributionStats attr
    JOIN ads a ON a.id = attr.adId
    JOIN creativeAssets ca ON ca.id = a.creativeAssetId
    WHERE attr.source = 'hyros'
      AND attr.attributionModel = ${ENV.hyrosAttributionModel}
      AND attr.date >= ${query.dateFrom}
      AND attr.date <= ${query.dateTo}
      ${creativeTypeFilter}
      ${campaignFilter}
      ${accountFilter}
  `);
  const revenueRow: any = (Array.isArray(revenueRows[0]) ? revenueRows[0][0] : revenueRows[0]) ?? {};
  let totalRevenue = Number(revenueRow.totalRevenue) || 0;
  let totalConversions = Number(revenueRow.totalConversions) || 0;

  // KPI 3 — Active creatives = creatives with real spend in the window.
  // (Old query counted every creative with any ad ever, ignoring the date.)
  const activeRows: any = await dbConn.execute(sql`
    SELECT COUNT(DISTINCT ca.id) AS activeCreatives
    FROM creativeAssets ca
    JOIN ads a ON a.creativeAssetId = ca.id
    JOIN adDailyStats d ON d.adId = a.id
    WHERE d.source = 'meta'
      AND d.date >= ${query.dateFrom}
      AND d.date <= ${query.dateTo}
      AND d.spendCents > 0
      ${creativeTypeFilter}
      ${campaignFilter}
      ${accountFilter}
  `);
  const activeRow: any = (Array.isArray(activeRows[0]) ? activeRows[0][0] : activeRows[0]) ?? {};
  const activeCreativesCount = Number(activeRow.activeCreatives) || 0;

  // Add the UNATTRIBUTED bucket to totals when no per-creative filters are
  // active. Unattributed rows have no adId → no campaign, no creativeType, no
  // adAccount — so mixing them into a filtered view would leak revenue across
  // filter groups. When the user is looking at the account-wide KPI, though,
  // their total should match Hyros's dashboard, which counts these.
  const noFiltersActive = !query.creativeType && !query.campaignId && !query.adAccountId;
  if (noFiltersActive) {
    const unattrRows: any = await dbConn.execute(sql`
      SELECT
        COALESCE(SUM(revenueCents), 0) AS revenueCents,
        COALESCE(SUM(conversions), 0) AS conversions
      FROM adAttributionStats
      WHERE date >= ${query.dateFrom}
        AND date <= ${query.dateTo}
        AND attributionModel = ${ENV.hyrosAttributionModel}
        AND hyrosAdId = ${UNATTRIBUTED_HYROS_AD_ID}
    `);
    const unattr: any = (Array.isArray(unattrRows[0]) ? unattrRows[0][0] : unattrRows[0]) ?? {};
    totalRevenue += Number(unattr.revenueCents) || 0;
    totalConversions += Number(unattr.conversions) || 0;
  }

  const blendedRoasBp = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) : 0;
  return {
    totalSpendCents: totalSpend,
    totalRevenueCents: totalRevenue,
    blendedRoasBp,
    totalConversions,
    activeCreativesCount,
  };
}

/**
 * Fetch a single creative's performance row for a date range. Used by AdDetail
 * so it doesn't have to refetch the top-500 list just to find one creative and
 * so it respects the caller's date range (not a hardcoded 30-day fallback).
 *
 * Returns `null` if the creative doesn't exist or has no activity in range.
 */
export async function getCreativeRow(
  creativeAssetId: number,
  dateFrom: Date,
  dateTo: Date,
): Promise<CreativePerfRow | null> {
  const dbConn = await db.getDb();
  if (!dbConn) return null;

  const rows: any = await dbConn.execute(sql`
    SELECT
      ca.id AS creativeAssetId,
      ca.name AS creativeName,
      ca.thumbnailUrl,
      ca.creativeType,
      ca.pipelineRunId,
      MIN(a.launchDate) AS launchDate,
      COUNT(DISTINCT a.id) AS adCount,
      COALESCE(SUM(d.spendCents), 0) AS spendCents,
      COALESCE(SUM(d.impressions), 0) AS impressions,
      COALESCE(SUM(d.clicks), 0) AS clicks,
      COALESCE(SUM(d.reach), 0) AS reach,
      COALESCE(SUM(d.videoPlayCount), 0) AS videoPlayCount,
      COALESCE(SUM(d.video50Count), 0) AS video50Count,
      COALESCE(SUM(d.cpmCents), 0) AS sumCpmCents,
      COALESCE(COUNT(DISTINCT d.id), 0) AS dailyStatRowCount,
      COALESCE(attr.revenueCents, 0) AS revenueCents,
      COALESCE(attr.conversions, 0) AS conversions
    FROM creativeAssets ca
    JOIN ads a ON a.creativeAssetId = ca.id
    LEFT JOIN adDailyStats d ON d.adId = a.id
      AND d.date >= ${dateFrom}
      AND d.date <= ${dateTo}
      AND d.source = 'meta'
    LEFT JOIN (
      SELECT
        a3.creativeAssetId,
        SUM(attr.revenueCents) AS revenueCents,
        SUM(attr.conversions) AS conversions
      FROM adAttributionStats attr
      JOIN ads a3 ON a3.id = attr.adId
      WHERE attr.date >= ${dateFrom}
        AND attr.date <= ${dateTo}
        AND attr.attributionModel = ${ENV.hyrosAttributionModel}
      GROUP BY a3.creativeAssetId
    ) attr ON attr.creativeAssetId = ca.id
    WHERE ca.id = ${creativeAssetId}
    GROUP BY ca.id, ca.name, ca.thumbnailUrl, ca.creativeType, ca.pipelineRunId,
             attr.revenueCents, attr.conversions
    LIMIT 1
  `);

  const resultRows: any[] = Array.isArray(rows[0]) ? rows[0] : rows;
  const row = resultRows[0];
  if (!row) return null;

  const impressions = Number(row.impressions) || 0;
  const spendCents = Number(row.spendCents) || 0;
  const clicks = Number(row.clicks) || 0;
  const videoPlayCount = Number(row.videoPlayCount) || 0;
  const video50Count = Number(row.video50Count) || 0;
  const revenueCents = Number(row.revenueCents) || 0;
  const conversions = Number(row.conversions) || 0;

  const ctrBp = impressions > 0 ? Math.round((clicks / impressions) * 10000) : 0;
  const thumbstopBp = impressions > 0 ? Math.round((videoPlayCount / impressions) * 10000) : 0;
  const holdRateBp = impressions > 0 ? Math.round((video50Count / impressions) * 10000) : 0;
  const roasBp = spendCents > 0 ? Math.round((revenueCents / spendCents) * 100) : 0;
  const cpaCents = conversions > 0 ? Math.round(spendCents / conversions) : 0;
  const aovCents = conversions > 0 ? Math.round(revenueCents / conversions) : 0;
  const dailyStatRowCount = Number(row.dailyStatRowCount) || 0;
  const cpmCents = dailyStatRowCount > 0 ? Math.round(Number(row.sumCpmCents) / dailyStatRowCount) : 0;

  // Compute scores on-the-fly from the aggregated metrics. See scoresFromAggregates
  // for why this replaces the old "latest creativeScores row" lookup.
  const benchmarks = await getCachedBenchmarks();
  const scores = scoresFromAggregates(
    { impressions, clicks, videoPlayCount, video50Count, conversions, spendCents, revenueCents },
    benchmarks,
  );

  return {
    creativeAssetId: Number(row.creativeAssetId),
    creativeName: row.creativeName ?? "",
    thumbnailUrl: row.thumbnailUrl ?? null,
    creativeType: row.creativeType ?? "image",
    launchDate: row.launchDate ? new Date(row.launchDate) : null,
    adCount: Number(row.adCount) || 0,
    spendCents,
    impressions,
    clicks,
    reach: Number(row.reach) || 0,
    videoPlayCount,
    video50Count,
    ctrBp,
    thumbstopBp,
    holdRateBp,
    cpmCents,
    revenueCents,
    conversions,
    aovCents,
    roasBp,
    cpaCents,
    hookScore: scores.hookScore,
    watchScore: scores.watchScore,
    clickScore: scores.clickScore,
    convertScore: scores.convertScore,
    pipelineRunId: row.pipelineRunId ? Number(row.pipelineRunId) : null,
  };
}

/** Get the per-day time series for a single creative asset, for the detail page chart. */
export async function getCreativeTimeSeries(creativeAssetId: number, dateFrom: Date, dateTo: Date) {
  const dbConn = await db.getDb();
  if (!dbConn) return [];

  const rows: any = await dbConn.execute(sql`
    SELECT
      DATE(d.date) AS day,
      SUM(d.spendCents) AS spendCents,
      SUM(d.impressions) AS impressions,
      SUM(d.clicks) AS clicks,
      SUM(d.videoPlayCount) AS videoPlayCount,
      SUM(d.video50Count) AS video50Count,
      COALESCE(SUM(attr.revenueCents), 0) AS revenueCents,
      COALESCE(SUM(attr.conversions), 0) AS conversions
    FROM adDailyStats d
    JOIN ads a ON a.id = d.adId
    LEFT JOIN adAttributionStats attr ON attr.adId = d.adId AND DATE(attr.date) = DATE(d.date) AND attr.attributionModel = ${ENV.hyrosAttributionModel}
    WHERE a.creativeAssetId = ${creativeAssetId}
      AND d.date >= ${dateFrom}
      AND d.date <= ${dateTo}
      AND d.source = 'meta'
    GROUP BY DATE(d.date)
    ORDER BY DATE(d.date) ASC
  `);
  const seriesRows: any[] = Array.isArray(rows[0]) ? rows[0] : rows;
  return seriesRows.map((r) => {
    const spendCents = Number(r.spendCents) || 0;
    const revenueCents = Number(r.revenueCents) || 0;
    return {
      date: new Date(r.day),
      spendCents,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      revenueCents,
      conversions: Number(r.conversions) || 0,
      roasBp: spendCents > 0 ? Math.round((revenueCents / spendCents) * 100) : 0,
    };
  });
}
