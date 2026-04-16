/**
 * Pattern Miner — detects pattern breakers in creative performance data.
 *
 * Runs after score recompute. Compares each creative's performance against
 * the expected score for its tag combination. Flags creatives that outperform
 * expectations by > 1 standard deviation as "pattern breakers" — evidence
 * that the current intelligence may be incomplete.
 *
 * This prevents the intelligence system from becoming a self-fulfilling
 * prophecy that only recommends what's already been tried.
 */

import { sql } from "drizzle-orm";
import * as db from "../../db";
import {
  creativeAiTags,
  creativeScores,
  creativeAssets,
} from "../../../drizzle/schema";
import type { InsertPatternInsight } from "../../../drizzle/schema";

const TAG = "[PatternMiner]";
const MIN_SAMPLE_SIZE = 5; // Minimum creatives per combination for reliable stats

interface CombinationStats {
  combination: string;
  dimension: string;
  meanHookScore: number;
  stddev: number;
  sampleSize: number;
}

interface CreativeCandidate {
  creativeAssetId: number;
  hookTactic: string;
  messagingAngle: string;
  hookScore: number;
  convertScore: number;
}

/**
 * Detect pattern breakers: creatives that outperform their expected category.
 * Compares each creative's hookScore against the mean for its (hookTactic, messagingAngle)
 * combination. Flags those > 1 stddev above mean in a below-median combination.
 */
export async function detectPatternBreakers(): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;

  try {
    // Step 1: Get per-combination stats (mean + stddev of hookScore)
    const statsRows = await d.execute(sql`
      SELECT
        t.hookTactic,
        t.messagingAngle,
        AVG(cs.hookScore) AS meanHookScore,
        STDDEV_POP(cs.hookScore) AS stddevHookScore,
        COUNT(DISTINCT t.creativeAssetId) AS sampleSize
      FROM ${creativeAiTags} t
      JOIN ${creativeScores} cs ON cs.creativeAssetId = t.creativeAssetId
      WHERE t.confidence >= 60
        AND cs.aggregatedImpressions >= 100
      GROUP BY t.hookTactic, t.messagingAngle
      HAVING COUNT(DISTINCT t.creativeAssetId) >= ${MIN_SAMPLE_SIZE}
    `);

    const stats: CombinationStats[] = ((statsRows as any)[0] || []).map((r: any) => ({
      combination: `${r.hookTactic}+${r.messagingAngle}`,
      dimension: "hookTactic+messagingAngle",
      meanHookScore: Number(r.meanHookScore) || 0,
      stddev: Number(r.stddevHookScore) || 0,
      sampleSize: Number(r.sampleSize) || 0,
    }));

    if (stats.length < 3) {
      console.log(`${TAG} Insufficient combination data (${stats.length} combos), skipping`);
      return 0;
    }

    // Compute the global median hookScore across all combinations
    const sortedMeans = stats.map(s => s.meanHookScore).sort((a, b) => a - b);
    const globalMedian = sortedMeans[Math.floor(sortedMeans.length / 2)];

    // Step 2: Find individual creatives in below-median combinations that outperform
    const belowMedianCombos = stats.filter(s => s.meanHookScore < globalMedian);
    if (belowMedianCombos.length === 0) {
      console.log(`${TAG} No below-median combinations found, skipping`);
      return 0;
    }

    let insightsInserted = 0;

    for (const combo of belowMedianCombos) {
      if (combo.stddev < 5) continue; // Skip combos with very low variance

      const threshold = combo.meanHookScore + combo.stddev;
      const [tactic, angle] = combo.combination.split("+");

      // Find creatives in this combo that exceed threshold
      const breakerRows = await d.execute(sql`
        SELECT
          t.creativeAssetId,
          t.hookTactic,
          t.messagingAngle,
          cs.hookScore,
          cs.convertScore
        FROM ${creativeAiTags} t
        JOIN ${creativeScores} cs ON cs.creativeAssetId = t.creativeAssetId
        WHERE t.hookTactic = ${tactic}
          AND t.messagingAngle = ${angle}
          AND t.confidence >= 60
          AND cs.aggregatedImpressions >= 100
          AND cs.hookScore > ${Math.round(threshold)}
        ORDER BY cs.hookScore DESC
        LIMIT 5
      `);

      for (const r of (breakerRows as any)[0] || []) {
        const actual = Number(r.hookScore) || 0;
        const deviation = combo.stddev > 0 ? Math.round((actual - combo.meanHookScore) / combo.stddev) : 0;

        const insight: InsertPatternInsight = {
          creativeAssetId: r.creativeAssetId,
          insightType: "pattern_breaker",
          dimension: "hookTactic+messagingAngle",
          combination: combo.combination,
          expectedScore: Math.round(combo.meanHookScore),
          actualScore: actual,
          deviation,
          insight: `${angle} angle with ${tactic} hook achieved hookScore ${actual} (expected ${Math.round(combo.meanHookScore)}, ${deviation} stddev above). This below-median combination outperformed — consider testing more.`,
        };

        await db.insertPatternInsight(insight);
        insightsInserted++;
      }
    }

    console.log(`${TAG} Pattern breaker detection complete: ${insightsInserted} insights stored`);
    return insightsInserted;
  } catch (err: any) {
    console.error(`${TAG} detectPatternBreakers failed:`, err.message);
    return 0;
  }
}
