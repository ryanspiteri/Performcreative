/**
 * Unit tests for metaAdsClient pure helpers.
 *
 * parseActionCount / parseMetaMoneyToCents / parseMetaRateToBp are the
 * transformations that turn Meta's string-heavy API responses into the
 * integer-cents / basis-points values we store. A silent bug in any of
 * these corrupts every adDailyStats row, so the tests aim to pin down
 * edge cases (null, empty array, wrong action_type, weird numbers).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../_core/env", () => ({
  ENV: {
    metaAccessToken: "test",
    metaGraphApiVersion: "v22.0",
    metaAdAccountIds: "act_test",
    // keep sibling ENV keys happy
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

import { parseActionCount, parseMetaMoneyToCents, parseMetaRateToBp } from "./metaAdsClient";

describe("parseActionCount", () => {
  it("extracts the matching action_type value from an array", () => {
    const actions = [
      { action_type: "video_view", value: "42" },
      { action_type: "post_engagement", value: "100" },
    ];
    expect(parseActionCount(actions, "video_view")).toBe(42);
  });

  it("defaults to action_type='video_view' when not specified", () => {
    const actions = [{ action_type: "video_view", value: "7" }];
    expect(parseActionCount(actions)).toBe(7);
  });

  it("returns 0 when the requested action_type is absent", () => {
    const actions = [{ action_type: "post_engagement", value: "100" }];
    expect(parseActionCount(actions, "video_view")).toBe(0);
  });

  it("returns 0 for undefined / null / empty array", () => {
    expect(parseActionCount(undefined)).toBe(0);
    expect(parseActionCount(null as any)).toBe(0);
    expect(parseActionCount([])).toBe(0);
  });

  it("parses string integers (Meta always returns action values as strings)", () => {
    const actions = [{ action_type: "video_view", value: "1234567" }];
    expect(parseActionCount(actions)).toBe(1234567);
  });

  it("returns 0 when the value is non-numeric garbage", () => {
    const actions = [{ action_type: "video_view", value: "not-a-number" }];
    expect(parseActionCount(actions)).toBe(0);
  });
});

describe("parseMetaMoneyToCents", () => {
  it("converts a dollar string to integer cents", () => {
    expect(parseMetaMoneyToCents("12.34")).toBe(1234);
  });

  it("handles sub-cent values by rounding", () => {
    expect(parseMetaMoneyToCents("0.03")).toBe(3);
    expect(parseMetaMoneyToCents("0.004")).toBe(0);
    expect(parseMetaMoneyToCents("0.005")).toBe(1); // Math.round half-up
  });

  it("returns 0 for undefined / empty / NaN", () => {
    expect(parseMetaMoneyToCents(undefined)).toBe(0);
    expect(parseMetaMoneyToCents("")).toBe(0);
    expect(parseMetaMoneyToCents("not-a-number")).toBe(0);
  });

  it("handles whole-dollar values", () => {
    expect(parseMetaMoneyToCents("100")).toBe(10000);
  });
});

describe("parseMetaRateToBp", () => {
  it("converts a percent string to basis points x100", () => {
    expect(parseMetaRateToBp("2.50")).toBe(25000); // 2.50% * 10000 = 25000
  });

  it("handles integer percents", () => {
    expect(parseMetaRateToBp("1")).toBe(10000);
    expect(parseMetaRateToBp("0")).toBe(0);
  });

  it("returns 0 for undefined / empty / NaN", () => {
    expect(parseMetaRateToBp(undefined)).toBe(0);
    expect(parseMetaRateToBp("")).toBe(0);
    expect(parseMetaRateToBp("garbage")).toBe(0);
  });

  it("rounds half-up", () => {
    expect(parseMetaRateToBp("0.00005")).toBe(1); // 0.00005 * 10000 = 0.5 → round → 1
  });
});
