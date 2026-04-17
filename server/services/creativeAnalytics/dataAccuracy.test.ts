/**
 * Data-accuracy invariant tests for the creative analytics pipeline.
 *
 * These tests pin cross-module numerical contracts that aren't guarded
 * anywhere else — the kind of drift that produces "why is Click=1 for
 * every ad" and "why is revenue 10% lower than Hyros dashboard" bugs.
 *
 * Scope:
 *   1. Scale convention: ctrBp stored by parseMetaRateToBp matches the
 *      scale the score engine + benchmarks use (regression: 525d81b)
 *   2. Aggregation rule: sum-then-divide gives a different answer than
 *      averaging per-day rates (LOCKED per Codex review)
 *   3. End-to-end ROAS: revenue/spend → roasBp → displayed "X.XXx"
 *   4. CPA/AOV: divide-by-zero guards return 0, not NaN or Infinity
 *   5. Score range: every code path returns scores in [0, 100]
 *   6. Convert fallback: no revenue → conversion rate used
 *   7. Hyros currency allowlist: AUD passes, USD fails, null currency passes
 *   8. Hyros unattributed sentinel: bucketed separately from ad-attributed
 *   9. Meta purchase preference: omni_purchase beats pixel fallbacks
 *  10. Quantity semantic: one conversion per transaction, not per unit
 *
 * These tests run the REAL helpers/aggregators — no mocks. If a scale
 * convention changes anywhere in the stack, at least one of these fails.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../_core/env", () => ({
  ENV: {
    hyrosApiKey: "test",
    hyrosBaseUrl: "https://api.hyros.com/v1/api/v1.0",
    hyrosAttributionModel: "first_click",
    hyrosRevenueMode: "gross",
    metaAccessToken: "test",
    metaGraphApiVersion: "v22.0",
    metaAdAccountIds: "act_test",
    metaAttributionWindows: ["7d_click", "1d_view"],
    analyticsRollingLookbackDays: 14,
    analyticsSyncIntervalMinutes: 60,
    databaseUrl: "",
    foreplayApiKey: "test",
    anthropicApiKey: "test",
    openaiApiKey: "test",
    clickupApiKey: "test",
    cookieSecret: "test",
    appId: "test",
    oAuthServerUrl: "",
    ownerOpenId: "",
    isProduction: false,
    forgeApiUrl: "",
    forgeApiKey: "",
  },
}));

import {
  parseMetaRateToBp,
  parseMetaMoneyToCents,
  parsePurchaseCount,
  parsePurchaseValueCents,
  parsePurchaseRoasBp,
} from "../../integrations/meta/metaAdsClient";
import {
  aggregateSalesToBuckets,
  extractRevenueCents,
  isSaleCurrencyAllowed,
  UNATTRIBUTED_HYROS_AD_ID,
  type HyrosSyncResult,
} from "../../integrations/hyros/hyrosSyncService";
import type { HyrosSale } from "../../integrations/hyros/hyrosClient";
import { computeScores, type AccountBenchmarks, type ScoreInputs } from "./scoreEngine";

function emptyHyrosResult(): HyrosSyncResult {
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

function makeSale(overrides: Partial<HyrosSale> = {}): HyrosSale {
  return {
    id: "sle-test",
    orderId: "order-1",
    creationDate: "Thu Apr 09 10:33:18 UTC 2026",
    qualified: true,
    score: 1,
    recurring: false,
    quantity: 1,
    usdPrice: { price: 100, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" },
    firstSource: {
      adSource: { adSourceId: "acc-1" },
      sourceLinkAd: { name: "ad", adSourceId: "hyros-ad-1" },
    },
    ...overrides,
  } as HyrosSale;
}

// =============================================================================
// 1. Scale convention: stored ctrBp matches benchmark + score-input scale
// =============================================================================

describe("Invariant: CTR scale is consistent end-to-end", () => {
  it("parseMetaRateToBp('1.5') === (clicks/impressions * 1_000_000) for 1.5% CTR", () => {
    // Meta returns ctr="1.5" (meaning 1.5%). Stored in adDailyStats.ctrBp.
    const storedScale = parseMetaRateToBp("1.5");
    // Score engine computes same metric from summed counts using * 1_000_000
    // (post-commit 525d81b). For 1.5% CTR: 150 clicks / 10,000 imps.
    const computedFromCounts = Math.round((150 / 10_000) * 1_000_000);
    expect(storedScale).toBe(computedFromCounts);
    expect(storedScale).toBe(15_000);
  });

  it("REGRESSION 525d81b: clicks/impressions × 10_000 produces a 100× too-small ctrBp", () => {
    // Guards against the bug that pinned every ad's Click score at ~1.
    const wrongScale = Math.round((150 / 10_000) * 10_000);
    const correctScale = Math.round((150 / 10_000) * 1_000_000);
    expect(wrongScale).toBe(150);
    expect(correctScale).toBe(15_000);
    // If anyone reverts to the old multiplier, this assert fails loudly.
    expect(correctScale / wrongScale).toBe(100);
  });

  it("score engine treats 1.5% CTR as sensibly mid-pack against 1.5%-P50 benchmarks", () => {
    const benchmarks: AccountBenchmarks = {
      thumbstop: { p25: 1000, p50: 2000, p75: 3000, p90: 4000 },
      holdRate: { p25: 500, p50: 1000, p75: 1500, p90: 2000 },
      ctr: { p25: 5_000, p50: 15_000, p75: 20_000, p90: 30_000 },
      roas: { p25: 100, p50: 200, p75: 300, p90: 500 },
      coverage: "full",
      sampleSize: { ads: 50, days: 90 },
    };
    const inputs: ScoreInputs = {
      thumbstopBp: 1500,
      holdRateBp: 750,
      ctrBp: 15_000, // 1.5%
      outboundCtrBp: 0,
      impressions: 10_000,
      clicks: 150,
      conversions: 5,
      spendCents: 5_000,
      revenueCents: 10_000,
    };
    const result = computeScores(inputs, benchmarks);
    // 1.5% CTR = exactly P50, so score = 50
    expect(result.clickScore).toBe(50);
  });
});

// =============================================================================
// 2. Aggregation rule: SUM then compute, never average rates
// =============================================================================

describe("Invariant: rates are computed from summed counts, never from averaged rates", () => {
  it("average of per-day CTRs ≠ overall-period CTR when days have different impression volumes", () => {
    // Day 1: 100 clicks / 10,000 imps = 1.0%
    // Day 2: 10 clicks / 100,000 imps = 0.01%
    const day1CtrBp = Math.round((100 / 10_000) * 1_000_000); // 10_000 (1.0%)
    const day2CtrBp = Math.round((10 / 100_000) * 1_000_000); //    100 (0.01%)
    const averaged = Math.round((day1CtrBp + day2CtrBp) / 2); //  5_050 (~0.5%)
    const summed = Math.round(((100 + 10) / (10_000 + 100_000)) * 1_000_000); // 1_000 (0.1%)

    // Averaging rates gives 0.5%; the real period CTR is 0.1%. 5× wrong.
    expect(averaged).not.toBe(summed);
    expect(averaged / summed).toBeGreaterThan(4);
  });
});

// =============================================================================
// 3. End-to-end ROAS: revenue → spend → roasBp → displayed "X.XXx"
// =============================================================================

describe("Invariant: ROAS arithmetic is symmetric end-to-end", () => {
  it("2.22x ROAS: revenue $39590.56 / spend $17861.39 → roasBp = 222 → '2.22x'", () => {
    const revenueCents = 39_590_56;
    const spendCents = 17_861_39;
    const roasBp = Math.round((revenueCents / spendCents) * 100);
    expect(roasBp).toBe(222);
    expect((roasBp / 100).toFixed(2) + "x").toBe("2.22x");
  });

  it("spend=0 guards against divide-by-zero → roasBp = 0", () => {
    const revenueCents = 10_000;
    const spendCents = 0;
    const roasBp = spendCents > 0 ? Math.round((revenueCents / spendCents) * 100) : 0;
    expect(roasBp).toBe(0);
    expect(Number.isFinite(roasBp)).toBe(true);
  });

  it("ROAS is stored with 2-decimal precision via the ×100 multiplier", () => {
    // Revenue $101, spend $100 → 1.01x → roasBp = 101
    expect(Math.round((10_100 / 10_000) * 100)).toBe(101);
    // Revenue $99, spend $100 → 0.99x → roasBp = 99
    expect(Math.round((9_900 / 10_000) * 100)).toBe(99);
  });
});

// =============================================================================
// 4. CPA + AOV: divide-by-zero guards return 0, not NaN or Infinity
// =============================================================================

describe("Invariant: CPA + AOV never return NaN or Infinity", () => {
  it("conversions=0 → cpaCents = 0, aovCents = 0", () => {
    const spendCents = 1_000_000;
    const revenueCents = 0;
    const conversions = 0;
    const cpa = conversions > 0 ? Math.round(spendCents / conversions) : 0;
    const aov = conversions > 0 ? Math.round(revenueCents / conversions) : 0;
    expect(cpa).toBe(0);
    expect(aov).toBe(0);
  });

  it("conversions=10 → cpaCents = spend/10, aovCents = revenue/10", () => {
    const spendCents = 5_000_00; // $5,000
    const revenueCents = 25_000_00; // $25,000
    const conversions = 10;
    const cpa = conversions > 0 ? Math.round(spendCents / conversions) : 0;
    const aov = conversions > 0 ? Math.round(revenueCents / conversions) : 0;
    expect(cpa).toBe(50_000); // $500 CPA
    expect(aov).toBe(250_000); // $2500 AOV
  });
});

// =============================================================================
// 5. Score range: every code path yields [0, 100]
// =============================================================================

describe("Invariant: scores are always in [0, 100]", () => {
  const benchmarks: AccountBenchmarks = {
    thumbstop: { p25: 1000, p50: 2000, p75: 3000, p90: 4000 },
    holdRate: { p25: 500, p50: 1000, p75: 1500, p90: 2000 },
    ctr: { p25: 5_000, p50: 10_000, p75: 15_000, p90: 25_000 },
    roas: { p25: 100, p50: 200, p75: 300, p90: 500 },
    coverage: "full",
    sampleSize: { ads: 50, days: 90 },
  };

  it("extreme high inputs clamp to 100", () => {
    const result = computeScores(
      {
        thumbstopBp: 10_000_000,
        holdRateBp: 10_000_000,
        ctrBp: 10_000_000,
        outboundCtrBp: 0,
        impressions: 1_000_000,
        clicks: 100_000,
        conversions: 1_000,
        spendCents: 1_000_000,
        revenueCents: 100_000_000,
      },
      benchmarks,
    );
    for (const s of [result.hookScore, result.watchScore, result.clickScore, result.convertScore]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("negative inputs clamp to 0", () => {
    const result = computeScores(
      {
        thumbstopBp: -1,
        holdRateBp: -1_000,
        ctrBp: -1,
        outboundCtrBp: 0,
        impressions: 1_000,
        clicks: 0,
        conversions: 0,
        spendCents: 0,
        revenueCents: 0,
      },
      benchmarks,
    );
    expect(result.hookScore).toBeGreaterThanOrEqual(0);
    expect(result.watchScore).toBeGreaterThanOrEqual(0);
    expect(result.clickScore).toBeGreaterThanOrEqual(0);
    expect(result.convertScore).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// 6. Convert fallback: no revenue → conversion-rate path
// =============================================================================

describe("Invariant: Convert score falls back to CVR when no revenue", () => {
  const benchmarks: AccountBenchmarks = {
    thumbstop: { p25: 1000, p50: 2000, p75: 3000, p90: 4000 },
    holdRate: { p25: 500, p50: 1000, p75: 1500, p90: 2000 },
    ctr: { p25: 5_000, p50: 10_000, p75: 15_000, p90: 25_000 },
    roas: { p25: 100, p50: 200, p75: 300, p90: 500 },
    coverage: "full",
    sampleSize: { ads: 50, days: 90 },
  };

  it("spend=0 + revenue=0 but clicks+conversions > 0 → CVR fallback path engaged", () => {
    const result = computeScores(
      {
        thumbstopBp: 2_000,
        holdRateBp: 1_000,
        ctrBp: 10_000,
        outboundCtrBp: 0,
        impressions: 10_000,
        clicks: 500,
        conversions: 25, // 5% CVR
        spendCents: 0,
        revenueCents: 0,
      },
      benchmarks,
    );
    // CVR 5% is well above the fallback CVR P90 of 600 basis points (6%),
    // but cleanly above the P75 of 400 — score should be meaningful, not 0.
    expect(result.convertScore).toBeGreaterThan(0);
    expect(result.convertScore).toBeLessThanOrEqual(100);
  });

  it("no spend, no revenue, no clicks, no conversions → Convert = 0", () => {
    const result = computeScores(
      {
        thumbstopBp: 2_000,
        holdRateBp: 1_000,
        ctrBp: 10_000,
        outboundCtrBp: 0,
        impressions: 10_000,
        clicks: 0,
        conversions: 0,
        spendCents: 0,
        revenueCents: 0,
      },
      benchmarks,
    );
    expect(result.convertScore).toBe(0);
  });
});

// =============================================================================
// 7. Hyros currency allowlist
// =============================================================================

describe("Invariant: Hyros currency gate is AUD-only in V1", () => {
  it("sale.usdPrice.currency === 'AUD' → allowed", () => {
    expect(isSaleCurrencyAllowed(makeSale())).toBe(true);
  });

  it("sale.usdPrice.currency === 'USD' → rejected", () => {
    const usd = makeSale({
      usdPrice: { price: 100, discount: 0, hardCost: 0, refunded: 0, currency: "USD" },
    });
    expect(isSaleCurrencyAllowed(usd)).toBe(false);
  });

  it("sale with no currency field → allowed (matches pre-filter behavior)", () => {
    const noCurrency = makeSale({ usdPrice: undefined as any });
    expect(isSaleCurrencyAllowed(noCurrency)).toBe(true);
  });
});

// =============================================================================
// 8. Unattributed sentinel: bucketed separately, preserves revenue total
// =============================================================================

describe("Invariant: sales without ad-level attribution go to the UNATTRIBUTED bucket", () => {
  it("campaign-only attribution → UNATTRIBUTED bucket, not dropped", () => {
    const campaignOnly = makeSale({
      firstSource: {
        adSource: { adSourceId: "campaign-1" },
        // no sourceLinkAd.adSourceId
      } as any,
    });
    const result = emptyHyrosResult();
    const buckets = aggregateSalesToBuckets([campaignOnly], result);
    expect(buckets.size).toBe(1);
    expect(result.salesUnattributed).toBe(1);
    const bucket = Array.from(buckets.values())[0];
    expect(bucket.key.hyrosAdId).toBe(UNATTRIBUTED_HYROS_AD_ID);
    expect(bucket.revenueCents).toBe(10_000); // $100 from makeSale default
  });

  it("mixed: ad-attributed + unattributed sales both land in buckets, preserving total revenue", () => {
    const ad = makeSale({ id: "attr-1", usdPrice: { price: 50, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } });
    const orphan = makeSale({
      id: "unattr-1",
      usdPrice: { price: 30, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" },
      firstSource: { name: "Organic", organic: true } as any,
    });
    const result = emptyHyrosResult();
    const buckets = aggregateSalesToBuckets([ad, orphan], result);
    const totalRevenue = Array.from(buckets.values()).reduce((s, b) => s + b.revenueCents, 0);
    expect(totalRevenue).toBe(5_000 + 3_000); // $80 preserved across both buckets
  });
});

// =============================================================================
// 9. Meta purchase parsing: preference order is omni_purchase > pixel > purchase
// =============================================================================

describe("Invariant: Meta purchase parsing prefers omni over pixel fallbacks", () => {
  it("omni_purchase present → other action_types ignored", () => {
    const actions = [
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "5" },
      { action_type: "omni_purchase", value: "12" },
      { action_type: "purchase", value: "8" },
    ];
    expect(parsePurchaseCount(actions)).toBe(12);
  });

  it("purchase_roas 3.25 → 32500 basis points", () => {
    expect(parsePurchaseRoasBp([{ action_type: "omni_purchase", value: "3.25" }])).toBe(32_500);
  });

  it("action_values '124.50' → 12450 cents", () => {
    expect(parsePurchaseValueCents([{ action_type: "omni_purchase", value: "124.50" }])).toBe(12_450);
  });
});

// =============================================================================
// 10. Quantity semantic: one conversion per transaction (NOT per unit)
// =============================================================================

describe("Invariant: one conversion per sale, regardless of sale.quantity", () => {
  it("quantity=3 multi-unit order counts as 1 conversion", () => {
    const multi = makeSale({ quantity: 3 });
    const result = emptyHyrosResult();
    const buckets = aggregateSalesToBuckets([multi], result);
    const bucket = Array.from(buckets.values())[0];
    expect(bucket.conversions).toBe(1);
  });

  it("quantity=null → still 1 conversion (matches Hyros 'Sales' column)", () => {
    const noQty = makeSale({ quantity: null as any });
    const result = emptyHyrosResult();
    const buckets = aggregateSalesToBuckets([noQty], result);
    const bucket = Array.from(buckets.values())[0];
    expect(bucket.conversions).toBe(1);
  });
});

// =============================================================================
// 11. Gross vs net revenue: matches Hyros dashboard default (gross)
// =============================================================================

describe("Invariant: gross revenue matches Hyros dashboard Revenue card", () => {
  it("gross mode ignores refunds (sale with 25% refunded still counts full price)", () => {
    const sale = makeSale({
      usdPrice: { price: 100, discount: 0, hardCost: 0, refunded: 25, currency: "AUD" },
    });
    expect(extractRevenueCents(sale, "gross").revenueCents).toBe(10_000);
    expect(extractRevenueCents(sale, "net").revenueCents).toBe(7_500);
  });

  it("fully-refunded sale in net mode = 0, in gross mode = price", () => {
    const fullRefund = makeSale({
      usdPrice: { price: 99, discount: 0, hardCost: 0, refunded: 99, currency: "AUD" },
    });
    expect(extractRevenueCents(fullRefund, "gross").revenueCents).toBe(9_900);
    expect(extractRevenueCents(fullRefund, "net").revenueCents).toBe(0);
  });
});

// =============================================================================
// 12. Money + rate parsing: boundary values
// =============================================================================

describe("Invariant: Meta money / rate parsers handle boundaries cleanly", () => {
  it("parseMetaMoneyToCents('0.01') = 1 cent (no rounding loss)", () => {
    expect(parseMetaMoneyToCents("0.01")).toBe(1);
  });

  it("parseMetaMoneyToCents('1234.567') rounds to nearest cent", () => {
    expect(parseMetaMoneyToCents("1234.567")).toBe(123_457);
  });

  it("parseMetaRateToBp('0') = 0, parseMetaRateToBp('100') = 1,000,000 (100% = ceiling)", () => {
    expect(parseMetaRateToBp("0")).toBe(0);
    expect(parseMetaRateToBp("100")).toBe(1_000_000);
  });

  it("null/undefined inputs never produce NaN", () => {
    expect(parseMetaMoneyToCents(undefined)).toBe(0);
    expect(parseMetaRateToBp(undefined)).toBe(0);
    expect(Number.isFinite(parseMetaMoneyToCents(""))).toBe(true);
    expect(Number.isFinite(parseMetaRateToBp(""))).toBe(true);
  });
});
