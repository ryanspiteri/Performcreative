/**
 * Hyros reporting API client (read-only).
 *
 * Auth: API-Key header (NOT Authorization: Bearer)
 * Base: https://api.hyros.com/v1/api/v1.0
 * Rate limits: 1000 req/min, 30 req/sec
 *
 * Attribution model: Hyros tracks at the SALE level, not ad level.
 * Each sale has firstSource + lastSource with adSource (platform, adSourceId)
 * and sourceLinkAd (creative name + ad-level adSourceId). We aggregate sales
 * into per-ad daily stats during sync.
 *
 * See test/fixtures/phase-1-api-validation.md for the field shape.
 */
import axios, { type AxiosInstance } from "axios";
import { ENV } from "../../_core/env";

const TAG = "[HyrosClient]";

export interface HyrosAdSource {
  adSourceId: string;
  adAccountId: string;
  platform: string; // "FACEBOOK", "GOOGLE", etc.
}

export interface HyrosSourceLinkAd {
  name: string;
  adSourceId: string;
}

export interface HyrosSource {
  sourceLinkId?: string;
  name?: string;
  tag?: string;
  disregarded?: boolean;
  organic?: boolean;
  trafficSource?: { id: string; name: string };
  goal?: { id: string; name: string };
  category?: { id: string; name: string };
  adSource?: HyrosAdSource;
  sourceLinkAd?: HyrosSourceLinkAd;
  clickDate?: string;
}

export interface HyrosLead {
  email?: string;
  id: string;
  creationDate: string;
  firstName?: string;
  lastName?: string;
  ips?: string[];
  phoneNumbers?: string[];
  tags?: string[];
  firstSource?: HyrosSource;
  lastSource?: HyrosSource;
}

export interface HyrosSale {
  id: string;
  orderId: string;
  creationDate: string; // "Thu Apr 09 10:33:18 UTC 2026" or ISO
  qualified: boolean;
  score: number;
  recurring: boolean;
  quantity: number;
  price?: number;
  usdPrice?: number;
  product?: string;
  provider?: string;
  lead: HyrosLead;
  firstSource?: HyrosSource;
  lastSource?: HyrosSource;
}

export interface HyrosPage<T> {
  result: T[];
  nextPageId?: string;
  request_id?: string;
}

export class HyrosClient {
  private http: AxiosInstance;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    const apiKey = opts?.apiKey ?? ENV.hyrosApiKey;
    const baseUrl = opts?.baseUrl ?? ENV.hyrosBaseUrl;
    if (!apiKey) {
      throw new Error("Hyros API key not configured. Set HYROS_API_KEY in env.");
    }
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 60_000,
      headers: {
        "API-Key": apiKey,
        Accept: "application/json",
      },
    });
  }

  /** Validate the key by hitting /ads (which requires valid auth). */
  async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.http.get("/ads", { params: { limit: 1 } });
      return { valid: true };
    } catch (err: any) {
      const msg = err.response?.data?.message?.[0] ?? err.message;
      return { valid: false, error: msg };
    }
  }

  /** List sales with attribution in a date range. Paginated via nextPageId. */
  async listSales(params: {
    fromDate: Date;
    toDate: Date;
    pageId?: string;
    pageSize?: number;
  }): Promise<HyrosPage<HyrosSale>> {
    const query: Record<string, string | number> = {
      fromDate: toHyrosDate(params.fromDate),
      toDate: toHyrosDate(params.toDate),
    };
    if (params.pageId) query.pageId = params.pageId;
    if (params.pageSize) query.pageSize = params.pageSize;

    const res = await this.http.get("/sales", { params: query });
    return res.data;
  }

  /** List leads with attribution. Use for V1.5 attribution features. */
  async listLeads(params: { fromDate: Date; toDate: Date; pageId?: string }): Promise<HyrosPage<HyrosLead>> {
    const query: Record<string, string | number> = {
      fromDate: toHyrosDate(params.fromDate),
      toDate: toHyrosDate(params.toDate),
    };
    if (params.pageId) query.pageId = params.pageId;
    const res = await this.http.get("/leads", { params: query });
    return res.data;
  }

  /** List Hyros ads (reference data). Returns Hyros's ad catalog with Meta ad ID mapping. */
  async listAds(params?: { pageId?: string }): Promise<HyrosPage<any>> {
    const res = await this.http.get("/ads", { params: params?.pageId ? { pageId: params.pageId } : {} });
    return res.data;
  }
}

function toHyrosDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Parse Hyros's creationDate which comes in two formats:
 *   - "Thu Apr 09 10:33:18 UTC 2026" (from /sales)
 *   - "2026-04-09T20:31:52+10:00" (from /leads)
 * Returns a Date or null.
 */
export function parseHyrosDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Get the start of day in UTC for daily bucketing. */
export function bucketDateToUtcMidnight(d: Date): Date {
  const bucket = new Date(d);
  bucket.setUTCHours(0, 0, 0, 0);
  return bucket;
}
