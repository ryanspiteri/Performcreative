/**
 * Performance Banks — dynamic, data-driven replacements for static knowledge banks.
 *
 * Queries creativeAiTags + creativeScores + pipeline_runs to build ranked banks
 * from real ad performance. Static banks (HOOK_BANK, CTA_BANK) become the fallback
 * floor when data is sparse.
 *
 * Three banks:
 *   1. Dynamic Hook Bank — ranked hookTexts by hookTactic, from creativeAiTags
 *   2. Ranked Copy Levers — per-product scriptAngle ranked by ROAS
 *   3. Dynamic CTA Bank — per-funnelStage CTA patterns ranked by convertScore
 *
 * Cache: in-memory Map with 24h TTL. First request after restart rebuilds (~2-5s).
 */

import { sql } from "drizzle-orm";
import * as db from "../../db";
import {
  creativeAiTags,
  creativeScores,
  creativeAssets,
  pipelineRuns,
  ads,
  adDailyStats,
  adAttributionStats,
} from "../../../drizzle/schema";

const TAG = "[PerformanceBanks]";

// ─── Cache ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<string>>();

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: string): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

// ─── Dynamic Hook Bank ─────────────────────────────────────────────────────

interface RankedHook {
  hookTactic: string;
  hookText: string;
  avgHookScore: number;
  sampleSize: number;
}

/**
 * Build a performance-ranked hook bank from real creative data.
 * Returns a formatted prompt block. Falls back to empty string if insufficient data.
 */
