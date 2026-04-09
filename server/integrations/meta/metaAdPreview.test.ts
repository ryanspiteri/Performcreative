/**
 * Tests for MetaAdsClient.getAdPreview — Ad Preview API + cache behaviour.
 *
 * Why this is a separate file: it needs to mock axios.create to inject a
 * fake HTTP layer, which is heavier than the pure-helper tests in
 * metaAdsClient.test.ts.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../_core/env", () => ({
  ENV: {
    metaAccessToken: "test-token",
    metaGraphApiVersion: "v22.0",
    metaAdAccountIds: "act_test",
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

import { MetaAdsClient } from "./metaAdsClient";

function fakePreviewBody(id: string): string {
  return `<iframe src="https://business.facebook.com/ads/api/preview_iframe.php?d=${id}" width="540" height="720" frameborder="0"></iframe>`;
}

describe("MetaAdsClient.getAdPreview", () => {
  beforeEach(() => {
    mockGet.mockReset();
    MetaAdsClient.__clearAdPreviewCache();
  });

  it("calls /ads/{id}/previews with the correct format + access_token", async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ body: fakePreviewBody("token-1") }] },
    });

    const client = new MetaAdsClient();
    const result = await client.getAdPreview("120249059856700538", "MOBILE_FEED_STANDARD");

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/120249059856700538/previews");
    expect(config.params.ad_format).toBe("MOBILE_FEED_STANDARD");
    expect(config.params.access_token).toBe("test-token");

    expect(result.iframeSrc).toBe("https://business.facebook.com/ads/api/preview_iframe.php?d=token-1");
    expect(result.body).toContain("iframe");
  });

  it("caches the response — two rapid calls hit the API once", async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ body: fakePreviewBody("token-cached") }] },
    });

    const client = new MetaAdsClient();
    const a = await client.getAdPreview("ad-1", "MOBILE_FEED_STANDARD");
    const b = await client.getAdPreview("ad-1", "MOBILE_FEED_STANDARD");

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(a.iframeSrc).toBe(b.iframeSrc);
  });

  it("does NOT share cache across different formats", async () => {
    mockGet
      .mockResolvedValueOnce({ data: { data: [{ body: fakePreviewBody("mobile") }] } })
      .mockResolvedValueOnce({ data: { data: [{ body: fakePreviewBody("story") }] } });

    const client = new MetaAdsClient();
    const mobile = await client.getAdPreview("ad-1", "MOBILE_FEED_STANDARD");
    const story = await client.getAdPreview("ad-1", "INSTAGRAM_STORY");

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mobile.iframeSrc).toContain("mobile");
    expect(story.iframeSrc).toContain("story");
  });

  it("defaults to MOBILE_FEED_STANDARD when no format passed", async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ body: fakePreviewBody("default") }] },
    });

    const client = new MetaAdsClient();
    await client.getAdPreview("ad-1");

    expect(mockGet.mock.calls[0][1].params.ad_format).toBe("MOBILE_FEED_STANDARD");
  });

  it("throws with a clear message if Meta returns no body", async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    const client = new MetaAdsClient();
    await expect(client.getAdPreview("ad-empty")).rejects.toThrow(/no preview body/);
  });

  it("propagates axios errors (so the tRPC layer can map them to TRPCError)", async () => {
    mockGet.mockRejectedValue({
      response: { status: 400, data: { error: { message: "Invalid ad id" } } },
      message: "Request failed with status code 400",
    });
    const client = new MetaAdsClient();
    await expect(client.getAdPreview("bad-id")).rejects.toBeDefined();
  });

  it("returns iframeSrc=null gracefully when body has no extractable src", async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ body: "<div>no iframe here</div>" }] },
    });
    const client = new MetaAdsClient();
    const result = await client.getAdPreview("ad-weird");
    expect(result.iframeSrc).toBeNull();
    expect(result.body).toContain("no iframe");
  });
});

describe("MetaAdsClient.getAdShareableLink", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("returns the preview_shareable_link from Meta's ad object", async () => {
    mockGet.mockResolvedValue({
      data: { id: "ad-1", preview_shareable_link: "https://fb.me/abc123" },
    });

    const client = new MetaAdsClient();
    const link = await client.getAdShareableLink("ad-1");

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/ad-1");
    expect(config.params.fields).toBe("preview_shareable_link");
    expect(link).toBe("https://fb.me/abc123");
  });

  it("returns null if Meta omits the field", async () => {
    mockGet.mockResolvedValue({ data: { id: "ad-1" } });
    const client = new MetaAdsClient();
    expect(await client.getAdShareableLink("ad-1")).toBeNull();
  });

  it("propagates axios errors so the tRPC layer can surface them", async () => {
    mockGet.mockRejectedValue({
      response: { status: 404, data: { error: { message: "Not found" } } },
      message: "Request failed",
    });
    const client = new MetaAdsClient();
    await expect(client.getAdShareableLink("ad-404")).rejects.toBeDefined();
  });
});
