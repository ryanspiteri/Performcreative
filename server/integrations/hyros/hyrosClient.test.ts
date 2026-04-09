/**
 * Unit tests for hyrosClient helpers and Zod schema boundary parsing.
 *
 * These are pure-function tests — no axios mock needed for parseHyrosDate or
 * bucketDateToUtcMidnight or the schema parser. The shape-drift regression
 * case (usdPrice as number vs object) is covered here so the exact bug that
 * caused the 0-row sync can never silently reappear.
 */
import { describe, expect, it } from "vitest";
import { parseHyrosDate, bucketDateToUtcMidnight } from "./hyrosClient";
import {
  HyrosSaleSchema,
  parseHyrosSalesResponse,
  HyrosShapeError,
} from "./hyrosSchemas";

describe("parseHyrosDate", () => {
  it("parses the Java Date format returned by /sales", () => {
    const d = parseHyrosDate("Thu Apr 09 10:33:18 UTC 2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(d!.getUTCDate()).toBe(9);
    expect(d!.getUTCHours()).toBe(10);
    expect(d!.getUTCMinutes()).toBe(33);
  });

  it("parses ISO 8601 with timezone (lead/clickDate format)", () => {
    const d = parseHyrosDate("2026-04-09T20:31:52+10:00");
    expect(d).not.toBeNull();
    // 20:31:52 +10:00 = 10:31:52 UTC
    expect(d!.getUTCHours()).toBe(10);
    expect(d!.getUTCMinutes()).toBe(31);
  });

  it("returns null for undefined / null / empty", () => {
    expect(parseHyrosDate(undefined)).toBeNull();
    expect(parseHyrosDate(null)).toBeNull();
    expect(parseHyrosDate("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseHyrosDate("not a date")).toBeNull();
    expect(parseHyrosDate("2026-13-99")).toBeNull();
  });
});

describe("bucketDateToUtcMidnight", () => {
  it("rounds a timestamp to UTC midnight of the same day", () => {
    const d = new Date("2026-04-09T15:45:00Z");
    const bucket = bucketDateToUtcMidnight(d);
    expect(bucket.toISOString()).toBe("2026-04-09T00:00:00.000Z");
  });

  it("does not mutate the input", () => {
    const d = new Date("2026-04-09T15:45:00Z");
    const before = d.getTime();
    bucketDateToUtcMidnight(d);
    expect(d.getTime()).toBe(before);
  });
});

describe("HyrosSaleSchema", () => {
  const validSale = {
    id: "sle-abc",
    orderId: "11982778106223",
    creationDate: "Thu Apr 09 10:33:18 UTC 2026",
    qualified: true,
    score: 1,
    recurring: false,
    quantity: 1,
    usdPrice: {
      price: 111.76053392,
      discount: 11.34934756,
      hardCost: 38.86334784,
      refunded: 0.0,
      currency: "AUD",
    },
    firstSource: {
      adSource: { adSourceId: "120248392781030538" },
      sourceLinkAd: { name: "Creative", adSourceId: "120248900448440538" },
    },
  };

  it("parses a well-formed sale", () => {
    const result = HyrosSaleSchema.safeParse(validSale);
    expect(result.success).toBe(true);
  });

  it("REGRESSION: rejects the legacy usdPrice-as-number shape via response parser", () => {
    // This is the exact shape that the old TS type claimed was correct. If a
    // future response has this shape, we want to fail loudly at the boundary,
    // not silently NaN-bomb the DB upsert.
    const legacyShape = {
      result: [{ ...validSale, usdPrice: 49.95 }],
    };
    expect(() => parseHyrosSalesResponse(legacyShape)).toThrow(HyrosShapeError);
  });

  it("accepts a sale with no usdPrice (will be counted as $0 downstream)", () => {
    const { usdPrice, ...noPrice } = validSale;
    const result = HyrosSaleSchema.safeParse(noPrice);
    expect(result.success).toBe(true);
  });

  it("accepts a sale with price: null (Zod nullish allows it)", () => {
    const nullPrice = {
      ...validSale,
      usdPrice: { price: null, discount: 0, hardCost: 0, refunded: 0, currency: "AUD" },
    };
    const result = HyrosSaleSchema.safeParse(nullPrice);
    expect(result.success).toBe(true);
  });
});

describe("parseHyrosSalesResponse", () => {
  it("returns the parsed response on a valid payload", () => {
    const payload = {
      result: [],
      nextPageId: "abc",
      request_id: "req-1",
    };
    const parsed = parseHyrosSalesResponse(payload);
    expect(parsed.result).toEqual([]);
    expect(parsed.nextPageId).toBe("abc");
  });

  it("throws HyrosShapeError with fieldPath on missing required field", () => {
    const payload = { nextPageId: "abc" }; // missing result
    try {
      parseHyrosSalesResponse(payload);
      throw new Error("expected HyrosShapeError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(HyrosShapeError);
      expect(err.message).toContain("shape mismatch");
    }
  });

  it("throws HyrosShapeError if result is not an array", () => {
    expect(() => parseHyrosSalesResponse({ result: "not-an-array" })).toThrow(HyrosShapeError);
  });
});
