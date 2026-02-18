import axios from "axios";
import { ENV } from "../_core/env";

const FOREPLAY_BASE = "https://app.foreplay.co/api";

const foreplayClient = axios.create({
  baseURL: FOREPLAY_BASE,
  headers: {
    Authorization: `Bearer ${ENV.foreplayApiKey}`,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

export interface ForeplayAd {
  id: string;
  title?: string;
  brandName?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaType?: string;
  platform?: string;
  createdAt?: string;
  boardId?: string;
  boardName?: string;
}

// Fetch ads from a Foreplay board
export async function fetchBoardAds(boardName: string, limit = 20): Promise<ForeplayAd[]> {
  try {
    // First get boards to find the right one
    const boardsRes = await foreplayClient.get("/boards");
    const boards = boardsRes.data?.boards || boardsRes.data || [];
    
    let targetBoard = null;
    for (const board of (Array.isArray(boards) ? boards : [])) {
      if (board.name?.toLowerCase().includes(boardName.toLowerCase()) || 
          board.id === boardName) {
        targetBoard = board;
        break;
      }
    }

    if (!targetBoard) {
      console.log("[Foreplay] Available boards:", JSON.stringify(boards?.map?.((b: any) => ({ id: b.id, name: b.name })) || boards));
      // Try fetching from swipe-file endpoint as fallback
      return await fetchSwipeFileAds(boardName, limit);
    }

    // Fetch ads from the board
    const adsRes = await foreplayClient.get(`/boards/${targetBoard.id}/ads`, {
      params: { limit }
    });
    
    const ads = adsRes.data?.ads || adsRes.data || [];
    return normalizeAds(ads);
  } catch (error: any) {
    console.error("[Foreplay] Error fetching board ads:", error?.response?.data || error.message);
    // Fallback to swipe-file approach
    return await fetchSwipeFileAds(boardName, limit);
  }
}

async function fetchSwipeFileAds(boardName: string, limit: number): Promise<ForeplayAd[]> {
  try {
    // Try the swipe-file/saved endpoint
    const res = await foreplayClient.get("/swipe-file", {
      params: { 
        board: boardName,
        limit,
        sort: "newest"
      }
    });
    const data = res.data?.data || res.data?.ads || res.data || [];
    return normalizeAds(Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error("[Foreplay] Swipe file fallback error:", error?.response?.data || error.message);
    // Try discovery endpoint
    return await fetchDiscoveryAds(limit);
  }
}

async function fetchDiscoveryAds(limit: number): Promise<ForeplayAd[]> {
  try {
    const res = await foreplayClient.get("/discovery/ads", {
      params: { limit }
    });
    const data = res.data?.data || res.data?.ads || res.data || [];
    return normalizeAds(Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error("[Foreplay] Discovery fallback error:", error?.response?.data || error.message);
    return [];
  }
}

function normalizeAds(ads: any[]): ForeplayAd[] {
  return ads.map((ad: any) => ({
    id: ad.id || ad._id || ad.adId || String(Math.random()),
    title: ad.title || ad.name || ad.headline || ad.brandName || "Untitled Ad",
    brandName: ad.brandName || ad.brand || ad.advertiserName || ad.pageName || "",
    mediaUrl: ad.mediaUrl || ad.videoUrl || ad.media?.url || ad.creative?.videoUrl || ad.url || "",
    thumbnailUrl: ad.thumbnailUrl || ad.thumbnail || ad.media?.thumbnail || ad.creative?.thumbnailUrl || ad.imageUrl || "",
    mediaType: ad.mediaType || ad.type || (ad.videoUrl ? "video" : "image"),
    platform: ad.platform || ad.network || "facebook",
    createdAt: ad.createdAt || ad.created || ad.date || new Date().toISOString(),
    boardId: ad.boardId || "",
    boardName: ad.boardName || "",
  }));
}

// Fetch specifically video ads from inspo board
export async function fetchVideoAds(limit = 10): Promise<ForeplayAd[]> {
  const ads = await fetchBoardAds("inspo", limit);
  // Filter for video ads if possible
  const videoAds = ads.filter(a => 
    a.mediaType?.includes("video") || 
    a.mediaUrl?.includes(".mp4") || 
    a.mediaUrl?.includes("video")
  );
  return videoAds.length > 0 ? videoAds : ads;
}

// Fetch static ads from static_inspo board
export async function fetchStaticAds(limit = 20): Promise<ForeplayAd[]> {
  const ads = await fetchBoardAds("static_inspo", limit);
  // Filter for image/static ads
  const staticAds = ads.filter(a => 
    a.mediaType?.includes("image") || 
    a.thumbnailUrl ||
    !a.mediaUrl?.includes("video")
  );
  return staticAds.length > 0 ? staticAds : ads;
}

// List all available boards
export async function listBoards(): Promise<any[]> {
  try {
    const res = await foreplayClient.get("/boards");
    return res.data?.boards || res.data || [];
  } catch (error: any) {
    console.error("[Foreplay] Error listing boards:", error?.response?.data || error.message);
    return [];
  }
}
