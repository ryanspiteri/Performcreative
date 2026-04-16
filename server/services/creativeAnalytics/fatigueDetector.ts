/**
 * Creative Fatigue Detector — detects week-over-week score decline.
 *
 * Compares each creative's latest week's scores to the prior week's scores.
 * Flags creatives where hookScore OR convertScore dropped more than the
 * configured thresholds as "declining" or "fatigued."
 *
 * Runs after score recompute. Returns fatigue status per creative.
 */

import { sql } from "drizzle-orm";
import * as db from "../../db";

const TAG = "[FatigueDetector]";

// Thresholds (% decline relative to prior week)
const DECLINING_THRESHOLD = 15; // 15% drop = "declining"
const FATIGUED_THRESHOLD = 30;  // 30% drop = "fatigued"

export type FatigueStatus = "healthy" | "declining" | "fatigued";

export interface FatigueInfo {
  creativeAssetId: number;
  status: FatigueStatus;
  hookScorePriorWeek: number;
  hookScoreThisWeek: number;
  hookScoreDeltaPct: number;
  convertScorePriorWeek: number;
  convertScoreThisWeek: number;
  convertScoreDeltaPct: number;
}

/**
 * Compute fatigue status for all creatives with enough data.
 * Returns a map keyed by creativeAssetId.
 */
export async function detectFatigue(): Promise<Map<number, FatigueInfo>> {
  const dbConn = await db.getDb();
  if (!dbConn) return new Map();

  try {
    // Get average scores for the last 7 days (this week) and the 7 days before (prior week)
    // per creative, where they have impressions both periods
    const rows: any = await dbConn.execute(sql`
      SELECT
        creativeAssetId,
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN hookScore ELSE NULL END) AS hookThisWeek,
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)
                  AND date < DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN hookScore ELSE NULL END) AS hookPriorWeek,
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN convertScore ELSE NULL END) AS convertThisWeek,
        AVG(CASE WHEN date >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)
                  AND date < DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN convertScore ELSE NULL END) AS convertPriorWeek,
        SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN aggregatedImpressions ELSE 0 END) AS impressionsThisWeek,
        SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)
                  AND date < DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN aggregatedImpressions ELSE 0 END) AS impressionsPriorWeek
      FROM creativeScores
      WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)
      GROUP BY creativeAssetId
      HAVING impressionsThisWeek >= 100 AND impressionsPriorWeek >= 100
    `);

    const results = new Map<number, FatigueInfo>();

    for (const r of (Array.isArray(rows[0]) ? rows[0] : rows) as any[]) {
      const hookThisWeek = Number(r.hookThisWeek) || 0;
      const hookPriorWeek = Number(r.hookPriorWeek) || 0;
      const convertThisWeek = Number(r.convertThisWeek) || 0;
      const convertPriorWeek = Number(r.convertPriorWeek) || 0;

      const hookDelta = hookPriorWeek > 0 ? Math.round(((hookThisWeek - hookPriorWeek) / hookPriorWeek) * 100) : 0;
      const convertDelta = convertPriorWeek > 0 ? Math.round(((convertThisWeek - convertPriorWeek) / convertPriorWeek) * 100) : 0;

      // Use the worst drop as the fatigue signal
      const worstDelta = Math.min(hookDelta, convertDelta);

      let status: FatigueStatus = "healthy";
      if (worstDelta <= -FATIGUED_THRESHOLD) status = "fatigued";
      else if (worstDelta <= -DECLINING_THRESHOLD) status = "declining";

      results.set(Number(r.creativeAssetId), {
        creativeAssetId: Number(r.creativeAssetId),
        status,
        hookScorePriorWeek: Math.round(hookPriorWeek),
        hookScoreThisWeek: Math.round(hookThisWeek),
        hookScoreDeltaPct: hookDelta,
        convertScorePriorWeek: Math.round(convertPriorWeek),
        convertScoreThisWeek: Math.round(convertThisWeek),
        convertScoreDeltaPct: convertDelta,
      });
    }

    const fatiguedCount = Array.from(results.values()).filter(f => f.status === "fatigued").length;
    const decliningCount = Array.from(results.values()).filter(f => f.status === "declining").length;
    console.log(`${TAG} Detected ${fatiguedCount} fatigued, ${decliningCount} declining of ${results.size} creatives`);

    return results;
  } catch (err: any) {
    console.error(`${TAG} detectFatigue failed:`, err.message);
    return new Map();
  }
}

/**
 * Get fatigue info for a specific set of creativeAssetIds (for table display).
 * Returns a plain object keyed by id for JSON serialization.
 */
export async function getFatigueMap(creativeAssetIds: number[]): Promise<Record<number, FatigueInfo>> {
  if (creativeAssetIds.length === 0) return {};
  const fatigueMap = await detectFatigue();
  const result: Record<number, FatigueInfo> = {};
  for (const id of creativeAssetIds) {
    const info = fatigueMap.get(id);
    if (info) result[id] = info;
  }
  return result;
}
