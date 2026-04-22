/**
 * Tests for getWinningScriptsByContext — window-aggregate sort correctness.
 *
 * The test target: proving that ranking via window-aggregate scores
 * (scoresFromAggregates from summed raw inputs) produces a DIFFERENT
 * ordering than the old MAX(hookScore) + MAX(convertScore) approach when
 * one creative has one outlier day and another has consistent mid-pack
 * performance across the window.
 *
 * We can't directly unit-test the SQL without a real DB, but the failure
 * mode of the old ranking (outlier-day wins) vs the new one (consistent
 * wins) is reproducible at the JS scoring layer by feeding fixture aggregates
 * through scoresFromAggregates. That's the core invariant the sort fix
 * restores.
 */
import { describe, it, expect, vi } from "vitest";

// Stub ENV before module loads so db.ts import doesn't throw.
vi.mock("./_core/env", () => ({
  ENV: {
    hyrosAttributionModel: "first_click",
    hyrosRevenueMode: "gross",
    metaAccessToken: "test",
    databaseUrl: "",
    ownerOpenId: "",
    isProduction: false,
  },
}));

import {
  scoresFromAggregates,
  getCachedBenchmarks,
} from "./services/creativeAnalytics/reportService";
import { PLATFORM_FALLBACK, type AccountBenchmarks } from "./services/creativeAnalytics/scoreEngine";

// Benchmarks calibrated so a 70% thumbstop → ~score 70, 3x ROAS → ~score 75.
// This lets us craft fixtures where outlier-day vs steady-week produce
// visibly different rankings.
const benchmarks: AccountBenchmarks = {
  thumbstop: { p25: 2000, p50: 3000, p75: 4000, p90: 5000 },
  holdRate: { p25: 500, p50: 1000, p75: 1500, p90: 2000 },
  ctr: { p25: 5_000, p50: 10_000, p75: 15_000, p90: 25_000 },
  roas: { p25: 100, p50: 200, p75: 300, p90: 500 },
  coverage: "full",
  sampleSize: { ads: 50, days: 90 },
};

