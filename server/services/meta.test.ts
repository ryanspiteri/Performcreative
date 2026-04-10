/**
 * Unit tests for the Meta Facebook Login service.
 *
 * The service is a thin wrapper around `fetch` to Facebook's Graph API —
 * these tests mock `fetch` globally, feed canned responses, and assert the
 * correct URL/headers/body are constructed and the parsing handles both
 * happy and error paths.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mutable ENV mock — tests can flip metaOAuthConfigId between classic and
// Facebook Login for Business modes to exercise both auth URL branches.
// Must use vi.hoisted because vi.mock is hoisted above top-level declarations.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    metaAppId: "test_app_id",
    metaAppSecret: "test_app_secret",
    metaOAuthRedirectUri: "https://www.performcreative.io/api/meta/callback",
    metaOAuthConfigId: "",
    metaGraphApiVersion: "v22.0",
    // keep sibling ENV keys happy for any other module that might import this
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
vi.mock("../_core/env", () => ({ ENV: mockEnv }));

import {
  generatePKCE,
  getMetaAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshAccessToken,
  computeExpiresAt,
  fetchMetaUserProfile,
} from "./meta";

const originalFetch = global.fetch;

function mockFetchJson(status: number, body: any) {
  const mock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  }));
  global.fetch = mock as any;
  return mock;
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("generatePKCE", () => {
  it("returns a verifier + SHA256 challenge pair", () => {
    const { verifier, challenge } = generatePKCE();
    expect(verifier).toBeTruthy();
    expect(challenge).toBeTruthy();
    // base64url has no padding
    expect(verifier).not.toContain("=");
    expect(challenge).not.toContain("=");
    // verifier is 32 bytes → 43 char base64url
    expect(verifier.length).toBe(43);
  });

  it("produces different verifiers on each call", () => {
    const a = generatePKCE();
    const b = generatePKCE();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe("getMetaAuthUrl", () => {
  afterEach(() => {
    mockEnv.metaOAuthConfigId = "";
  });

  it("classic Facebook Login: uses scope string when metaOAuthConfigId is empty", () => {
    mockEnv.metaOAuthConfigId = "";
    const url = getMetaAuthUrl("https://example.com/cb", "state-123", "challenge-abc");
    expect(url).toContain("facebook.com/v22.0/dialog/oauth");
    expect(url).toContain("client_id=test_app_id");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcb");
    expect(url).toContain("state=state-123");
    expect(url).toContain("code_challenge=challenge-abc");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("scope=ads_read%2Cads_management%2Cbusiness_management");
    expect(url).toContain("response_type=code");
    expect(url).not.toContain("config_id=");
  });

  it("Facebook Login for Business: uses config_id and omits scope when metaOAuthConfigId is set", () => {
    mockEnv.metaOAuthConfigId = "2027948111462170";
    const url = getMetaAuthUrl("https://example.com/cb", "state-456", "challenge-def");
    expect(url).toContain("facebook.com/v22.0/dialog/oauth");
    expect(url).toContain("client_id=test_app_id");
    expect(url).toContain("config_id=2027948111462170");
    expect(url).toContain("state=state-456");
    expect(url).toContain("code_challenge=challenge-def");
    // scope MUST be absent when config_id is present — Meta rejects requests
    // that pass both.
    expect(url).not.toContain("scope=");
  });
});

describe("exchangeCodeForToken", () => {
  beforeEach(() => {
    // nothing
  });

  it("posts code + verifier to the token endpoint and returns the parsed body", async () => {
    const mock = mockFetchJson(200, {
      access_token: "short-lived-abc",
      token_type: "bearer",
      expires_in: 3600,
    });

    const result = await exchangeCodeForToken("auth_code", "https://example.com/cb", "verifier-xyz");

    expect(mock).toHaveBeenCalledTimes(1);
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain("graph.facebook.com/v22.0/oauth/access_token");
    expect(url).toContain("client_id=test_app_id");
    expect(url).toContain("client_secret=test_app_secret");
    expect(url).toContain("code=auth_code");
    expect(url).toContain("code_verifier=verifier-xyz");

    expect(result.access_token).toBe("short-lived-abc");
    expect(result.expires_in).toBe(3600);
  });

  it("throws on non-200 with a message including the status and body", async () => {
    mockFetchJson(400, { error: { message: "Invalid code" } });
    await expect(exchangeCodeForToken("bad_code", "https://example.com/cb", "v")).rejects.toThrow(/Meta token exchange failed: 400/);
  });
});

describe("exchangeForLongLivedToken + refreshAccessToken", () => {
  it("uses grant_type=fb_exchange_token and returns the long-lived token", async () => {
    const mock = mockFetchJson(200, {
      access_token: "long-lived-xyz",
      token_type: "bearer",
      expires_in: 5184000, // 60 days in seconds
    });

    const result = await exchangeForLongLivedToken("short-lived-abc");

    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain("grant_type=fb_exchange_token");
    expect(url).toContain("fb_exchange_token=short-lived-abc");
    expect(url).toContain("client_id=test_app_id");
    expect(result.access_token).toBe("long-lived-xyz");
  });

  it("refreshAccessToken is an alias for exchangeForLongLivedToken", async () => {
    const mock = mockFetchJson(200, {
      access_token: "refreshed-abc",
      token_type: "bearer",
      expires_in: 5184000,
    });

    const result = await refreshAccessToken("stale-token");

    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain("grant_type=fb_exchange_token");
    expect(url).toContain("fb_exchange_token=stale-token");
    expect(result.access_token).toBe("refreshed-abc");
  });

  it("throws on refresh failure (expired current token)", async () => {
    mockFetchJson(400, { error: { message: "Token expired" } });
    await expect(refreshAccessToken("expired")).rejects.toThrow(/Meta long-lived token exchange failed: 400/);
  });
});

describe("computeExpiresAt", () => {
  it("uses expires_in when present", () => {
    const before = Date.now();
    const result = computeExpiresAt({ access_token: "t", token_type: "bearer", expires_in: 3600 });
    const after = Date.now();
    // Should be ~1 hour from now
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000 - 100);
    expect(result.getTime()).toBeLessThanOrEqual(after + 3600 * 1000 + 100);
  });

  it("defaults to 60 days when expires_in is missing", () => {
    const before = Date.now();
    const result = computeExpiresAt({ access_token: "t", token_type: "bearer" });
    const after = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + sixtyDaysMs - 100);
    expect(result.getTime()).toBeLessThanOrEqual(after + sixtyDaysMs + 100);
  });

  it("treats 0 as missing and defaults to 60 days", () => {
    const before = Date.now();
    const result = computeExpiresAt({ access_token: "t", token_type: "bearer", expires_in: 0 });
    expect(result.getTime()).toBeGreaterThan(before + 50 * 24 * 60 * 60 * 1000);
  });
});

describe("fetchMetaUserProfile", () => {
  it("returns id + name when the API responds", async () => {
    const mock = mockFetchJson(200, { id: "fb_user_123", name: "Test User", email: "test@example.com" });
    const profile = await fetchMetaUserProfile("token-abc");

    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain("graph.facebook.com/v22.0/me");
    expect(url).toContain("fields=id%2Cname%2Cemail");
    expect(url).toContain("access_token=token-abc");

    expect(profile.id).toBe("fb_user_123");
    expect(profile.name).toBe("Test User");
  });

  it("throws on non-200", async () => {
    mockFetchJson(401, { error: { message: "Invalid token" } });
    await expect(fetchMetaUserProfile("bad-token")).rejects.toThrow(/Meta profile fetch failed: 401/);
  });
});
