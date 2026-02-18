import axios from "axios";
import { ENV } from "../_core/env";

// Correct Foreplay Public API base URL
const FOREPLAY_BASE = "https://public.api.foreplay.co";

const foreplayClient = axios.create({
  baseURL: FOREPLAY_BASE,
  headers: {
    Authorization: `Bearer ${ENV.foreplayApiKey}`,
  },
  timeout: 30000,
});

// Known board IDs (discovered via GET /api/boards)
const BOARD_IDS = {
  inspo: "6nEqpgBrTtip6dD98R3X",         // #inspo — video ads
  static_inspo: "K2LrL6uQapf8EBT1ZbUN",  // #static_inspo — static/image ads
} as const;

export interface ForeplayAd {
  id: string;
  title?: string;
  brandName?: string;
  mediaUrl?: string;       // video URL for video ads
  thumbnailUrl?: string;   // thumbnail image
  imageUrl?: string;       // image URL for static ads
  mediaType?: string;      // "video" | "image" | etc.
  platform?: string;
  description?: string;
  headline?: string;
  createdAt?: string;
  displayFormat?: string;
  transcription?: string;
}

/**
 * Fetch ads from a Foreplay board by board_id.
 * Uses the correct endpoint: GET /api/board/ads?board_id=XXX
 */
export async function fetchBoardAds(boardId: string, limit = 20): Promise<ForeplayAd[]> {
  try {
    console.log(`[Foreplay] Fetching ads from board ${boardId}, limit=${limit}`);
    const res = await foreplayClient.get("/api/board/ads", {
      params: { board_id: boardId, limit },
    });

    const data = res.data?.data || [];
    console.log(`[Foreplay] Got ${data.length} ads from board ${boardId}`);
    return normalizeAds(data);
  } catch (error: any) {
    console.error("[Foreplay] Error fetching board ads:", error?.response?.status, error?.response?.data || error.message);
    return [];
  }
}

/**
 * Normalize raw Foreplay API ad objects to our ForeplayAd interface.
 * Field mapping based on actual API response:
 *   - name → brandName
 *   - video → mediaUrl (for video ads)
 *   - image → imageUrl (for static ads)
 *   - thumbnail → thumbnailUrl
 *   - display_format → mediaType
 *   - description, headline, full_transcription, timestamped_transcription
 */
function normalizeAds(ads: any[]): ForeplayAd[] {
  return ads.map((ad: any) => {
    // Build transcription from timestamped data if available
    let transcription = ad.full_transcription || "";
    if (!transcription && ad.timestamped_transcription && Array.isArray(ad.timestamped_transcription)) {
      transcription = ad.timestamped_transcription.map((t: any) => t.sentence || "").join(" ").trim();
    }

    return {
      id: ad.id || ad.ad_id || String(Math.random()),
      title: ad.headline || ad.name || ad.description?.slice(0, 80) || "Untitled Ad",
      brandName: ad.name || "",
      mediaUrl: ad.video || "",           // video URL
      thumbnailUrl: ad.thumbnail || "",   // thumbnail image
      imageUrl: ad.image || "",           // static image URL
      mediaType: (ad.display_format || "").toLowerCase(),
      platform: ad.publisher_platform || "facebook",
      description: ad.description || "",
      headline: ad.headline || "",
      createdAt: ad.started_running || new Date().toISOString(),
      displayFormat: ad.display_format || "",
      transcription,
    };
  });
}

/**
 * Fetch video ads from the #inspo board
 */
export async function fetchVideoAds(limit = 10): Promise<ForeplayAd[]> {
  const ads = await fetchBoardAds(BOARD_IDS.inspo, limit);
  // Filter for video ads only (display_format = "VIDEO")
  const videoAds = ads.filter(a =>
    a.mediaType === "video" ||
    a.displayFormat?.toUpperCase() === "VIDEO" ||
    (a.mediaUrl && a.mediaUrl.includes(".mp4"))
  );
  console.log(`[Foreplay] ${videoAds.length} video ads out of ${ads.length} total from #inspo`);
  return videoAds.length > 0 ? videoAds : ads;
}

/**
 * Fetch static/image ads from the #static_inspo board
 */
export async function fetchStaticAds(limit = 20): Promise<ForeplayAd[]> {
  const ads = await fetchBoardAds(BOARD_IDS.static_inspo, limit);
  // Filter for image/static ads
  const staticAds = ads.filter(a =>
    a.mediaType === "image" ||
    a.displayFormat?.toUpperCase() === "IMAGE" ||
    a.imageUrl
  );
  console.log(`[Foreplay] ${staticAds.length} static ads out of ${ads.length} total from #static_inspo`);
  return staticAds.length > 0 ? staticAds : ads;
}

/**
 * List all available boards for the authenticated user
 */
export async function listBoards(): Promise<any[]> {
  try {
    const res = await foreplayClient.get("/api/boards", {
      params: { offset: 0, limit: 10 },
    });
    return res.data?.data || [];
  } catch (error: any) {
    console.error("[Foreplay] Error listing boards:", error?.response?.data || error.message);
    return [];
  }
}