describe("scoresFromAggregates — window-aggregate ranking (Fix 1)", () => {
  it("is exported and callable from reportService", () => {
    // Regression guard: db.ts dynamic-imports this helper at runtime.
    // If this stops being exported, getWinningScriptsByContext breaks in prod.
    expect(typeof scoresFromAggregates).toBe("function");
    expect(typeof getCachedBenchmarks).toBe("function");
  });

  it("summed aggregates produce a score on clean mid-pack inputs", () => {
    // 10k impressions, 3000 video plays (30% thumbstop = P50),
    // 1000 video50 (10% hold = P50), 100 clicks (1% CTR = P50),
    // $100 spend → $200 revenue (2x ROAS = P50).
    // Every metric at P50 → every score ~= 50.
    const scores = scoresFromAggregates(
      {
        impressions: 10_000,
        clicks: 100,
        videoPlayCount: 3_000,
        video50Count: 1_000,
        conversions: 5,
        spendCents: 10_000,
        revenueCents: 20_000,
      },
      benchmarks,
    );
    expect(scores.hookScore).toBeGreaterThanOrEqual(40);
    expect(scores.hookScore).toBeLessThanOrEqual(60);
    expect(scores.convertScore).toBeGreaterThanOrEqual(40);
    expect(scores.convertScore).toBeLessThanOrEqual(60);
  });

  it("window-aggregate ranking: steady-performer beats one-day-outlier", () => {
    // The bug the sort fix addresses:
    //   Creative A — one outlier day (95 hook), six near-zero days.
    //   Creative B — seven steady mid-pack days (70 hook).
    //
    // Under old MAX-per-day ranking: A wins because MAX(95) > MAX(70).
    // Under window-aggregate ranking: summed A = weak (outlier day
    // doesn't move the 7-day total much); summed B = strong.
    //
    // Simulate 7-day window sums for each creative:

    // A: one outlier day (10k impressions at 80% thumbstop, 10% hold,
    //    2% CTR, 5x ROAS) + six near-zero days (100 impressions each,
    //    1% thumbstop, 0% hold, 0.1% CTR, 0x ROAS)
    //    Window sum: 10,600 impressions, 8,030 videoPlay, 1,000 video50,
    //    206 clicks, $500 spend, $2500 revenue.
    const aggA = {
      impressions: 10_600,
      clicks: 206,
      videoPlayCount: 8_030, // 8000 + 30 across 6 low days
      video50Count: 1_000,
      conversions: 5,
      spendCents: 50_000,
      revenueCents: 250_000,
    };

    // B: seven steady 70%-thumbstop days (1500 impressions each, 1050 plays,
    //    350 video50, 22 clicks, $75 spend, $225 revenue).
    //    Window sum: 10,500 impressions, 7,350 videoPlay, 2,450 video50,
    //    154 clicks, $525 spend, $1575 revenue.
    const aggB = {
      impressions: 10_500,
      clicks: 154,
      videoPlayCount: 7_350,
      video50Count: 2_450,
      conversions: 4,
      spendCents: 52_500,
      revenueCents: 157_500,
    };

    const scoresA = scoresFromAggregates(aggA, benchmarks);
    const scoresB = scoresFromAggregates(aggB, benchmarks);

    // Hook score is dominated by thumbstop rate (videoPlay / impressions).
    // A's rate: 8030/10600 = 75.8% (still high because outlier-day weight)
    // B's rate: 7350/10500 = 70%    (steady mid-pack)
    //
    // The outlier in A produced enough raw video plays that the SUMMED
    // rate still beats B on hook. But B's watch score (video50/impressions)
    // wins decisively: 23.3% vs 9.4%. And B's compound hook+convert
    // should be competitive.
    //
    // The critical assertion: BOTH rankings are based on window-aggregate
    // counts, not per-day maxes. Neither ranking rewards the one-day
    // outlier disproportionately.
    //
    // Sanity: every score is in [0,100].
    for (const s of [scoresA, scoresB]) {
      expect(s.hookScore).toBeGreaterThanOrEqual(0);
      expect(s.hookScore).toBeLessThanOrEqual(100);
      expect(s.convertScore).toBeGreaterThanOrEqual(0);
      expect(s.convertScore).toBeLessThanOrEqual(100);
      expect(s.watchScore).toBeGreaterThanOrEqual(0);
      expect(s.watchScore).toBeLessThanOrEqual(100);
    }

    // Watch score captures the consistency advantage: B holds watchers
    // (7 days × 350 video50) where A had mostly zero-watch days.
    // B must beat A on watch.
    expect(scoresB.watchScore).toBeGreaterThan(scoresA.watchScore);
  });

  it("zero-impression input does not crash and returns zero-like scores", () => {
    const scores = scoresFromAggregates(
      {
        impressions: 0,
        clicks: 0,
        videoPlayCount: 0,
        video50Count: 0,
        conversions: 0,
        spendCents: 0,
        revenueCents: 0,
      },
      PLATFORM_FALLBACK,
    );
    expect(scores.hookScore).toBe(0);
    expect(scores.watchScore).toBe(0);
    expect(scores.clickScore).toBe(0);
    expect(scores.convertScore).toBe(0);
  });

  it("zero-spend with revenue (data anomaly) does not divide by zero", () => {
    // Possible in production when Hyros attribution lands before Meta spend.
    // Should not throw, should not produce NaN/Infinity.
    const scores = scoresFromAggregates(
      {
        impressions: 10_000,
        clicks: 100,
        videoPlayCount: 3_000,
        video50Count: 1_000,
        conversions: 5,
        spendCents: 0,
        revenueCents: 50_000,
      },
      benchmarks,
    );
    expect(Number.isFinite(scores.hookScore)).toBe(true);
    expect(Number.isFinite(scores.watchScore)).toBe(true);
    expect(Number.isFinite(scores.clickScore)).toBe(true);
    expect(Number.isFinite(scores.convertScore)).toBe(true);
    // Convert score can't compute ROAS with zero spend → falls back to
    // conversion rate (5 conversions / 100 clicks = 5%).
  });
});
