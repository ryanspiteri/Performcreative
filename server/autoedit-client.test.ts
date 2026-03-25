import { describe, expect, it, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");

// Mock ENV to provide AUTOEDIT_API_URL
vi.mock("./_core/env", () => ({
  ENV: {
    autoEditApiUrl: "http://localhost:8000",
    anthropicApiKey: "test-key",
  },
}));

const mockAxios = vi.mocked(axios, true);

import { checkHealth, processVideo } from "./services/autoEditClient";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkHealth", () => {
  it("returns true on 200 response", async () => {
    mockAxios.get.mockResolvedValue({ status: 200, data: { status: "ok" } });

    const result = await checkHealth();

    expect(result).toBe(true);
    expect(mockAxios.get).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/health",
      { timeout: 5_000 }
    );
  });

  it("returns false on connection error (ECONNREFUSED)", async () => {
    const err = new Error("Connection refused");
    (err as any).code = "ECONNREFUSED";
    mockAxios.get.mockRejectedValue(err);

    const result = await checkHealth();

    expect(result).toBe(false);
  });

  it("returns false on timeout (ECONNABORTED)", async () => {
    const err = new Error("Timeout");
    (err as any).code = "ECONNABORTED";
    mockAxios.get.mockRejectedValue(err);

    const result = await checkHealth();

    expect(result).toBe(false);
  });

  it("returns false on non-200 status", async () => {
    mockAxios.get.mockResolvedValue({ status: 503, data: {} });

    const result = await checkHealth();

    expect(result).toBe(false);
  });
});

describe("processVideo", () => {
  it("sends correct body for URL input (s3_url field)", async () => {
    mockAxios.post.mockResolvedValue({
      data: {
        output_url: "https://s3.amazonaws.com/output.mp4",
        transcription: "hello world",
        segments: [{ word: "hello", start: 0, end: 0.5, confidence: 0.99 }],
        thumbnail_url: "https://s3.amazonaws.com/thumb.jpg",
      },
    });

    const result = await processVideo({
      inputPath: "https://s3.amazonaws.com/bucket/video.mp4",
      inputType: "url",
      style: "dynamic",
    });

    expect(mockAxios.post).toHaveBeenCalled();
    const [url, body] = mockAxios.post.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/process-video");
    expect(body).toHaveProperty("s3_url", "https://s3.amazonaws.com/bucket/video.mp4");
    expect(body).not.toHaveProperty("local_path");
    expect(body).toHaveProperty("style", "dynamic");

    expect(result.outputUrl).toBe("https://s3.amazonaws.com/output.mp4");
    expect(result.transcription).toBe("hello world");
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].word).toBe("hello");
    expect(result.thumbnailUrl).toBe("https://s3.amazonaws.com/thumb.jpg");
  });

  it("sends correct body for local input (local_path field)", async () => {
    mockAxios.post.mockResolvedValue({
      data: {
        output_url: "https://s3.amazonaws.com/output.mp4",
        transcription: "test",
        segments: [],
        thumbnail_url: "https://s3.amazonaws.com/thumb.jpg",
      },
    });

    await processVideo({
      inputPath: "/media/videos/clip.mp4",
      inputType: "local",
    });

    const [, body] = mockAxios.post.mock.calls[0];
    expect(body).toHaveProperty("local_path", "/media/videos/clip.mp4");
    expect(body).not.toHaveProperty("s3_url");
  });

  it("handles timeout error", async () => {
    const err = new Error("timeout of 600000ms exceeded");
    (err as any).code = "ECONNABORTED";
    mockAxios.post.mockRejectedValue(err);

    await expect(
      processVideo({ inputPath: "https://s3.amazonaws.com/video.mp4", inputType: "url" })
    ).rejects.toThrow();
  });

  it("handles error response from service", async () => {
    mockAxios.post.mockRejectedValue(new Error("Request failed with status code 500"));

    await expect(
      processVideo({ inputPath: "/media/videos/clip.mp4", inputType: "local" })
    ).rejects.toThrow("Request failed with status code 500");
  });

  it("includes targetDuration when provided", async () => {
    mockAxios.post.mockResolvedValue({
      data: {
        output_url: "https://s3.amazonaws.com/output.mp4",
        transcription: "test",
        segments: [],
        thumbnail_url: "https://s3.amazonaws.com/thumb.jpg",
      },
    });

    await processVideo({
      inputPath: "https://s3.amazonaws.com/video.mp4",
      inputType: "url",
      targetDuration: 30,
    });

    const [, body] = mockAxios.post.mock.calls[0];
    expect(body).toHaveProperty("target_duration", 30);
  });
});
