import crypto from "crypto";
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
async function fetchWithRetry(url: string, params: Record<string, any>, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await foreplayClient.get(url, { params });
    } catch (err: any) {
      const status = err?.response?.status;
      // Don't retry 4xx client errors (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) throw err;
      if (attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      console.warn(`[Foreplay] Request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

export async function fetchBoardAds(boardId: string, limit = 100): Promise<ForeplayAd[]> {
  const allAds: any[] = [];
  let offset = 0;
  const pageSize = Math.min(limit, 100); // Fetch in pages of up to 100
  const maxPages = 10; // Safety limit: max 1000 ads

  try {
    console.log(`[Foreplay] Fetching ads from board ${boardId}, limit=${limit} (paginated)`);

    for (let page = 0; page < maxPages; page++) {
      const res = await fetchWithRetry("/api/board/ads", { board_id: boardId, limit: pageSize, offset });

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
  return ads.map((ad: any, idx: number) => {
    // Build transcription from timestamped data if available
    let transcription = ad.full_transcription || "";
    if (!transcription && ad.timestamped_transcription && Array.isArray(ad.timestamped_transcription)) {
      transcription = ad.timestamped_transcription.map((t: any) => t.sentence || "").join(" ").trim();
    }

    const extractedImage = (ad.cards?.[0]?.image) || ad.image || "";
    
    return {
      id: ad.id || ad.ad_id || `unknown-${crypto.createHash("sha256").update(`${ad.headline || ""}|${ad.name || ""}|${(ad.description || "").slice(0, 50)}`).digest("hex").slice(0, 16)}`,
      title: ad.headline || ad.name || ad.description?.slice(0, 80) || "Untitled Ad",
      brandName: ad.name || "",
      mediaUrl: ad.video || "",           // video URL
      thumbnailUrl: ad.thumbnail || extractedImage || "",   // thumbnail from creatives array
      imageUrl: extractedImage,           // static image from creatives array
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
