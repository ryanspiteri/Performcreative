/**
 * Regression tests for the Sydney TZ helpers. The whole analytics stack
 * depends on these producing the same calendar day as Meta Ads Manager and
 * Hyros dashboard, so edge cases (DST flip, near-midnight UTC, bare YMD
 * parsing) need to be pinned.
 */
import { describe, expect, it } from "vitest";
import {
  formatYmdInTz,
  tzMidnightAsUtc,
  getTzOffsetMinutes,
  parseAndBucketToTz,
  REPORTING_TZ,
} from "./tzDates";

describe("formatYmdInTz", () => {
  it("returns Sydney calendar day for a UTC instant that has already rolled into next day Sydney", () => {
    // 2026-04-15 14:30 UTC = 2026-04-16 00:30 Sydney (AEST, UTC+10)
    const d = new Date("2026-04-15T14:30:00Z");
    expect(formatYmdInTz(d, REPORTING_TZ)).toBe("2026-04-16");
  });

  it("returns Sydney calendar day for morning-UTC that is same day Sydney afternoon", () => {
    // 2026-04-15 03:00 UTC = 2026-04-15 13:00 Sydney (AEST)
    const d = new Date("2026-04-15T03:00:00Z");
    expect(formatYmdInTz(d, REPORTING_TZ)).toBe("2026-04-15");
  });

  it("returns the ISO YYYY-MM-DD form (en-CA locale)", () => {
    expect(formatYmdInTz(new Date("2026-01-01T05:00:00Z"), REPORTING_TZ)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getTzOffsetMinutes", () => {
  it("returns +600 for Sydney in AEST (mid-year)", () => {
    // July is well inside AEST (no DST)
    const d = new Date("2026-07-15T00:00:00Z");
    expect(getTzOffsetMinutes(d, REPORTING_TZ)).toBe(600);
  });

  it("returns +660 for Sydney in AEDT (summer)", () => {
    // Early Jan is inside AEDT
    const d = new Date("2026-01-15T00:00:00Z");
    expect(getTzOffsetMinutes(d, REPORTING_TZ)).toBe(660);
  });
});

describe("tzMidnightAsUtc", () => {
  it("anchors to Sydney 00:00 AEST for a mid-April date (UTC-14h earlier)", () => {
    // A Date anywhere inside Sydney Apr 15 should return UTC 2026-04-14T14:00:00Z (Sydney 00:00 AEST).
    const d = new Date("2026-04-15T05:00:00Z"); // Sydney Apr 15 15:00
    const bucket = tzMidnightAsUtc(d, REPORTING_TZ);
    expect(bucket.toISOString()).toBe("2026-04-14T14:00:00.000Z");
  });

  it("anchors to Sydney 00:00 AEDT for a mid-January date (UTC-13h earlier)", () => {
    const d = new Date("2026-01-15T05:00:00Z"); // Sydney Jan 15 16:00 AEDT
    const bucket = tzMidnightAsUtc(d, REPORTING_TZ);
    expect(bucket.toISOString()).toBe("2026-01-14T13:00:00.000Z");
  });

  it("is idempotent: bucket(bucket(x)) == bucket(x)", () => {
    const d = new Date("2026-04-15T05:00:00Z");
    const once = tzMidnightAsUtc(d, REPORTING_TZ);
    const twice = tzMidnightAsUtc(once, REPORTING_TZ);
    expect(once.toISOString()).toBe(twice.toISOString());
  });
});

describe("parseAndBucketToTz", () => {
  it("treats a bare YYYY-MM-DD as a Sydney calendar day (no reinterpretation)", () => {
    const bucket = parseAndBucketToTz("2026-04-15", REPORTING_TZ);
    expect(bucket?.toISOString()).toBe("2026-04-14T14:00:00.000Z");
  });

  it("parses the Hyros 'Thu Apr 09 10:33:18 UTC 2026' format and buckets to Sydney day", () => {
    // 10:33 UTC Apr 9 = 20:33 Sydney Apr 9 (AEST). Bucket = Sydney Apr 9 00:00 = UTC Apr 8 14:00.
    const bucket = parseAndBucketToTz("Thu Apr 09 10:33:18 UTC 2026", REPORTING_TZ);
    expect(bucket?.toISOString()).toBe("2026-04-08T14:00:00.000Z");
  });

  it("parses ISO-8601 with offset and buckets correctly", () => {
    const bucket = parseAndBucketToTz("2026-04-09T20:31:52+10:00", REPORTING_TZ);
    expect(bucket?.toISOString()).toBe("2026-04-08T14:00:00.000Z");
  });

  it("returns null for null/undefined/empty string", () => {
    expect(parseAndBucketToTz(null)).toBeNull();
    expect(parseAndBucketToTz(undefined)).toBeNull();
    expect(parseAndBucketToTz("")).toBeNull();
  });

  it("returns null for garbage input instead of throwing", () => {
    expect(parseAndBucketToTz("not a date")).toBeNull();
  });
});
