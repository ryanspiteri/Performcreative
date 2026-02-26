import { ENV } from "../_core/env";
import crypto from "crypto";

const CANVA_API_BASE = "https://api.canva.com/rest/v1";
const CANVA_OAUTH_BASE = "https://www.canva.com/api/oauth";

interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface CanvaAssetUploadResponse {
  asset: {
    id: string;
    name: string;
    tags: string[];
    created_at: number;
    updated_at: number;
  };
}

interface CanvaDesignCreateResponse {
  design: {
    id: string;
    title: string;
    urls: {
      edit_url: string;
      view_url: string;
    };
  };
}

/**
 * Generate PKCE code verifier and challenge for OAuth
 */
export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Generate Canva OAuth authorization URL
 */
export function getCanvaAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: ENV.CANVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "design:permission:read asset:read asset:write design:content:read design:content:write folder:permission:read comment:write design:permission:write folder:write profile:read folder:read brandtemplate:content:read comment:read brandtemplate:meta:read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${CANVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string, redirectUri: string, codeVerifier: string): Promise<CanvaTokenResponse> {
  const response = await fetch(`${CANVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: ENV.CANVA_CLIENT_ID,
      client_secret: ENV.CANVA_CLIENT_SECRET,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva token exchange failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<CanvaTokenResponse> {
  const response = await fetch(`${CANVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ENV.CANVA_CLIENT_ID,
      client_secret: ENV.CANVA_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva token refresh failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Upload image to Canva as an asset
 */
export async function uploadAssetToCanva(accessToken: string, imageUrl: string, assetName: string): Promise<CanvaAssetUploadResponse> {
  const response = await fetch(`${CANVA_API_BASE}/assets`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: assetName,
      url: imageUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva asset upload failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Create a design from an uploaded asset
 */
export async function createDesignFromAsset(
  accessToken: string,
  assetId: string,
  title: string,
  width: number,
  height: number
): Promise<CanvaDesignCreateResponse> {
  const response = await fetch(`${CANVA_API_BASE}/designs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      asset_id: assetId,
      title,
      design_type: "SocialPost",
      width,
      height,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva design creation failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get user's Canva profile
 */
export async function getCanvaProfile(accessToken: string): Promise<{ id: string; display_name: string; email: string }> {
  const response = await fetch(`${CANVA_API_BASE}/users/me/profile`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva profile fetch failed: ${response.status} ${error}`);
  }

  return response.json();
}
