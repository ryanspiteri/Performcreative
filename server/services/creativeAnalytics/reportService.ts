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
      COALESCE(attr.conversions, 0) AS conversions,
      COALESCE(cs.hookScore, 0) AS hookScore,
      COALESCE(cs.watchScore, 0) AS watchScore,
      COALESCE(cs.clickScore, 0) AS clickScore,
      COALESCE(cs.convertScore, 0) AS convertScore
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
    LEFT JOIN (
      SELECT cs2.creativeAssetId, cs2.hookScore, cs2.watchScore, cs2.clickScore, cs2.convertScore,
             ROW_NUMBER() OVER (PARTITION BY cs2.creativeAssetId ORDER BY cs2.date DESC) AS rn
      FROM creativeScores cs2
      WHERE cs2.date >= ${query.dateFrom}
        AND cs2.date <= ${query.dateTo}
    ) cs ON cs.creativeAssetId = ca.id AND cs.rn = 1
    ${needsTagJoin ? sql`INNER JOIN creativeAiTags t ON t.creativeAssetId = ca.id AND t.tagVersion = 1` : sql``}
    WHERE 1 = 1
      ${creativeTypeFilter}
      ${campaignFilter}
      ${accountFilter}
      ${angleFilter}
      ${tacticFilter}
    GROUP BY ca.id, ca.name, ca.thumbnailUrl, ca.creativeType, ca.pipelineRunId,
             attr.revenueCents, attr.conversions,
             cs.hookScore, cs.watchScore, cs.clickScore, cs.convertScore
    HAVING (spendCents > 0 OR revenueCents > 0)
      ${query.minSpendCents ? sql`AND spendCents >= ${query.minSpendCents}` : sql``}
    ORDER BY ${sql.raw(sortColumn)} ${sortDir}
    LIMIT ${query.limit}
    OFFSET ${query.offset}
  `);

  const resultRows: any[] = Array.isArray(rows[0]) ? rows[0] : rows;

  return resultRows.map((row: any) => {
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
      hookScore: Number(row.hookScore) || 0,
      watchScore: Number(row.watchScore) || 0,
      clickScore: Number(row.clickScore) || 0,
      convertScore: Number(row.convertScore) || 0,
      pipelineRunId: row.pipelineRunId ? Number(row.pipelineRunId) : null,
    };
  });
}

/**
 * Get the KPI strip summary for the same date range + filters.
 *
 * Prior bug (codex critical #2): the revenue subquery joined on `1 = 1` with
 * no creativeType/campaign/account filter. Selecting "Video only" would show
 * video spend against total account revenue, silently lying about ROAS. Fixed
 * by mirroring the same filters inside the revenue subquery via a JOIN through
 * ads + creativeAssets. Both the outer query and the subquery now respect the
 * same WHERE clauses.
 */
export async function getCreativePerformanceSummary(query: Omit<CreativePerfQuery, "sortBy" | "sortDirection" | "limit" | "offset">): Promise<CreativePerfSummary> {
  const dbConn = await db.getDb();
  if (!dbConn) {
    return { totalSpendCents: 0, totalRevenueCents: 0, blendedRoasBp: 0, totalConversions: 0, activeCreativesCount: 0 };
  }

  // Outer query filters
  const creativeTypeFilter = query.creativeType ? sql`AND ca.creativeType = ${query.creativeType}` : sql``;
  const campaignFilter = query.campaignId ? sql`AND a.campaignId = ${query.campaignId}` : sql``;
  const accountFilter = query.adAccountId ? sql`AND a.adAccountId = ${query.adAccountId}` : sql``;

  // Same filters reapplied inside the revenue subquery (aliased as ca2/a2)
  const creativeTypeFilterAttr = query.creativeType ? sql`AND ca2.creativeType = ${query.creativeType}` : sql``;
  const campaignFilterAttr = query.campaignId ? sql`AND a2.campaignId = ${query.campaignId}` : sql``;
  const accountFilterAttr = query.adAccountId ? sql`AND a2.adAccountId = ${query.adAccountId}` : sql``;

  const rows: any = await dbConn.execute(sql`
    SELECT
      COALESCE(SUM(d.spendCents), 0) AS totalSpend,
      COALESCE(attr.revenueCents, 0) AS totalRevenue,
      COALESCE(attr.conversions, 0) AS totalConversions,
      COUNT(DISTINCT ca.id) AS activeCreatives
    FROM creativeAssets ca
    JOIN ads a ON a.creativeAssetId = ca.id
    LEFT JOIN adDailyStats d ON d.adId = a.id
      AND d.date >= ${query.dateFrom}
      AND d.date <= ${query.dateTo}
      AND d.source = 'meta'
    LEFT JOIN (
      SELECT
        SUM(attr.revenueCents) AS revenueCents,
        SUM(attr.conversions) AS conversions
      FROM adAttributionStats attr
      JOIN ads a2 ON a2.id = attr.adId
      JOIN creativeAssets ca2 ON ca2.id = a2.creativeAssetId
      WHERE attr.date >= ${query.dateFrom}
        AND attr.date <= ${query.dateTo}
        AND attr.attributionModel = ${ENV.hyrosAttributionModel}
        ${creativeTypeFilterAttr}
        ${campaignFilterAttr}
        ${accountFilterAttr}
    ) attr ON 1 = 1
    WHERE 1 = 1
      ${creativeTypeFilter}
      ${campaignFilter}
      ${accountFilter}
  `);
  const row: any = (Array.isArray(rows[0]) ? rows[0][0] : rows[0]) ?? {};

  const totalSpend = Number(row.totalSpend) || 0;
  let totalRevenue = Number(row.totalRevenue) || 0;
  let totalConversions = Number(row.totalConversions) || 0;

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
    activeCreativesCount: Number(row.activeCreatives) || 0,
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
      COALESCE(attr.conversions, 0) AS conversions,
      COALESCE(cs.hookScore, 0) AS hookScore,
      COALESCE(cs.watchScore, 0) AS watchScore,
      COALESCE(cs.clickScore, 0) AS clickScore,
      COALESCE(cs.convertScore, 0) AS convertScore
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
    LEFT JOIN (
      SELECT cs2.creativeAssetId, cs2.hookScore, cs2.watchScore, cs2.clickScore, cs2.convertScore,
             ROW_NUMBER() OVER (PARTITION BY cs2.creativeAssetId ORDER BY cs2.date DESC) AS rn
      FROM creativeScores cs2
      WHERE cs2.date >= ${dateFrom}
        AND cs2.date <= ${dateTo}
    ) cs ON cs.creativeAssetId = ca.id AND cs.rn = 1
    WHERE ca.id = ${creativeAssetId}
    GROUP BY ca.id, ca.name, ca.thumbnailUrl, ca.creativeType, ca.pipelineRunId,
             attr.revenueCents, attr.conversions,
             cs.hookScore, cs.watchScore, cs.clickScore, cs.convertScore
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
    hookScore: Number(row.hookScore) || 0,
    watchScore: Number(row.watchScore) || 0,
    clickScore: Number(row.clickScore) || 0,
    convertScore: Number(row.convertScore) || 0,
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