export async function buildDynamicHookBank(
  product?: string,
  _funnelStage?: string,
  maxTokens = 2500
): Promise<string> {
  const cacheKey = `hookBank:${product || "all"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const d = await db.getDb();
  if (!d) return "";

  try {
    const productFilter = product
      ? sql`AND ca.name LIKE ${"%" + product + "%"}`
      : sql``;

    const rows = await d.execute(sql`
      SELECT
        t.hookTactic,
        t.hookText,
        AVG(cs.hookScore) AS avgHookScore,
        COUNT(DISTINCT t.creativeAssetId) AS sampleSize
      FROM ${creativeAiTags} t
      JOIN ${creativeScores} cs ON cs.creativeAssetId = t.creativeAssetId
      JOIN ${creativeAssets} ca ON ca.id = t.creativeAssetId
      WHERE t.hookText IS NOT NULL
        AND t.hookText != ''
        AND t.confidence >= 60
        AND cs.aggregatedImpressions >= 50
        ${productFilter}
      GROUP BY t.hookTactic, t.hookText
      HAVING COUNT(DISTINCT t.creativeAssetId) >= 2
      ORDER BY AVG(cs.hookScore) DESC
      LIMIT 20
    `);

    const ranked: RankedHook[] = ((rows as any)[0] || []).map((r: any) => ({
      hookTactic: r.hookTactic || "unknown",
      hookText: r.hookText || "",
      avgHookScore: Math.round(Number(r.avgHookScore) || 0),
      sampleSize: Number(r.sampleSize) || 0,
    }));

    if (ranked.length < 3) {
      console.log(`${TAG} Insufficient hook data (${ranked.length} entries), skipping dynamic bank`);
      return "";
    }

    // Format as ranked table
    const tableRows = ranked.map((h, i) =>
      `| ${i + 1} | ${h.hookTactic} | "${h.hookText.slice(0, 120)}" | ${h.avgHookScore} | ${h.sampleSize} |`
    ).join("\n");

    let block = `
PERFORMANCE-RANKED HOOK BANK (from real ad data — prioritize these patterns):
| Rank | Tactic | Hook Text | Avg Hook Score | Creatives |
|------|--------|-----------|----------------|-----------|
${tableRows}

Use these high-performing hooks as inspiration. The hooks ranked highest stopped the most real viewers from scrolling.`;

    // Truncate if over budget
    if (block.length > maxTokens * 4) {
      block = block.slice(0, maxTokens * 4) + "\n[truncated]";
    }

    setCache(cacheKey, block);
    console.log(`${TAG} Dynamic hook bank built: ${ranked.length} entries for ${product || "all products"}`);
    return block;
  } catch (err: any) {
    console.error(`${TAG} buildDynamicHookBank failed:`, err.message);
    return "";
  }
}

// ─── Ranked Copy Levers ────────────────────────────────────────────────────

interface RankedLever {
  scriptAngle: string;
  avgRoasBp: number;
  sampleSize: number;
}

/**
 * Rank a product's copy levers by actual ROAS performance.
 * Returns the levers array sorted by ROAS (highest first), or the original
 * order if insufficient data.
 */
export async function buildRankedCopyLevers(
  product: string,
  originalLevers: string[]
): Promise<{ levers: string[]; ranked: boolean; data: RankedLever[] }> {
  const cacheKey = `levers:${product}`;
  const cachedStr = getCached(cacheKey);
  if (cachedStr) {
    try {
      return JSON.parse(cachedStr);
    } catch { /* fall through */ }
  }

  const d = await db.getDb();
  if (!d) return { levers: originalLevers, ranked: false, data: [] };

  try {
    // Join: pipeline_runs -> creativeAssets -> ads -> adDailyStats for spend,
    //        and adAttributionStats for revenue. Compute ROAS per scriptAngle.
    const rows = await d.execute(sql`
      SELECT
        pr.scriptAngle,
        SUM(attr.revenueCents) AS totalRevenue,
        SUM(ds.spendCents) AS totalSpend,
        COUNT(DISTINCT ca.id) AS sampleSize
      FROM ${pipelineRuns} pr
      JOIN ${creativeAssets} ca ON ca.pipelineRunId = pr.id
      JOIN ${ads} a ON a.creativeAssetId = ca.id
      JOIN ${adDailyStats} ds ON ds.adId = a.id
      LEFT JOIN ${adAttributionStats} attr ON attr.adId = a.id AND attr.date = ds.date
      WHERE pr.product = ${product}
        AND pr.scriptAngle IS NOT NULL
        AND pr.scriptAngle != ''
        AND pr.status = 'completed'
      GROUP BY pr.scriptAngle
      HAVING SUM(ds.spendCents) >= 1000
    `);

    const ranked: RankedLever[] = ((rows as any)[0] || []).map((r: any) => {
      const revenue = Number(r.totalRevenue) || 0;
      const spend = Number(r.totalSpend) || 1;
      return {
        scriptAngle: r.scriptAngle as string,
        avgRoasBp: Math.round((revenue / spend) * 10000),
        sampleSize: Number(r.sampleSize) || 0,
      };
    }).sort((a: RankedLever, b: RankedLever) => b.avgRoasBp - a.avgRoasBp);

    if (ranked.length < 2) {
      console.log(`${TAG} Insufficient lever data for ${product} (${ranked.length} angles), using original order`);
      return { levers: originalLevers, ranked: false, data: [] };
    }

    // Re-sort originalLevers by ROAS rank. Levers not in the data keep their original position at the end.
    const rankedAngles = new Map(ranked.map((r, i) => [r.scriptAngle.toLowerCase(), i]));
    const sorted = [...originalLevers].sort((a, b) => {
      const aRank = rankedAngles.get(a.toLowerCase()) ?? 999;
      const bRank = rankedAngles.get(b.toLowerCase()) ?? 999;
      return aRank - bRank;
    });

    const result = { levers: sorted, ranked: true, data: ranked };
    setCache(cacheKey, JSON.stringify(result));
    console.log(`${TAG} Copy levers ranked for ${product}: ${ranked.length} angles with ROAS data`);
    return result;
  } catch (err: any) {
    console.error(`${TAG} buildRankedCopyLevers failed:`, err.message);
    return { levers: originalLevers, ranked: false, data: [] };
  }
}

// ─── Dynamic CTA Bank ──────────────────────────────────────────────────────

/**
 * Build a performance-ranked CTA bank from real creative data.
 * Returns a formatted prompt block, or empty string if insufficient data.
 */
export async function buildDynamicCTABank(
  _funnelStage?: string,
  maxTokens = 1000
): Promise<string> {
  const cacheKey = `ctaBank:${_funnelStage || "all"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const d = await db.getDb();
  if (!d) return "";

  try {
    // Get top creatives by convertScore, extract the last line of adCopyBody as CTA proxy
    const rows = await d.execute(sql`
      SELECT
        ca.adCopyBody,
        cs.convertScore,
        ca.creativeType
      FROM ${creativeAssets} ca
      JOIN ${creativeScores} cs ON cs.creativeAssetId = ca.id
      WHERE ca.adCopyBody IS NOT NULL
        AND ca.adCopyBody != ''
        AND cs.convertScore >= 70
        AND cs.aggregatedImpressions >= 100
      ORDER BY cs.convertScore DESC
      LIMIT 15
    `);

    const entries = ((rows as any)[0] || [])
      .map((r: any) => {
        const body = (r.adCopyBody || "") as string;
        // Extract last line as CTA proxy
        const lines = body.split("\n").filter((l: string) => l.trim().length > 10);
        const cta = lines.length > 0 ? lines[lines.length - 1].trim() : "";
        return { cta, convertScore: Number(r.convertScore) || 0 };
      })
      .filter((e: any) => e.cta.length > 10 && e.cta.length < 200);

    if (entries.length < 3) {
      console.log(`${TAG} Insufficient CTA data (${entries.length} entries), skipping dynamic CTA bank`);
      return "";
    }

    // Deduplicate similar CTAs
    const seen = new Set<string>();
    const unique = entries.filter((e: any) => {
      const key = e.cta.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);

    const tableRows = unique.map((e: any, i: number) =>
      `| ${i + 1} | "${e.cta.slice(0, 120)}" | ${e.convertScore} |`
    ).join("\n");

    let block = `
PERFORMANCE-RANKED CTA EXAMPLES (from real ad data):
| Rank | CTA Text | Convert Score |
|------|----------|---------------|
${tableRows}

These CTAs drove the highest conversion rates in recent campaigns.`;

    if (block.length > maxTokens * 4) {
      block = block.slice(0, maxTokens * 4) + "\n[truncated]";
    }

    setCache(cacheKey, block);
    console.log(`${TAG} Dynamic CTA bank built: ${unique.length} entries`);
    return block;
  } catch (err: any) {
    console.error(`${TAG} buildDynamicCTABank failed:`, err.message);
    return "";
  }
}

// ─── Intelligence Brief (for UI + prompt injection) ────────────────────────

export interface IntelligenceBrief {
  creativeCount: number;
  totalSpendCents: number;
  topHookTactic: { tactic: string; avgScore: number } | null;
  topMessagingAngle: { angle: string; avgScore: number } | null;
  worstCombination: { combination: string; avgScore: number } | null;
  topHooks: Array<{ hookText: string; hookScore: number }>;
  topLevers: Array<{ lever: string; roasBp: number }>;
}

/**
 * Build a creative intelligence brief for a given product.
 * Used by the UI card and can also be injected into prompts.
 */
export async function buildIntelligenceBrief(product: string): Promise<IntelligenceBrief | null> {
  const d = await db.getDb();
  if (!d) return null;

  try {
    // Creative count + spend for this product
    const summaryRows = await d.execute(sql`
      SELECT
        COUNT(DISTINCT ca.id) AS creativeCount,
        COALESCE(SUM(cs.aggregatedSpendCents), 0) AS totalSpendCents
      FROM ${creativeAssets} ca
      JOIN ${creativeScores} cs ON cs.creativeAssetId = ca.id
      WHERE ca.name LIKE ${"%" + product + "%"}
        AND cs.aggregatedImpressions >= 50
    `);
    const summary = (summaryRows as any)[0]?.[0];
    const creativeCount = Number(summary?.creativeCount) || 0;
    if (creativeCount < 3) return null;

    // Top hook tactic by avg hookScore
    const tacticRows = await d.execute(sql`
      SELECT
        t.hookTactic,
        AVG(cs.hookScore) AS avgScore,
        COUNT(DISTINCT t.creativeAssetId) AS cnt
      FROM ${creativeAiTags} t
      JOIN ${creativeScores} cs ON cs.creativeAssetId = t.creativeAssetId
      JOIN ${creativeAssets} ca ON ca.id = t.creativeAssetId
      WHERE ca.name LIKE ${"%" + product + "%"}
        AND t.confidence >= 60
        AND cs.aggregatedImpressions >= 50
      GROUP BY t.hookTactic
      HAVING COUNT(DISTINCT t.creativeAssetId) >= 2
      ORDER BY AVG(cs.hookScore) DESC
      LIMIT 1
    `);
    const topTactic = (tacticRows as any)[0]?.[0];

    // Top messaging angle
    const angleRows = await d.execute(sql`
      SELECT
        t.messagingAngle,
        AVG(cs.hookScore) AS avgScore,
        COUNT(DISTINCT t.creativeAssetId) AS cnt
      FROM ${creativeAiTags} t
      JOIN ${creativeScores} cs ON cs.creativeAssetId = t.creativeAssetId
      JOIN ${creativeAssets} ca ON ca.id = t.creativeAssetId
      WHERE ca.name LIKE ${"%" + product + "%"}
        AND t.confidence >= 60
        AND cs.aggregatedImpressions >= 50
      GROUP BY t.messagingAngle
      HAVING COUNT(DISTINCT t.creativeAssetId) >= 2
      ORDER BY AVG(cs.hookScore) DESC
      LIMIT 1
    `);
    const topAngle = (angleRows as any)[0]?.[0];

    // Top 3 hooks by hookScore
    const hookRows = await d.execute(sql`
      SELECT t.hookText, cs.hookScore
      FROM ${creativeAiTags} t
      JOIN ${creativeScores} cs ON cs.creativeAssetId = t.creativeAssetId
      JOIN ${creativeAssets} ca ON ca.id = t.creativeAssetId
      WHERE ca.name LIKE ${"%" + product + "%"}
        AND t.hookText IS NOT NULL AND t.hookText != ''
        AND t.confidence >= 60
        AND cs.aggregatedImpressions >= 50
      ORDER BY cs.hookScore DESC
      LIMIT 3
    `);
    const topHooks = ((hookRows as any)[0] || []).map((r: any) => ({
      hookText: r.hookText as string,
      hookScore: Number(r.hookScore) || 0,
    }));

    return {
      creativeCount,
      totalSpendCents: Number(summary?.totalSpendCents) || 0,
      topHookTactic: topTactic ? { tactic: topTactic.hookTactic, avgScore: Math.round(Number(topTactic.avgScore)) } : null,
      topMessagingAngle: topAngle ? { angle: topAngle.messagingAngle, avgScore: Math.round(Number(topAngle.avgScore)) } : null,
      worstCombination: null, // Populated in Wave 1j (pattern mining)
      topHooks,
      topLevers: [], // Populated when buildRankedCopyLevers runs
    };
  } catch (err: any) {
    console.error(`${TAG} buildIntelligenceBrief failed:`, err.message);
    return null;
  }
}
