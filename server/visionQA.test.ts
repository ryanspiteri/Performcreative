/**
 * Tests for the Vision QA validate-and-retry pipeline.
 *
 * Covers:
 *   - validateProductFidelity PASS path
 *   - validateProductFidelity FAIL path
 *   - validateProductFidelity Vision API error → defensive PASS
 *   - validateProductFidelity timeout → defensive PASS
 *   - validateProductFidelity ENV.disableVisionQA toggle
 *   - validateProductFidelity missing canonical URL → defensive PASS
 *
 * Mocks the Claude client (claudeClient.post) and axios (image fetch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock axios.get for image-fetching
vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
      create: actual.default.create,
    },
  };
});

// Mock the shared claudeClient — visionQA.ts uses claudeClient.post()
vi.mock("../server/services/_shared", async () => {
  const actual = await vi.importActual<typeof import("./services/_shared")>("./services/_shared");
  return {
    ...actual,
    claudeClient: {
      post: vi.fn(),
    },
  };
});

// Mock ENV — visionQA.ts checks ENV.disableVisionQA
vi.mock("../server/_core/env", () => ({
  ENV: {
    disableVisionQA: false,
    anthropicApiKey: "test-key",
  },
}));

import axios from "axios";
import { claudeClient } from "./services/_shared";
import { ENV } from "./_core/env";
import { validateProductFidelity } from "./services/visionQA";

const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

function mockImageFetch() {
  // Both image fetches return a tiny 1x1 PNG buffer.
  (axios.get as any).mockResolvedValue({
    data: Buffer.from(MOCK_PNG_BASE64, "base64").buffer,
    headers: { "content-type": "image/png" },
  });
}

function mockClaudeResponse(json: object) {
  (claudeClient.post as any).mockResolvedValueOnce({
    data: {
      content: [{ type: "text", text: JSON.stringify(json) }],
    },
  });
}

describe("validateProductFidelity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ENV as any).disableVisionQA = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns PASS when Claude Vision returns overall=PASS", async () => {
    mockImageFetch();
    mockClaudeResponse({
      criteria: {
        body: "PASS",
        swoosh: "PASS",
        wordmark: "PASS",
        subtext: "PASS",
        flavour_strip: "PASS",
      },
      overall: "PASS",
      reason: "all good",
    });

    const result = await validateProductFidelity(
      "https://example.com/generated.png",
      "https://example.com/canonical.png",
    );

    expect(result.pass).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns FAIL when Claude Vision returns overall=FAIL", async () => {
    mockImageFetch();
    mockClaudeResponse({
      criteria: {
        body: "FAIL",
        swoosh: "PASS",
        wordmark: "PASS",
        subtext: "PASS",
        flavour_strip: "PASS",
      },
      overall: "FAIL",
      reason: "tub body is white instead of matte black",
    });

    const result = await validateProductFidelity(
      "https://example.com/generated.png",
      "https://example.com/canonical.png",
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toContain("white");
  });

  it("defaults to PASS when Claude API errors", async () => {
    mockImageFetch();
    (claudeClient.post as any).mockRejectedValueOnce(new Error("network down"));

    const result = await validateProductFidelity(
      "https://example.com/generated.png",
      "https://example.com/canonical.png",
    );

    expect(result.pass).toBe(true);
    expect(result.reason).toContain("vqa error");
  });

  it("defaults to PASS when image fetch fails", async () => {
    (axios.get as any).mockRejectedValueOnce(new Error("404 not found"));

    const result = await validateProductFidelity(
      "https://example.com/missing.png",
      "https://example.com/canonical.png",
    );

    // Image fetch failure is caught by the outer try/catch in validateProductFidelity.
    expect(result.pass).toBe(true);
    expect(result.reason).toContain("vqa error");
  });

  it("defaults to PASS when Claude response is unparseable", async () => {
    mockImageFetch();
    (claudeClient.post as any).mockResolvedValueOnce({
      data: { content: [{ type: "text", text: "this is not JSON at all" }] },
    });

    const result = await validateProductFidelity(
      "https://example.com/generated.png",
      "https://example.com/canonical.png",
    );

    expect(result.pass).toBe(true);
    expect(result.reason).toContain("parse failed");
  });

  it("defaults to PASS when Claude returns unrecognised overall value", async () => {
    mockImageFetch();
    mockClaudeResponse({
      criteria: {
        body: "PASS",
        swoosh: "PASS",
        wordmark: "PASS",
        subtext: "PASS",
        flavour_strip: "PASS",
      },
      overall: "MAYBE",
      reason: "unsure",
    });

    const result = await validateProductFidelity(
      "https://example.com/generated.png",
      "https://example.com/canonical.png",
    );

    expect(result.pass).toBe(true);
    expect(result.reason).toContain("unknown vqa response");
  });

  it("skips QA when ENV.disableVisionQA is true", async () => {
    (ENV as any).disableVisionQA = true;

    const result = await validateProductFidelity(
      "https://example.com/generated.png",
      "https://example.com/canonical.png",
    );

    expect(result.pass).toBe(true);
    expect(result.reason).toContain("disabled");
    // Should never even call the API
    expect(axios.get).not.toHaveBeenCalled();
    expect(claudeClient.post).not.toHaveBeenCalled();
  });

  it("skips QA when generatedUrl is missing", async () => {
    const result = await validateProductFidelity(undefined, "https://example.com/canonical.png");
    expect(result.pass).toBe(true);
    expect(result.reason).toContain("missing reference");
  });

  it("skips QA when canonicalUrl is missing", async () => {
    const result = await validateProductFidelity("https://example.com/generated.png", undefined);
    expect(result.pass).toBe(true);
    expect(result.reason).toContain("missing reference");
  });

  it("strips markdown code fences from Claude response", async () => {
    mockImageFetch();
    (claudeClient.post as any).mockResolvedValueOnce({
      data: {
        content: [
          {
            type: "text",
            text: '```json\n{"criteria":{"body":"PASS","swoosh":"PASS","wordmark":"PASS","subtext":"PASS","flavour_strip":"PASS"},"overall":"PASS","reason":"ok"}\n```',
          },
        ],
      },
    });

    const result = await validateProductFidelity(
      "https://example.com/generated.png",
      "https://example.com/canonical.png",
    );

    expect(result.pass).toBe(true);
  });
});
