/**
 * Creative Analytics score engine.
 *
 * Pure function (no DB access). Caller fetches inputs + benchmarks and calls
 * computeScores. Returns 0-100 scores for Hook / Watch / Click / Convert that
 * are account-relative percentiles of the underlying metrics.
 *
 * Methodology (account-relative percentiles):
 *   - Full coverage (60+ days of data, 20+ ads): pure percentile of this ad
 *     vs the account's 90-day distribution of each metric.
 *   - Partial coverage (30-60 days): blend 70% account-relative + 30% platform fallback.
 *   - Cold start (<30 days or <20 ads): 100% platform fallback.
 *
 * Metric → score mapping:
 *   Hook score   = percentile of thumbstopBp
 *   Watch score  = percentile of holdRateBp
 *   Click score  = percentile of ctrBp (primary) + outboundCtrBp (secondary, 0.3 weight if present)
 *   Convert score = percentile of roasBp (only when attribution available)
 *                   Falls back to conversion rate (conversions / clicks) if no ROAS.
 */

export interface ScoreInputs {
  thumbstopBp: number; // basis points x100 (35.4% = 35400)
  holdRateBp: number;
  ctrBp: number;
  outboundCtrBp: number;
  impressions: number;
  clicks: number;
  conversions: number; // from Hyros attribution
  spendCents: number;
  revenueCents: number; // from Hyros
}

export interface AccountBenchmarks {
  /** Percentile values (P25, P50, P75, P90) per metric. All in basis points where applicable. */
  thumbstop: { p25: number; p50: number; p75: number; p90: number };
  holdRate: { p25: number; p50: number; p75: number; p90: number };
  ctr: { p25: number; p50: number; p75: number; p90: number };
  /** ROAS percentiles in basis points (3.20x = 320). */
  roas: { p25: number; p50: number; p75: number; p90: number };
  /** Coverage indicator. "cold_start" → use fallback only. "partial" → blend. "full" → account-relative. */
  coverage: "cold_start" | "partial" | "full";
  /** Number of ads / days of data used to build these benchmarks. */
  sampleSize: { ads: number; days: number };
}

export interface ScoreBreakdownEntry {
  metric: string;
  valueBp: number;
  percentile: number;
  contribution: number;
}

export interface ScoreResult {
  hookScore: number; // 0-100
  watchScore: number;
  clickScore: number;
  convertScore: number;
  coverage: "cold_start" | "partial" | "full";
  breakdown: ScoreBreakdownEntry[];
}

/** Platform fallback benchmarks (industry averages for DTC on Meta). */
export const PLATFORM_FALLBACK: AccountBenchmarks = {
  thumbstop: { p25: 20000, p50: 30000, p75: 40000, p90: 50000 }, // 20%, 30%, 40%, 50%
  holdRate: { p25: 5000, p50: 10000, p75: 15000, p90: 20000 }, // 5%, 10%, 15%, 20%
  ctr: { p25: 5000, p50: 10000, p75: 15000, p90: 25000 }, // 0.5%, 1%, 1.5%, 2.5% → basis points x100
  roas: { p25: 100, p50: 200, p75: 300, p90: 500 }, // 1.00x, 2.00x, 3.00x, 5.00x
  coverage: "cold_start",
  sampleSize: { ads: 0, days: 0 },
};

/** Linear interpolation between two percentile values. */
function percentileScore(value: number, pcts: { p25: number; p50: number; p75: number; p90: number }): number {
  if (value <= 0) return 0;
  if (value >= pcts.p90) {
    // Above P90, extrapolate toward 100. P90 = 90, linear to some ceiling.
    const excess = value - pcts.p90;
    const headroom = pcts.p90; // assume another P90 worth of spread between P90 and P99
    return Math.min(100, 90 + Math.round((excess / Math.max(1, headroom)) * 10));
  }
  if (value >= pcts.p75) {
    // P75 to P90 → 75 to 90
    const frac = (value - pcts.p75) / Math.max(1, pcts.p90 - pcts.p75);
    return 75 + Math.round(frac * 15);
  }
  if (value >= pcts.p50) {
    const frac = (value - pcts.p50) / Math.max(1, pcts.p75 - pcts.p50);
    return 50 + Math.round(frac * 25);
  }
  if (value >= pcts.p25) {
    const frac = (value - pcts.p25) / Math.max(1, pcts.p50 - pcts.p25);
    return 25 + Math.round(frac * 25);
  }
  // Below P25: 0 to 25
  const frac = value / Math.max(1, pcts.p25);
  return Math.max(0, Math.round(frac * 25));
}

/** Blend two scores by coverage: full = 100% account, partial = 70/30, cold = 0/100. */
function blendScores(
  accountScore: number,
  fallbackScore: number,
  coverage: "cold_start" | "partial" | "full",
): number {
  if (coverage === "full") return accountScore;
  if (coverage === "cold_start") return fallbackScore;
  // partial: 70% account / 30% fallback
  return Math.round(accountScore * 0.7 + fallbackScore * 0.3);
}

