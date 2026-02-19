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
export async function fetchBoardAds(boardId: string, limit = 100): Promise<ForeplayAd[]> {
  const allAds: any[] = [];
  let offset = 0;
  const pageSize = Math.min(limit, 100); // Fetch in pages of up to 100
  const maxPages = 10; // Safety limit: max 1000 ads

  try {
    console.log(`[Foreplay] Fetching ads from board ${boardId}, limit=${limit} (paginated)`);

    for (let page = 0; page < maxPages; page++) {
      const res = await foreplayClient.get("/api/board/ads", {
        params: { board_id: boardId, limit: pageSize, offset },
      });

      const data = res.data?.data || [];
      console.log(`[Foreplay] Page ${page + 1}: got ${data.length} ads (offset=${offset})`);
      allAds.push(...data);

      // Stop if we got fewer than requested (no more pages) or hit our limit
      if (data.length < pageSize || allAds.length >= limit) break;
      offset += data.length;
    }

    console.log(`[Foreplay] Total: ${allAds.length} ads from board ${boardId}`);
    return normalizeAds(allAds.slice(0, limit));
  } catch (error: any) {
    console.error("[Foreplay] Error fetching board ads:", error?.response?.status, error?.response?.data || error.message);
    // Return whatever we got before the error
    if (allAds.length > 0) {
      console.log(`[Foreplay] Returning ${allAds.length} ads fetched before error`);
      return normalizeAds(allAds);
    }
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
 * Returns all ads from the board (no filtering, since board is already curated)
 */
export async function fetchVideoAds(limit = 10): Promise<ForeplayAd[]> {
  const ads = await fetchBoardAds(BOARD_IDS.inspo, limit);
  console.log(`[Foreplay] Fetched ${ads.length} ads from #inspo (video board)`);
  return ads;
}

/**
 * Fetch static/image ads from the #static_inspo board
 * Returns all ads from the board (no filtering, since board is already curated)
 */
export async function fetchStaticAds(limit = 20): Promise<ForeplayAd[]> {
  const ads = await fetchBoardAds(BOARD_IDS.static_inspo, limit);
  console.log(`[Foreplay] Fetched ${ads.length} ads from #static_inspo (static board)`);
  return ads;
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
