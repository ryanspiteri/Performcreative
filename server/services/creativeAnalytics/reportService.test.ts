/**
 * Tests for reportService.
 *
 * Covers:
 *   - isValidSortField (security-critical allowlist: prevents SQL injection
 *     via sortBy input)
 *   - Row mapping logic: SUM-then-compute aggregation rules, zero-division
 *     guards, bp/cents preservation
 *   - Summary KPI filter scope: verifies the revenue subquery now respects
 *     the outer creativeType/campaign/account filters (codex critical #2)
 *
 * Full end-to-end SQL coverage requires a real DB. The summary filter test
 * here mocks `dbConn.execute` and asserts on the SQL query object structure
 * so we catch regressions where someone accidentally reverts to the broken
 * `1 = 1` join.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../_core/env", () => ({
  ENV: {
    hyrosApiKey: "test",
    metaAccessToken: "test",
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

// Capture every SQL query passed to dbConn.execute so tests can inspect shape.
// The summary path now runs 3 independent subqueries (spend, revenue, active
// creatives) plus an optional 4th for the unattributed bucket, so tests that
// care about per-query results queue one response per call via `mockResponses`.
// Tests that only care about shape can use `mockRows` as a fallback applied
// to every execute call when the queue is empty.
const captured: { lastSql: any; allSql: any[] } = { lastSql: null, allSql: [] };
let mockRows: any[] = [];
let mockResponses: any[][] = [];

vi.mock("../../db", () => ({
  getDb: vi.fn(async () => ({
    execute: vi.fn(async (sqlObj: any) => {
      captured.lastSql = sqlObj;
      captured.allSql.push(sqlObj);
      const next = mockResponses.shift();
      return [next ?? mockRows, {}];
    }),
  })),
  // reportService reads cached benchmarks from adSyncState via getSyncState.
  // Returning null forces a PLATFORM_FALLBACK path, deterministic for tests.
  getSyncState: vi.fn(async () => null),
}));

import {
  isValidSortField,
  getCreativePerformance,
  getCreativePerformanceSummary,
  getCreativeRow,
} from "./reportService";

describe("isValidSortField (sort allowlist)", () => {
  it("accepts known sort fields", () => {
    expect(isValidSortField("spendCents")).toBe(true);
    expect(isValidSortField("roasBp")).toBe(true);
    expect(isValidSortField("hookScore")).toBe(true);
    expect(isValidSortField("watchScore")).toBe(true);
    expect(isValidSortField("clickScore")).toBe(true);
    expect(isValidSortField("convertScore")).toBe(true);
    expect(isValidSortField("launchDate")).toBe(true);
  });

  it("rejects unknown fields (SQL injection guard)", () => {
    expect(isValidSortField("DROP TABLE ads")).toBe(false);
    expect(isValidSortField("") ).toBe(false);
    expect(isValidSortField("id; --")).toBe(false);
    expect(isValidSortField("'; SELECT * FROM users;--")).toBe(false);
  });
});

describe("getCreativePerformance — row mapping", () => {
  beforeEach(() => {
    captured.lastSql = null;
  });

  it("computes rates from summed counts (SUM-then-compute, not avg of rates)", async () => {
    mockRows = [
      {
        creativeAssetId: 1,
        creativeName: "Test Creative",
        thumbnailUrl: "https://example.com/thumb.jpg",
        creativeType: "video",
        pipelineRunId: null,
        launchDate: "2026-01-01",
        adCount: "2",
        spendCents: "10000",
        impressions: "100000",
        clicks: "2500",
        reach: "50000",
        videoPlayCount: "30000",
        video50Count: "10000",
        sumCpmCents: "600",
        dailyStatRowCount: "2",
        revenueCents: "30000",
        conversions: "15",
        hookScore: 65,
        watchScore: 55,
        clickScore: 70,
        convertScore: 80,
      },
    ];

    const rows = await getCreativePerformance({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
      sortBy: "spendCents",
      sortDirection: "desc",
      limit: 50,
      offset: 0,
    });

    expect(rows.length).toBe(1);
    const r = rows[0];
    // CTR = clicks / impressions * 10000 = 2500/100000 * 10000 = 250
    expect(r.ctrBp).toBe(250);
    // Thumbstop = videoPlayCount / impressions * 10000 = 30000/100000 * 10000 = 3000
    expect(r.thumbstopBp).toBe(3000);
    // Hold rate = video50Count / impressions * 10000 = 10000/100000 * 10000 = 1000
    expect(r.holdRateBp).toBe(1000);
    // ROAS = revenue / spend * 100 = 30000/10000 * 100 = 300
    expect(r.roasBp).toBe(300);
    // CPA = spend / conversions = 10000/15 = 667 (rounded)
    expect(r.cpaCents).toBe(667);
    // AOV = revenue / conversions = 30000/15 = 2000
    expect(r.aovCents).toBe(2000);
  });

  it("guards against zero-impression division", async () => {
    mockRows = [
      {
        creativeAssetId: 1,
        creativeName: "Silent",
        thumbnailUrl: null,
        creativeType: "image",
        pipelineRunId: null,
        launchDate: null,
        adCount: "1",
        spendCents: "1000",
        impressions: "0",
        clicks: "0",
        reach: "0",
        videoPlayCount: "0",
        video50Count: "0",
        sumCpmCents: "0",
        dailyStatRowCount: "0",
        revenueCents: "0",
        conversions: "0",
        hookScore: 0,
        watchScore: 0,
        clickScore: 0,
        convertScore: 0,
      },
    ];
    const rows = await getCreativePerformance({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
      sortBy: "spendCents",
      sortDirection: "desc",
      limit: 10,
      offset: 0,
    });
    expect(rows[0].ctrBp).toBe(0);
    expect(rows[0].thumbstopBp).toBe(0);
    expect(rows[0].holdRateBp).toBe(0);
    expect(rows[0].cpaCents).toBe(0);
    expect(rows[0].aovCents).toBe(0);
    expect(rows[0].roasBp).toBe(0);
  });

  it("rejects an invalid sortBy field at the boundary", async () => {
    await expect(
      getCreativePerformance({
        dateFrom: new Date(),
        dateTo: new Date(),
        sortBy: "DROP TABLE ads" as any,
        sortDirection: "desc",
        limit: 10,
        offset: 0,
      }),
    ).rejects.toThrow("Invalid sortBy field");
  });
});

describe("getCreativePerformanceSummary — isolated-subquery KPIs", () => {
  beforeEach(() => {
    captured.lastSql = null;
    captured.allSql = [];
    mockResponses = [];
    mockRows = [];
  });

  it("REGRESSION: creativeType filter propagates into every subquery", async () => {
    // Three subqueries: spend, revenue, activeCreatives
    mockResponses = [
      [{ totalSpend: "5000" }],
      [{ totalRevenue: "10000", totalConversions: "5" }],
      [{ activeCreatives: "3" }],
    ];

    await getCreativePerformanceSummary({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
      creativeType: "video",
    });

    expect(captured.allSql.length).toBeGreaterThanOrEqual(3);
    // Every subquery must join through creativeAssets so the creativeType
    // filter scopes it. Prior bug let revenue leak across types.
    for (const sqlObj of captured.allSql) {
      const sqlStr = JSON.stringify(sqlObj);
      expect(sqlStr).toContain("creativeAssets");
      expect(sqlStr).toContain("creativeType");
    }
  });

  it("REGRESSION: active creatives counts only creatives with spend>0 in window", async () => {
    mockResponses = [
      [{ totalSpend: "0" }],
      [{ totalRevenue: "0", totalConversions: "0" }],
      [{ activeCreatives: "42" }],
    ];
    await getCreativePerformanceSummary({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
    });
    // The 3rd subquery is the activeCreatives one — must require spendCents > 0
    // and filter by date, otherwise it counts every creative with any ad ever.
    const activeSql = JSON.stringify(captured.allSql[2]);
    expect(activeSql).toContain("spendCents");
    expect(activeSql).toContain("date");
  });

  it("revenue subquery pins source='hyros' and the configured attribution model", async () => {
    mockResponses = [
      [{ totalSpend: "0" }],
      [{ totalRevenue: "0", totalConversions: "0" }],
      [{ activeCreatives: "0" }],
    ];
    await getCreativePerformanceSummary({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
    });
    const revenueSql = JSON.stringify(captured.allSql[1]);
    expect(revenueSql).toContain("hyros");
    expect(revenueSql).toContain("attributionModel");
  });

  it("returns zeros for an empty result set", async () => {
    mockResponses = [[], [], []];
    const summary = await getCreativePerformanceSummary({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
      // Pass a filter so the unattributed-bucket path is skipped — otherwise
      // this empty-result test also has to stub a 4th response for it.
      creativeType: "video",
    });
    expect(summary.totalSpendCents).toBe(0);
    expect(summary.totalRevenueCents).toBe(0);
    expect(summary.blendedRoasBp).toBe(0);
    expect(summary.totalConversions).toBe(0);
    expect(summary.activeCreativesCount).toBe(0);
  });

  it("computes blended ROAS = revenue / spend * 100", async () => {
    mockResponses = [
      [{ totalSpend: "10000" }],     // $100 spend
      [{ totalRevenue: "30000", totalConversions: "10" }], // $300 revenue
      [{ activeCreatives: "5" }],
    ];
    const summary = await getCreativePerformanceSummary({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
      creativeType: "video", // skip unattributed
    });
    expect(summary.totalSpendCents).toBe(10000);
    expect(summary.totalRevenueCents).toBe(30000);
    expect(summary.blendedRoasBp).toBe(300); // 3.00x
    expect(summary.activeCreativesCount).toBe(5);
  });

  it("adds unattributed bucket ONLY when no filters are active", async () => {
    // No filters → unattributed bucket is added as a 4th query
    mockResponses = [
      [{ totalSpend: "10000" }],
      [{ totalRevenue: "30000", totalConversions: "10" }],
      [{ activeCreatives: "5" }],
      [{ revenueCents: "5000", conversions: "3" }], // unattributed
    ];
    const summary = await getCreativePerformanceSummary({
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-01-31"),
    });
    // attributed $300 + unattributed $50 = $350 total
    expect(summary.totalRevenueCents).toBe(35000);
    expect(summary.totalConversions).toBe(13);
  });
});

describe("getCreativeRow", () => {
  beforeEach(() => {
    captured.lastSql = null;
  });

  it("returns null when the creative doesn't exist", async () => {
    mockRows = [];
    const row = await getCreativeRow(999, new Date("2026-01-01"), new Date("2026-01-31"));
    expect(row).toBeNull();
  });

  it("returns a fully-mapped row for an existing creative", async () => {
    mockRows = [
      {
        creativeAssetId: 42,
        creativeName: "One Row",
        thumbnailUrl: null,
        creativeType: "video",
        pipelineRunId: null,
        launchDate: "2026-01-01",
        adCount: "1",
        spendCents: "5000",
        impressions: "20000",
        clicks: "400",
        reach: "10000",
        videoPlayCount: "6000",
        video50Count: "2000",
        sumCpmCents: "250",
        dailyStatRowCount: "1",
        revenueCents: "15000",
        conversions: "5",
        hookScore: 70,
        watchScore: 60,
        clickScore: 55,
        convertScore: 75,
      },
    ];
    const row = await getCreativeRow(42, new Date("2026-01-01"), new Date("2026-01-31"));
    expect(row).not.toBeNull();
    expect(row!.creativeAssetId).toBe(42);
    expect(row!.revenueCents).toBe(15000);
    // ROAS = 15000 / 5000 * 100 = 300
    expect(row!.roasBp).toBe(300);
  });
});
