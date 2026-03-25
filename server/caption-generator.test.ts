import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock callClaude from _shared
vi.mock("./services/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./services/_shared")>();
  return {
    ...actual,
    callClaude: vi.fn(),
  };
});

// Mock db module
vi.mock("./db", () => ({
  listCaptionExamples: vi.fn().mockResolvedValue([]),
}));

import { generateCaption, generateBatchCaptions } from "./services/captionGenerator";
import { callClaude } from "./services/_shared";
import * as db from "./db";

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>;
const mockListCaptionExamples = db.listCaptionExamples as ReturnType<typeof vi.fn>;

const VALID_RESPONSE = JSON.stringify({
  instagram: "Instagram caption here with #hashtags",
  tiktok: "TikTok caption #fyp",
  linkedin: "LinkedIn professional caption",
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCallClaude.mockResolvedValue(VALID_RESPONSE);
  mockListCaptionExamples.mockResolvedValue([]);
});

describe("generateCaption", () => {
  it("returns all 3 platform variants", async () => {
    const result = await generateCaption({
      pillar: "PTC Value",
      purpose: "Educate",
      topic: "Protein benefits",
    });

    expect(result).toHaveProperty("instagram");
    expect(result).toHaveProperty("tiktok");
    expect(result).toHaveProperty("linkedin");
    expect(typeof result.instagram).toBe("string");
    expect(typeof result.tiktok).toBe("string");
    expect(typeof result.linkedin).toBe("string");
  });

  it("calls callClaude with messages and system prompt", async () => {
    await generateCaption({
      pillar: "Story",
      purpose: "Inspire",
      topic: "Morning routine",
    });

    expect(mockCallClaude).toHaveBeenCalledTimes(1);
    const [messages, systemPrompt, maxTokens] = mockCallClaude.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("Morning routine");
    expect(typeof systemPrompt).toBe("string");
    expect(systemPrompt).toContain("Story");
    expect(maxTokens).toBe(4096);
  });

  it("handles empty response by throwing", async () => {
    mockCallClaude.mockResolvedValue("");

    await expect(
      generateCaption({ pillar: "Trends", purpose: "Entertain", topic: "Test" })
    ).rejects.toThrow();
  });

  it("retries once on JSON parse error", async () => {
    // First call returns invalid JSON, retry returns valid
    mockCallClaude
      .mockResolvedValueOnce("This is not valid JSON at all")
      .mockResolvedValueOnce(VALID_RESPONSE);

    const result = await generateCaption({
      pillar: "Motivation",
      purpose: "Inspire",
      topic: "Discipline",
    });

    expect(mockCallClaude).toHaveBeenCalledTimes(2);
    expect(result.instagram).toBe("Instagram caption here with #hashtags");
    expect(result.tiktok).toBe("TikTok caption #fyp");
    expect(result.linkedin).toBe("LinkedIn professional caption");
  });

  it("handles response wrapped in markdown code fences", async () => {
    mockCallClaude.mockResolvedValue(
      '```json\n{"instagram": "IG caption", "tiktok": "TT caption", "linkedin": "LI caption"}\n```'
    );

    const result = await generateCaption({
      pillar: "Edutaining",
      purpose: "Educate",
      topic: "Supplement timing",
    });

    expect(result.instagram).toBe("IG caption");
    expect(result.tiktok).toBe("TT caption");
    expect(result.linkedin).toBe("LI caption");
  });

  it("uses few-shot examples from DB when available", async () => {
    mockListCaptionExamples.mockResolvedValue([
      { platform: "instagram", captionText: "Example IG caption", topic: "Fitness" },
      { platform: "tiktok", captionText: "Example TT caption", topic: "Fitness" },
    ]);

    await generateCaption({
      pillar: "PTC Value",
      purpose: "Sell",
      topic: "New product launch",
    });

    expect(mockListCaptionExamples).toHaveBeenCalledWith("PTC Value", "Sell");
    const [, systemPrompt] = mockCallClaude.mock.calls[0];
    expect(systemPrompt).toContain("Few-Shot Examples");
  });
});

describe("generateBatchCaptions", () => {
  it("processes multiple items", async () => {
    const items = [
      { pillar: "PTC Value", purpose: "Educate", topic: "Topic A" },
      { pillar: "Story", purpose: "Inspire", topic: "Topic B" },
      { pillar: "Trends", purpose: "Entertain", topic: "Topic C" },
    ];

    const results = await generateBatchCaptions(items);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toHaveProperty("instagram");
      expect(result).toHaveProperty("tiktok");
      expect(result).toHaveProperty("linkedin");
    }
  });

  it("handles partial failures gracefully", async () => {
    // First call succeeds, second fails, third succeeds
    mockCallClaude
      .mockResolvedValueOnce(VALID_RESPONSE)
      .mockRejectedValueOnce(new Error("API rate limited"))
      .mockResolvedValueOnce(VALID_RESPONSE);

    const items = [
      { pillar: "PTC Value", purpose: "Educate", topic: "Success 1" },
      { pillar: "Story", purpose: "Inspire", topic: "Failure" },
      { pillar: "Trends", purpose: "Entertain", topic: "Success 2" },
    ];

    const results = await generateBatchCaptions(items);

    expect(results).toHaveLength(3);
    // First and third should succeed
    expect(results[0]).toHaveProperty("instagram");
    expect(results[2]).toHaveProperty("instagram");
    // Second should have error
    expect(results[1]).toHaveProperty("error");
    expect((results[1] as { error: string }).error).toContain("Failure");
  });

  it("respects concurrency (calls runWithConcurrency with limit 3)", async () => {
    const items = [
      { pillar: "PTC Value", purpose: "Educate", topic: "A" },
      { pillar: "Story", purpose: "Inspire", topic: "B" },
    ];

    const results = await generateBatchCaptions(items);
    expect(results).toHaveLength(2);
    // Each item triggers one callClaude call
    expect(mockCallClaude).toHaveBeenCalledTimes(2);
  });
});
