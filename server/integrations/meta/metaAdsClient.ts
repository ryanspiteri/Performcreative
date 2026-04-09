/**
 * Meta Marketing API client (read-only).
 *
 * Auth: System User access token via query param `access_token=...`
 * Base: https://graph.facebook.com/v22.0
 * Docs: https://developers.facebook.com/docs/marketing-api/
 *
 * Field shapes verified in Phase 1 validation (test/fixtures/phase-1-api-validation.md).
 * Video metrics come as ARRAYS of action objects, not scalars — see parseActionCount.
 */
import axios, { type AxiosInstance } from "axios";
import { ENV } from "../../_core/env";

const TAG = "[MetaAdsClient]";

/**
 * Ad Preview API format.
 *
 * MOBILE_FEED_STANDARD renders the ad as it appears in the Facebook mobile
 * feed — the closest match to the default creative review experience.
 * Other common values: DESKTOP_FEED_STANDARD, INSTAGRAM_STANDARD,
 * INSTAGRAM_STORY, INSTAGRAM_REELS. V1 only uses MOBILE_FEED_STANDARD
 * because it handles video / image / carousel uniformly.
 * Docs: https://developers.facebook.com/docs/marketing-api/reference/ad-group/previews/
 */
export type MetaAdPreviewFormat =
  | "MOBILE_FEED_STANDARD"
  | "DESKTOP_FEED_STANDARD"
  | "INSTAGRAM_STANDARD"
  | "INSTAGRAM_STORY"
  | "INSTAGRAM_REELS";

export interface MetaAdPreview {
  body: string;
  iframeSrc: string | null;
}

/**
 * In-memory cache for ad previews. Meta's preview URLs are signed and
 * expire within hours, so a short TTL is fine. Keyed on (adId, format).
 *
 * Module-level on purpose: survives across MetaAdsClient instances but
 * resets on process restart — good enough for a single-instance DO App
 * Platform deployment. Multi-instance would want Redis, but the cache is
 * best-effort anyway (a miss just re-fetches).
 */
const AD_PREVIEW_CACHE_TTL_MS = 15 * 60 * 1000;
const adPreviewCache = new Map<string, { value: MetaAdPreview; expiresAt: number }>();

/** Extract the `src="..."` URL out of a Meta-returned iframe body. */
export function extractIframeSrc(body: string): string | null {
  if (!body) return null;
  const match = body.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  created_time?: string;
  updated_time?: string;
  creative?: MetaCreative;
}

export interface MetaCreative {
  id: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  effective_object_story_id?: string;
  body?: string;
  title?: string;
}

/** One action entry in an action-type array. Value is a stringified number. */
export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  ad_id: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  outbound_clicks_ctr?: MetaAction[];
  actions?: MetaAction[];
  video_play_actions?: MetaAction[];
  video_thruplay_watched_actions?: MetaAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
  video_avg_time_watched_actions?: MetaAction[];
  date_start: string;
  date_stop: string;
}

