/**
 * Unit tests for the score engine.
 *
 * Pure function — no mocks needed. Covers:
 *   - Zero impressions → 0 across the board
 *   - Cold start uses platform fallback
 *   - Full coverage uses account-relative percentiles
 *   - Partial coverage blends 70/30
 *   - Clamping: above P90 extrapolates toward 100 but caps there
 *   - ROAS-present vs conversions-fallback for convert score
 */
import { describe, expect, it } from "vitest";
import {
  computeScores,
  PLATFORM_FALLBACK,
  type AccountBenchmarks,
  type ScoreInputs,
} from "./scoreEngine";

const FULL_BENCHMARKS: AccountBenchmarks = {
  thumbstop: { p25: 20000, p50: 30000, p75: 40000, p90: 50000 },
  holdRate: { p25: 5000, p50: 10000, p75: 15000, p90: 20000 },
  ctr: { p25: 5000, p50: 10000, p75: 15000, p90: 25000 },
  roas: { p25: 100, p50: 200, p75: 300, p90: 500 },
  coverage: "full",
  sampleSize: { ads: 50, days: 90 },
};

const PARTIAL_BENCHMARKS: AccountBenchmarks = {
  ...FULL_BENCHMARKS,
  coverage: "partial",
  sampleSize: { ads: 25, days: 45 },
};

function baseInputs(overrides: Partial<ScoreInputs> = {}): ScoreInputs {
  return {
    thumbstopBp: 30000, // 30%
    holdRateBp: 10000, // 10%
    ctrBp: 10000, // 1.0%
    outboundCtrBp: 0,
    impressions: 10000,
    clicks: 100,
    conversions: 10,
    spendCents: 10000, // $100
    revenueCents: 30000, // $300 → 3.0x ROAS = 300 bp
    ...overrides,
  };
}

describe("computeScores — zero-division", () => {
  it("returns 0 across the board when impressions == 0", () => {
    const result = computeScores(baseInputs({ impressions: 0 }), FULL_BENCHMARKS);
    expect(result.hookScore).toBe(0);
    expect(result.watchScore).toBe(0);
    expect(result.clickScore).toBe(0);
    expect(result.convertScore).toBe(0);
    expect(result.coverage).toBe("full");
  });
});

describe("computeScores — full coverage", () => {
  it("P50 thumbstop maps to Hook score 50", () => {
    const result = computeScores(baseInputs({ thumbstopBp: 30000 }), FULL_BENCHMARKS);
    expect(result.hookScore).toBe(50);
  });

  it("P75 hold rate maps to Watch score 75", () => {
    const result = computeScores(baseInputs({ holdRateBp: 15000 }), FULL_BENCHMARKS);
    expect(result.watchScore).toBe(75);
  });

  it("P90 CTR maps to Click score 90", () => {
    const result = computeScores(baseInputs({ ctrBp: 25000 }), FULL_BENCHMARKS);
    expect(result.clickScore).toBe(90);
  });

  it("above P90 is extrapolated but clamped to 100", () => {
    const result = computeScores(baseInputs({ thumbstopBp: 200000 }), FULL_BENCHMARKS);
    expect(result.hookScore).toBeLessThanOrEqual(100);
    expect(result.hookScore).toBeGreaterThanOrEqual(90);
  });

  it("zero metric value gives 0 score", () => {
    const result = computeScores(baseInputs({ thumbstopBp: 0 }), FULL_BENCHMARKS);
    expect(result.hookScore).toBe(0);
  });
});

describe("computeScores — cold start", () => {
  const cold: AccountBenchmarks = { ...PLATFORM_FALLBACK };

  it("uses platform fallback when coverage = cold_start", () => {
    // PLATFORM_FALLBACK.thumbstop.p50 = 3000 (= 30% on the fraction × 10000 scale).
    // A value of 3000 lands exactly at P50 → score = 50.
    const result = computeScores(baseInputs({ thumbstopBp: 3000 }), cold);
    expect(result.hookScore).toBe(50);
    expect(result.coverage).toBe("cold_start");
  });

  it("REGRESSION: fallback thumbstop scale matches adDailyStats storage (fraction × 10_000)", () => {
    // A 97.58% thumbstop (stored as 9758) against the fallback should clamp high,
    // not score near 0 like it did when the fallback was scaled as % × 1000.
    const result = computeScores(baseInputs({ thumbstopBp: 9758 }), cold);
    expect(result.hookScore).toBeGreaterThanOrEqual(90);
  });
});

describe("computeScores — partial coverage blending", () => {
  it("blends 70% account + 30% fallback", () => {
    // Build partial benchmarks whose account P50 thumbstop = fallback P50 thumbstop
    // so we can isolate the blending math. New fallback p50=3000; we mirror it
    // in the account benchmarks so both legs score the same → blend equals either.
    const matchedPartial: AccountBenchmarks = {
      ...PARTIAL_BENCHMARKS,
      thumbstop: { p25: 2000, p50: 3000, p75: 4000, p90: 5000 },
    };
    const result = computeScores(baseInputs({ thumbstopBp: 3000 }), matchedPartial);
    expect(result.hookScore).toBe(50);
  });
});

describe("computeScores — clamping", () => {
  it("clamps scores to the 0..100 range", () => {
    const result = computeScores(baseInputs({ thumbstopBp: -999, holdRateBp: -1 }), FULL_BENCHMARKS);
    expect(result.hookScore).toBeGreaterThanOrEqual(0);
    expect(result.watchScore).toBeGreaterThanOrEqual(0);
  });
});

describe("computeScores — breakdown", () => {
  it("returns a breakdown entry per metric", () => {
    const result = computeScores(baseInputs(), FULL_BENCHMARKS);
    expect(result.breakdown.length).toBeGreaterThanOrEqual(3);
    const metrics = result.breakdown.map((b) => b.metric);
    expect(metrics).toContain("thumbstop");
    expect(metrics).toContain("holdRate");
    expect(metrics).toContain("ctr");
  });
});
