/**
 * Meta Facebook Login OAuth service.
 *
 * Mirrors server/services/canva.ts but for Facebook Login. The OAuth flow is
 * used to obtain a USER-scope access token, which has broader read access to
 * ad creative fields than our existing System User token. Specifically, a
 * user token held by an admin of the Meta App can read `/videos/{id}?fields=source`
 * — denied for System User tokens — so we can play ad videos inline on
 * /analytics instead of bouncing the user to Facebook.
 *
 * Token lifecycle:
 *   1. User clicks "Connect Facebook" on /settings.
 *   2. Browser redirects to facebook.com/v22.0/dialog/oauth?... with a signed state.
 *   3. User approves, Facebook redirects to /api/meta/callback with `code`.
 *   4. exchangeCodeForToken() → short-lived token (~1-2 hour expiry).
 *   5. exchangeForLongLivedToken() → long-lived token (~60 day expiry).
 *   6. Long-lived token stored in users.metaUserAccessToken.
 *
 * Refresh:
 *   - Facebook user tokens don't have separate refresh tokens. Instead, you
 *     exchange your current long-lived token for a new long-lived token via
 *     the SAME fb_exchange_token grant type. refreshAccessToken() does this.
 *   - Run refresh before expiry. The new token extends 60 days from the
 *     refresh timestamp.
 */
import { ENV } from "../_core/env";
import crypto from "crypto";

const META_GRAPH_BASE = "https://graph.facebook.com";
const META_OAUTH_DIALOG_URL = "https://www.facebook.com";

export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; // short-lived tokens include this; long-lived often omit and imply 60d
}

export interface MetaUserProfile {
  id: string;
  name: string;
  email?: string;
}

/**
 * Generate a PKCE code verifier + challenge pair (S256).
 *
 * Shared with Canva's exact pattern from server/services/canva.ts. Duplicated
 * rather than imported to avoid cross-coupling a generic util through two
 * OAuth providers.
 */
export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Build the Facebook Login authorization URL.
 *
 * Two modes:
 *  1. Facebook Login for Business (FBL4B) — when ENV.metaOAuthConfigId is set,
 *     we pass `config_id` and omit `scope`. The configuration defines the
 *     permissions bundle server-side so the scope string is redundant (and
 *     in fact Meta rejects requests that pass both).
 *  2. Classic Facebook Login — fallback for apps without FBL4B. Passes the
 *     scope string directly.
 *
 * PKCE is included in both modes defensively: a CSRF attacker who steals the
 * state cookie still can't exchange the code without also stealing the
 * verifier from server memory.
 */
export function getMetaAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
  const base: Record<string, string> = {
    client_id: ENV.metaAppId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  };

  if (ENV.metaOAuthConfigId) {
    // Facebook Login for Business path
    base.config_id = ENV.metaOAuthConfigId;
  } else {
    // Classic Facebook Login path
    base.scope = "ads_read,ads_management,business_management";
  }

  const params = new URLSearchParams(base);
  return `${META_OAUTH_DIALOG_URL}/${ENV.metaGraphApiVersion}/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange the OAuth code for a short-lived user access token.
 * This is the first of two exchanges — we immediately swap this for a
 * long-lived token via exchangeForLongLivedToken before storing it.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    client_id: ENV.metaAppId,
    client_secret: ENV.metaAppSecret,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(
    `${META_GRAPH_BASE}/${ENV.metaGraphApiVersion}/oauth/access_token?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Meta] Token exchange failed: ${response.status}`, error);
    throw new Error(`Meta token exchange failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<MetaTokenResponse>;
}

/**
 * Exchange a short-lived user token for a long-lived one (~60 day expiry).
 * Same endpoint is reused later for refresh (see refreshAccessToken).
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: ENV.metaAppId,
    client_secret: ENV.metaAppSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `${META_GRAPH_BASE}/${ENV.metaGraphApiVersion}/oauth/access_token?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Meta] Long-lived exchange failed: ${response.status}`, error);
    throw new Error(`Meta long-lived token exchange failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<MetaTokenResponse>;
}

/**
 * Refresh an existing long-lived user token. Facebook treats this as just
 * another fb_exchange_token call — you trade your current valid long-lived
 * token for a new long-lived token that expires 60 days from now.
 *
 * Throws if the current token is already expired (Facebook rejects the
 * exchange). Callers should catch and surface a re-auth prompt.
 */
export async function refreshAccessToken(currentToken: string): Promise<MetaTokenResponse> {
  return exchangeForLongLivedToken(currentToken);
}

/**
 * Fetch the connected user's name + id. Used by the Settings UI to show
 * "Connected as Ryan Spiteri" after a successful OAuth flow.
 */
export async function fetchMetaUserProfile(accessToken: string): Promise<MetaUserProfile> {
  const params = new URLSearchParams({
    fields: "id,name,email",
    access_token: accessToken,
  });
  const response = await fetch(
    `${META_GRAPH_BASE}/${ENV.metaGraphApiVersion}/me?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Meta profile fetch failed: ${response.status} ${error}`);
  }
  return response.json() as Promise<MetaUserProfile>;
}

/**
 * Compute the absolute expiry timestamp from a Meta token response. Meta
 * long-lived tokens sometimes omit `expires_in`; in that case we assume
 * 60 days (their documented default).
 */
export function computeExpiresAt(res: MetaTokenResponse): Date {
  const seconds = res.expires_in && res.expires_in > 0 ? res.expires_in : 60 * 24 * 60 * 60;
  return new Date(Date.now() + seconds * 1000);
}