export interface MetaInsightsPage {
  data: MetaInsightRow[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}

export interface MetaAdsPage {
  data: MetaAd[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  amount_spent: string;
}

/** Extract the numeric value for action_type === "video_view" from an action array. */
export function parseActionCount(actions: MetaAction[] | undefined, actionType = "video_view"): number {
  if (!actions || !Array.isArray(actions)) return 0;
  const match = actions.find((a) => a.action_type === actionType);
  return match ? parseInt(match.value, 10) || 0 : 0;
}

/** Parse a Meta string-dollar value like "12.34" into integer cents. */
export function parseMetaMoneyToCents(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Parse a Meta CTR-style string "2.50" (percent) into basis points x100 (2.50% = 25000). */
export function parseMetaRateToBp(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (isNaN(n)) return 0;
  // "2.50" (%) -> 2.50 * 10000 = 25000 (basis points x100 where 1% = 10000)
  return Math.round(n * 10000);
}

export class MetaAdsClient {
  private http: AxiosInstance;
  private accessToken: string;
  private apiVersion: string;

  constructor(opts?: { accessToken?: string; apiVersion?: string }) {
    this.accessToken = opts?.accessToken ?? ENV.metaAccessToken;
    this.apiVersion = opts?.apiVersion ?? ENV.metaGraphApiVersion;
    if (!this.accessToken) {
      throw new Error("Meta access token not configured. Set META_ACCESS_TOKEN in env.");
    }
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}`,
      timeout: 60_000,
    });
    this.http.interceptors.response.use(
      (res) => {
        const usage = res.headers?.["x-business-use-case-usage"];
        if (usage) {
          try {
            const parsed = typeof usage === "string" ? JSON.parse(usage) : usage;
            const accountKeys = Object.keys(parsed || {});
            for (const accKey of accountKeys) {
              const metrics = parsed[accKey]?.[0];
              if (!metrics) continue;
              const maxPct = Math.max(metrics.call_count ?? 0, metrics.total_cputime ?? 0, metrics.total_time ?? 0);
              if (maxPct > 80) {
                console.warn(`${TAG} Rate limit warning: ${accKey} at ${maxPct}% (type=${metrics.type})`);
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
        return res;
      },
      (err) => Promise.reject(err)
    );
  }

  /** Validate the access token and return identity info. */
  async validateToken(): Promise<{ valid: boolean; name?: string; id?: string; error?: string }> {
    try {
      const res = await this.http.get("/me", { params: { access_token: this.accessToken } });
      return { valid: true, name: res.data.name, id: res.data.id };
    } catch (err: any) {
      const msg = err.response?.data?.error?.message ?? err.message;
      return { valid: false, error: msg };
    }
  }

  /** List ad accounts the token has access to. */
  async listAdAccounts(): Promise<MetaAdAccount[]> {
    const res = await this.http.get("/me/adaccounts", {
      params: {
        fields: "id,name,account_status,amount_spent",
        access_token: this.accessToken,
      },
    });
    return res.data?.data ?? [];
  }

  /**
   * List ads for an account. Paginated, use `after` cursor to fetch next page.
   *
   * When `includeCreative=true` (default), fetches the nested creative object in
   * the same request. This is convenient but can trigger Meta's "reduce amount"
   * error on large accounts. When false, only lightweight metadata is returned
   * and creative details must be fetched separately via getAdById.
   */
  async listAds(params: {
    adAccountId: string;
    after?: string;
    limit?: number;
    status?: ("ACTIVE" | "PAUSED" | "ARCHIVED")[];
    includeCreative?: boolean;
  }): Promise<MetaAdsPage> {
    const baseFields = "id,name,status,adset_id,adset_name,campaign_id,campaign_name,created_time,updated_time";
    const fields = params.includeCreative === false
      ? baseFields
      : `${baseFields},creative{id,thumbnail_url,image_url,video_id,effective_object_story_id,body,title}`;
    const query: Record<string, string | number> = {
      fields,
      limit: params.limit ?? 50,
      access_token: this.accessToken,
    };
    if (params.after) query.after = params.after;
    if (params.status && params.status.length > 0) {
      // Meta filtering format
      query.filtering = JSON.stringify([{ field: "ad.effective_status", operator: "IN", value: params.status }]);
    }
    const res = await this.http.get(`/${params.adAccountId}/ads`, { params: query });
    return res.data;
  }

  /** Get total ad count for an account (fast summary call). */
  async getTotalAdCount(adAccountId: string): Promise<number> {
    const res = await this.http.get(`/${adAccountId}/ads`, {
      params: {
        summary: "total_count",
        limit: 1,
        access_token: this.accessToken,
      },
    });
    return res.data?.summary?.total_count ?? 0;
  }

  /**
   * Get insights for ads in a date range.
   * When timeIncrement=1, returns one row per ad per day (daily breakdown).
   * Otherwise, returns one row per ad summed over the range.
   *
   * Uses pagination via `after` cursor. Caller handles the loop.
   */
  async getAdInsights(params: {
    adAccountId: string;
    dateFrom: Date;
    dateTo: Date;
    timeIncrement?: 1 | "all_days";
    after?: string;
    limit?: number;
  }): Promise<MetaInsightsPage> {
    const fields = [
      "ad_id",
      "ad_name",
      "adset_id",
      "adset_name",
      "campaign_id",
      "campaign_name",
      "spend",
      "impressions",
      "clicks",
      "reach",
      "cpm",
      "cpc",
      "ctr",
      "actions",
      "video_play_actions",
      "video_thruplay_watched_actions",
      "video_p25_watched_actions",
      "video_p50_watched_actions",
      "video_p75_watched_actions",
      "video_p100_watched_actions",
      "video_avg_time_watched_actions",
    ].join(",");

    const query: Record<string, string | number> = {
      level: "ad",
      time_range: JSON.stringify({
        since: toMetaDate(params.dateFrom),
        until: toMetaDate(params.dateTo),
      }),
      fields,
      limit: params.limit ?? 100,
      access_token: this.accessToken,
    };
    if (params.timeIncrement) query.time_increment = params.timeIncrement;
    if (params.after) query.after = params.after;

    const res = await this.http.get(`/${params.adAccountId}/insights`, { params: query });
    return res.data;
  }

  /** Get full ad details including creative. Used for one-off lookups. */
  async getAdById(adId: string): Promise<MetaAd | null> {
    try {
      const res = await this.http.get(`/${adId}`, {
        params: {
          fields:
            "id,name,status,adset_id,adset_name,campaign_id,campaign_name,created_time,updated_time,creative{id,thumbnail_url,image_url,video_id,effective_object_story_id,body,title}",
          access_token: this.accessToken,
        },
      });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  }

  /**
   * Fetch a signed preview iframe for an ad via the Ad Preview API.
   *
   * Why this and not `/videos/{id}?fields=source`: the /videos endpoint is
   * denied for our System User token (requires Live Video API App Review).
   * The ads/{id}/previews endpoint works with the ads_read permission we
   * already have and is actually a better UX — it renders the full ad
   * (video + copy + CTA + brand) exactly as it appears in Feed, not just a
   * bare MP4 file. Verified working in Phase 1 of PR 2.
   *
   * Returned iframe src is signed and expires within hours. Cached in
   * memory with a 15-minute TTL so rapid clicks don't hammer the API; a
   * cache miss just re-fetches.
   *
   * Throws on 400/401/403/404 from Meta; upstream should present a fallback
   * "View on Meta" link when the call fails.
   */
  async getAdPreview(
    adId: string,
    format: MetaAdPreviewFormat = "MOBILE_FEED_STANDARD",
  ): Promise<MetaAdPreview> {
    const cacheKey = `${adId}|${format}`;
    const cached = adPreviewCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const res = await this.http.get(`/${adId}/previews`, {
      params: {
        ad_format: format,
        access_token: this.accessToken,
      },
    });
    const body: string = res.data?.data?.[0]?.body ?? "";
    if (!body) {
      throw new Error(`Meta returned no preview body for ad ${adId} (format=${format})`);
    }
    const iframeSrc = extractIframeSrc(body);
    const value: MetaAdPreview = { body, iframeSrc };
    adPreviewCache.set(cacheKey, { value, expiresAt: Date.now() + AD_PREVIEW_CACHE_TTL_MS });
    return value;
  }

  /**
   * Fetch the public `preview_shareable_link` for an ad. Returns a short
   * fb.me URL that opens the ad preview on Facebook Business. Requires the
   * user to be logged into Facebook Business to see the preview content —
   * which is why we open it in a new tab (first-party context) instead of
   * embedding in an iframe.
   *
   * Returns null if the field is missing from Meta's response.
   */
  async getAdShareableLink(adId: string): Promise<string | null> {
    const res = await this.http.get(`/${adId}`, {
      params: {
        fields: "preview_shareable_link",
        access_token: this.accessToken,
      },
    });
    return (res.data?.preview_shareable_link as string | undefined) ?? null;
  }

  /** Test-only: clear the module-level ad preview cache. */
  static __clearAdPreviewCache(): void {
    adPreviewCache.clear();
  }

  /** Get the list of ad account IDs configured via env (CSV). */
  static configuredAdAccountIds(): string[] {
    const raw = ENV.metaAdAccountIds;
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}

function toMetaDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
