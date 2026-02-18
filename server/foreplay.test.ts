import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock axios before importing the module
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      get: vi.fn(),
      post: vi.fn(),
    },
    __mockInstance: mockAxiosInstance,
  };
});

// Mock ENV
vi.mock("../server/_core/env", () => ({
  ENV: {
    foreplayApiKey: "test-api-key",
    anthropicApiKey: "test-key",
    openaiApiKey: "test-key",
    clickupApiKey: "test-key",
    cookieSecret: "test-secret",
    appId: "test-app",
    oAuthServerUrl: "",
    ownerOpenId: "",
    isProduction: false,
    forgeApiUrl: "",
    forgeApiKey: "",
    databaseUrl: "",
  },
}));

describe("Foreplay Service", () => {
  let mockAxiosInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const axios = await import("axios");
    mockAxiosInstance = (axios as any).__mockInstance;
  });

  it("should use the correct Foreplay API base URL", async () => {
    // Verify the foreplay service module exports the expected functions
    const foreplay = await import("./services/foreplay");
    expect(typeof foreplay.fetchVideoAds).toBe("function");
    expect(typeof foreplay.fetchStaticAds).toBe("function");
    expect(typeof foreplay.fetchBoardAds).toBe("function");
    expect(typeof foreplay.listBoards).toBe("function");
  });

  it("should fetch video ads from the correct board ID", async () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        metadata: { success: true, count: 2 },
        data: [
          {
            id: "ad1",
            name: "TestBrand",
            display_format: "VIDEO",
            video: "https://r2.foreplay.co/test.mp4",
            thumbnail: "https://r2.foreplay.co/thumb.jpg",
            headline: "Test Ad",
            description: "Test description",
          },
          {
            id: "ad2",
            name: "TestBrand2",
            display_format: "VIDEO",
            video: "https://r2.foreplay.co/test2.mp4",
            thumbnail: "https://r2.foreplay.co/thumb2.jpg",
          },
        ],
      },
    });

    const { fetchVideoAds } = await import("./services/foreplay");
    const ads = await fetchVideoAds(5);

    // Should call the correct endpoint with the inspo board ID
    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/board/ads", {
      params: { board_id: "6nEqpgBrTtip6dD98R3X", limit: 5 },
    });

    expect(ads.length).toBe(2);
    expect(ads[0].mediaUrl).toBe("https://r2.foreplay.co/test.mp4");
    expect(ads[0].thumbnailUrl).toBe("https://r2.foreplay.co/thumb.jpg");
    expect(ads[0].mediaType).toBe("video");
  });

  it("should fetch static ads from the correct board ID", async () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        metadata: { success: true, count: 1 },
        data: [
          {
            id: "static1",
            name: "StaticBrand",
            display_format: "IMAGE",
            image: "https://r2.foreplay.co/static.jpg",
            thumbnail: null,
            headline: "Static Ad",
          },
        ],
      },
    });

    const { fetchStaticAds } = await import("./services/foreplay");
    const ads = await fetchStaticAds(20);

    // Should call the correct endpoint with the static_inspo board ID
    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/board/ads", {
      params: { board_id: "K2LrL6uQapf8EBT1ZbUN", limit: 20 },
    });

    expect(ads.length).toBe(1);
    expect(ads[0].imageUrl).toBe("https://r2.foreplay.co/static.jpg");
    expect(ads[0].mediaType).toBe("image");
  });

  it("should normalize ad data correctly with all fields", async () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "norm1",
            name: "BrandName",
            display_format: "VIDEO",
            video: "https://example.com/video.mp4",
            thumbnail: "https://example.com/thumb.jpg",
            image: null,
            headline: "Great Ad",
            description: "A great ad description",
            publisher_platform: "instagram",
            full_transcription: "This is the full transcript",
            started_running: "2024-01-01",
          },
        ],
      },
    });

    const { fetchBoardAds } = await import("./services/foreplay");
    const ads = await fetchBoardAds("test-board-id", 1);

    expect(ads[0]).toMatchObject({
      id: "norm1",
      brandName: "BrandName",
      mediaUrl: "https://example.com/video.mp4",
      thumbnailUrl: "https://example.com/thumb.jpg",
      headline: "Great Ad",
      description: "A great ad description",
      platform: "instagram",
      transcription: "This is the full transcript",
    });
  });

  it("should list boards from the correct endpoint", async () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: "board1", name: "#inspo" },
          { id: "board2", name: "#static_inspo" },
        ],
      },
    });

    const { listBoards } = await import("./services/foreplay");
    const boards = await listBoards();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/boards", {
      params: { offset: 0, limit: 10 },
    });

    expect(boards.length).toBe(2);
  });

  it("should handle API errors gracefully", async () => {
    mockAxiosInstance.get.mockRejectedValueOnce(new Error("API Error"));

    const { fetchBoardAds } = await import("./services/foreplay");
    const ads = await fetchBoardAds("bad-board", 5);

    expect(ads).toEqual([]);
  });
});
