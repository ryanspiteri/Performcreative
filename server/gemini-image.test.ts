import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateProductAd } from "./services/geminiImage";

// Mock the storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://cdn.example.com/test-image.png",
    key: "gemini-ads/test-image.png",
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe("Gemini Image Generation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have GOOGLE_AI_API_KEY configured (or use dummy in tests)", () => {
    expect(process.env.GOOGLE_AI_API_KEY).toBeDefined();
  });

  it("should generate product ad with text-only prompt", async () => {
    // Mock successful Gemini API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: Buffer.from("fake-image-data").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    const results = await generateProductAd({
      prompt: "A vibrant fitness scene with dynamic lighting",
      aspectRatio: "1:1",
      resolution: "1K",
      variationCount: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("url");
    expect(results[0]).toHaveProperty("s3Key");
    expect(results[0].url).toBe("https://cdn.example.com/test-image.png");
  });

  it("should generate product ad with product render compositing", async () => {
    // Mock fetch for product image
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "image/png"]]),
        arrayBuffer: async () => Buffer.from("fake-product-image").buffer,
      })
      // Mock Gemini API response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: Buffer.from("fake-generated-image").toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      });

    const results = await generateProductAd({
      prompt: "Create a high-end product ad with this supplement bottle in a fitness environment",
      productRenderUrl: "https://example.com/product.png",
      aspectRatio: "1:1",
      resolution: "1K",
      variationCount: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("url");
    expect(results[0]).toHaveProperty("s3Key");
  });

  it("should generate multiple variations", async () => {
    // Mock Gemini API responses for 3 variations
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: Buffer.from("variation-1").toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: Buffer.from("variation-2").toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: Buffer.from("variation-3").toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      });

    const results = await generateProductAd({
      prompt: "A dynamic fitness scene",
      variationCount: 3,
    });

    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("s3Key");
    });
  });

  it("should handle API errors gracefully", async () => {
    // Mock failed Gemini API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: {
          code: 400,
          message: "Invalid request",
        },
      }),
    });

    await expect(
      generateProductAd({
        prompt: "Test prompt",
        variationCount: 1,
      })
    ).rejects.toThrow("Gemini API error");
  });
});
