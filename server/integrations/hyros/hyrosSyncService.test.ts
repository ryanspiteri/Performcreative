/**
 * Regression + coverage tests for the Hyros aggregator.
 *
 * The bug this file guards against: `sale.usdPrice` is an object
 * `{ price, discount, hardCost, refunded, currency }`, not a number.
 * The prior code did `(sale.usdPrice ?? 0) * 100`, producing NaN, and every
 * DB upsert silently failed inside a catch-all `console.warn`. Zero rows
 * landed. Revenue columns showed $0 for ~a week.
 *
 * These tests feed the real (scrubbed) Hyros fixture plus hostile-QA cases
 * through the aggregator so the regression can never come back quietly.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import path from "path";
import { readFileSync } from "fs";

// Mock ENV before importing anything that touches it.
vi.mock("../../_core/env", () => ({
  ENV: {
    hyrosApiKey: "test",
    hyrosBaseUrl: "https://api.hyros.com/v1/api/v1.0",
    hyrosAttributionModel: "first_click",
    hyrosRevenueMode: "gross",
    analyticsRollingLookbackDays: 14,
    analyticsSyncIntervalMinutes: 60,
    // Other ENV keys consumed by sibling modules during import chain:
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
    databaseUrl: "",
  },
}));

import {
  aggregateSalesToBuckets,
  extractNetRevenueCents,
  extractRevenueCents,
  UNATTRIBUTED_HYROS_AD_ID,
  type HyrosSyncResult,
} from "./hyrosSyncService";
import type { HyrosSale } from "./hyrosClient";

function emptyResult(): HyrosSyncResult {
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

function loadRealFixture(): HyrosSale[] {
  const p = path.resolve(__dirname, "../../../test/fixtures/hyros-sales-sample.json");
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return raw.result as HyrosSale[];
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
    usdPrice: {
      price: 100.0,
      discount: 0,
      hardCost: 0,
      refunded: 0,
      currency: "AUD",
    },
    firstSource: {
      adSource: { adSourceId: "120248392781030538" },
      sourceLinkAd: { name: "ad", adSourceId: "120248900448440538" },
    },
    ...overrides,
  } as HyrosSale;
}

describe("extractNetRevenueCents", () => {
  it("returns net revenue in cents when price and refunded are present", () => {
    const { revenueCents, reason } = extractNetRevenueCents(
      makeSale({ usdPrice: { price: 99.99, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } }),
    );
    expect(revenueCents).toBe(9999);
    expect(reason).toBeUndefined();
  });

  it("subtracts refunded from price", () => {
    const { revenueCents } = extractNetRevenueCents(
      makeSale({ usdPrice: { price: 100, discount: 0, hardCost: 0, refunded: 25, currency: "AUD" } }),
    );
    expect(revenueCents).toBe(7500);
  });

  it("clamps refund-greater-than-price to 0 (never returns negative revenue)", () => {
    const { revenueCents } = extractNetRevenueCents(
      makeSale({ usdPrice: { price: 50, discount: 0, hardCost: 0, refunded: 99, currency: "AUD" } }),
    );
    expect(revenueCents).toBe(0);
  });

  it("REGRESSION: object usdPrice does not produce NaN", () => {
    // The exact case the aggregator bug hit: usdPrice is an object. Old code
    // did (obj ?? 0) * 100 -> NaN. Verify the new code extracts .price.
    const { revenueCents } = extractNetRevenueCents(
      makeSale({
        usdPrice: {
          price: 111.76053392,
          discount: 11.34934756,
          hardCost: 38.86334784,
          refunded: 0.0,
          currency: "AUD",
        },
      }),
    );
    expect(Number.isFinite(revenueCents)).toBe(true);
    expect(revenueCents).toBe(11176); // Math.round(111.76053392 * 100)
  });

  it("returns 0 + reason='missing' when usdPrice is undefined", () => {
    const sale = makeSale();
    delete (sale as any).usdPrice;
    const { revenueCents, reason } = extractNetRevenueCents(sale);
    expect(revenueCents).toBe(0);
    expect(reason).toBe("missing");
  });

  it("returns 0 + reason='missing' when usdPrice.price is null", () => {
    const { revenueCents, reason } = extractNetRevenueCents(
      makeSale({ usdPrice: { price: null as any, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } }),
    );
    expect(revenueCents).toBe(0);
    expect(reason).toBe("missing");
  });

  it("returns 0 for non-finite input without exploding", () => {
    const { revenueCents } = extractNetRevenueCents(
      makeSale({ usdPrice: { price: NaN as any, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } }),
    );
    expect(revenueCents).toBe(0);
  });
});

describe("extractRevenueCents (gross vs net modes)", () => {
  it("gross mode returns price as cents, ignoring refunds (matches Hyros dashboard)", () => {
    const { revenueCents } = extractRevenueCents(
      makeSale({ usdPrice: { price: 100, discount: 0, hardCost: 0, refunded: 25, currency: "AUD" } }),
      "gross",
    );
    expect(revenueCents).toBe(10000);
  });

  it("net mode subtracts refunded from price", () => {
    const { revenueCents } = extractRevenueCents(
      makeSale({ usdPrice: { price: 100, discount: 0, hardCost: 0, refunded: 25, currency: "AUD" } }),
      "net",
    );
    expect(revenueCents).toBe(7500);
  });
});

describe("aggregateSalesToBuckets", () => {
  let result: HyrosSyncResult;
  beforeEach(() => {
    result = emptyResult();
  });

  it("REGRESSION: real Hyros fixture produces finite, non-NaN bucket totals", () => {
    const sales = loadRealFixture();
    const buckets = aggregateSalesToBuckets(sales, result);

    // At least some sales in the fixture have ad-level attribution
    expect(buckets.size).toBeGreaterThan(0);

    for (const bucket of buckets.values()) {
      expect(Number.isFinite(bucket.revenueCents)).toBe(true);
      expect(Number.isNaN(bucket.revenueCents)).toBe(false);
      expect(bucket.revenueCents).toBeGreaterThanOrEqual(0);
      expect(bucket.conversions).toBeGreaterThanOrEqual(1);
      expect(bucket.key.hyrosAdId).toBeTruthy();
      expect(bucket.key.attributionModel).toBe("first_click");
    }

    // At least one bucket should have non-zero revenue (if the scrubbed
    // fixture still has usdPrice.price populated, which it does).
    const withRevenue = Array.from(buckets.values()).filter((b) => b.revenueCents > 0);
    expect(withRevenue.length).toBeGreaterThan(0);
  });

  it("aggregates multiple sales on the same day + same ad into one bucket, counting each sale as 1 conversion", () => {
    const day = "Thu Apr 09 10:00:00 UTC 2026";
    const sale1 = makeSale({ id: "s1", creationDate: day, quantity: 1, usdPrice: { price: 50, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } });
    const sale2 = makeSale({ id: "s2", creationDate: day, quantity: 2, usdPrice: { price: 75, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } });

    const buckets = aggregateSalesToBuckets([sale1, sale2], result);
    expect(buckets.size).toBe(1);
    const bucket = Array.from(buckets.values())[0];
    expect(bucket.revenueCents).toBe(5000 + 7500);
    // Two transactions — ignore quantity-as-units. Matches Hyros "Sales" column.
    expect(bucket.conversions).toBe(2);
  });

  it("routes sales without sourceLinkAd.adSourceId to the UNATTRIBUTED bucket", () => {
    const organic = makeSale({
      id: "org",
      firstSource: { name: "Email", disregarded: true, organic: true },
    });
    const buckets = aggregateSalesToBuckets([organic], result);
    // Sale IS bucketed (so it counts in totals), just to the unattributed sentinel.
    expect(buckets.size).toBe(1);
    expect(result.salesUnattributed).toBe(1);
    expect(result.salesSkipped).toBe(0);
    const bucket = Array.from(buckets.values())[0];
    expect(bucket.key.hyrosAdId).toBe(UNATTRIBUTED_HYROS_AD_ID);
  });

  it("skips sales with invalid creationDate and increments salesSkipped", () => {
    const bad = makeSale({ id: "bad", creationDate: "not a date" });
    const buckets = aggregateSalesToBuckets([bad], result);
    expect(buckets.size).toBe(0);
    expect(result.salesSkipped).toBe(1);
  });

  it("still creates a bucket when usdPrice is missing, but counts conversions with $0 revenue", () => {
    const sale = makeSale({ id: "noprice" });
    delete (sale as any).usdPrice;
    const buckets = aggregateSalesToBuckets([sale], result);
    expect(buckets.size).toBe(1);
    const bucket = Array.from(buckets.values())[0];
    expect(bucket.revenueCents).toBe(0);
    expect(bucket.conversions).toBe(1);
  });

  it("handles an empty sales array cleanly", () => {
    const buckets = aggregateSalesToBuckets([], result);
    expect(buckets.size).toBe(0);
    expect(result.salesSkipped).toBe(0);
  });

  it("skips non-AUD sales (USD store filter) and increments salesSkippedCurrency", () => {
    const usdSale = makeSale({
      id: "us-sale",
      usdPrice: { price: 120, discount: 0, hardCost: 0, refunded: 0, currency: "USD" },
    });
    const audSale = makeSale({
      id: "au-sale",
      usdPrice: { price: 150, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" },
    });
    const buckets = aggregateSalesToBuckets([usdSale, audSale], result);
    expect(buckets.size).toBe(1);
    expect(result.salesSkippedCurrency).toBe(1);
    expect(result.salesSkipped).toBe(0);
    const bucket = Array.from(buckets.values())[0];
    expect(bucket.revenueCents).toBe(15000); // only the AUD sale made it through
  });

  it("dedups sales by id across multiple calls (same page, different page, doesn't matter)", () => {
    const seen = new Set<string>();
    const sale = makeSale({ id: "dup-1" });
    aggregateSalesToBuckets([sale], result, seen);
    aggregateSalesToBuckets([sale], result, seen);
    expect(result.salesDeduped).toBe(1);
  });

  it("chaos test: hostile QA dump doesn't crash the aggregator", () => {
    const hostileSales: HyrosSale[] = [
      makeSale({ id: "h1", usdPrice: null as any }),
      makeSale({ id: "h2", usdPrice: { price: undefined as any, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } }),
      makeSale({ id: "h3", usdPrice: { price: Infinity, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" } }),
      makeSale({ id: "h4", creationDate: "garbage" }),
      makeSale({ id: "h5", quantity: undefined as any }),
      makeSale({ id: "h6", firstSource: undefined }),
    ];
    expect(() => aggregateSalesToBuckets(hostileSales, result)).not.toThrow();
  });
});