function clamp(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

export function computeScores(inputs: ScoreInputs, benchmarks: AccountBenchmarks): ScoreResult {
  // Zero-division protection: if no impressions, all scores = 0
  if (inputs.impressions <= 0) {
    return {
      hookScore: 0,
      watchScore: 0,
      clickScore: 0,
      convertScore: 0,
      coverage: benchmarks.coverage,
      breakdown: [],
    };
  }

  const coverage = benchmarks.coverage;
  const breakdown: ScoreBreakdownEntry[] = [];

  // Hook score — based on thumbstop (video plays / impressions)
  const hookAccount = percentileScore(inputs.thumbstopBp, benchmarks.thumbstop);
  const hookFallback = percentileScore(inputs.thumbstopBp, PLATFORM_FALLBACK.thumbstop);
  const hookScore = clamp(blendScores(hookAccount, hookFallback, coverage));
  breakdown.push({ metric: "thumbstop", valueBp: inputs.thumbstopBp, percentile: hookScore, contribution: hookScore });

  // Watch score — based on hold rate (50% video views / impressions)
  const watchAccount = percentileScore(inputs.holdRateBp, benchmarks.holdRate);
  const watchFallback = percentileScore(inputs.holdRateBp, PLATFORM_FALLBACK.holdRate);
  const watchScore = clamp(blendScores(watchAccount, watchFallback, coverage));
  breakdown.push({ metric: "holdRate", valueBp: inputs.holdRateBp, percentile: watchScore, contribution: watchScore });

  // Click score — primary CTR + (optional) outbound CTR weighted blend
  const ctrAccount = percentileScore(inputs.ctrBp, benchmarks.ctr);
  const ctrFallback = percentileScore(inputs.ctrBp, PLATFORM_FALLBACK.ctr);
  const ctrScore = blendScores(ctrAccount, ctrFallback, coverage);
  let clickScore = ctrScore;
  if (inputs.outboundCtrBp > 0) {
    // Apply a small weight (30%) to outbound CTR if we have it
    const outboundAccount = percentileScore(inputs.outboundCtrBp, benchmarks.ctr);
    const outboundFallback = percentileScore(inputs.outboundCtrBp, PLATFORM_FALLBACK.ctr);
    const outboundScore = blendScores(outboundAccount, outboundFallback, coverage);
    clickScore = Math.round(ctrScore * 0.7 + outboundScore * 0.3);
  }
  clickScore = clamp(clickScore);
  breakdown.push({ metric: "ctr", valueBp: inputs.ctrBp, percentile: clickScore, contribution: clickScore });

  // Convert score — ROAS primary, fallback to conversion rate if no revenue data
  let convertScore = 0;
  if (inputs.spendCents > 0 && inputs.revenueCents > 0) {
    const roasBp = Math.round((inputs.revenueCents / inputs.spendCents) * 100);
    const roasAccount = percentileScore(roasBp, benchmarks.roas);
    const roasFallback = percentileScore(roasBp, PLATFORM_FALLBACK.roas);
    convertScore = clamp(blendScores(roasAccount, roasFallback, coverage));
    breakdown.push({ metric: "roas", valueBp: roasBp, percentile: convertScore, contribution: convertScore });
  } else if (inputs.clicks > 0 && inputs.conversions > 0) {
    // Fallback: conversion rate (conversions / clicks) in basis points x100
    const cvrBp = Math.round((inputs.conversions / inputs.clicks) * 10000);
    // Use a rough platform fallback for CVR: P50 ~ 200 (2%)
    const cvrFallback = { p25: 100, p50: 200, p75: 400, p90: 600 };
    convertScore = clamp(percentileScore(cvrBp, cvrFallback));
    breakdown.push({ metric: "cvr", valueBp: cvrBp, percentile: convertScore, contribution: convertScore });
  }

  return { hookScore, watchScore, clickScore, convertScore, coverage, breakdown };
}

/** Compute percentile values from a list of observations. Used to build account benchmarks. */
export function computePercentiles(values: number[]): { p25: number; p50: number; p75: number; p90: number } {
  if (values.length === 0) return { p25: 0, p50: 0, p75: 0, p90: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p: number): number => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return Math.round(sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo));
  };
  return {
    p25: pct(0.25),
    p50: pct(0.5),
    p75: pct(0.75),
    p90: pct(0.9),
  };
}

/** Determine coverage tier based on sample size. */
export function determineCoverage(adCount: number, daysOfData: number): "cold_start" | "partial" | "full" {
  if (adCount < 20 || daysOfData < 30) return "cold_start";
  if (adCount < 50 || daysOfData < 60) return "partial";
  return "full";
}
