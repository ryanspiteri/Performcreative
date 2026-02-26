import { ENV } from "../_core/env";
import crypto from "crypto";

const CANVA_API_BASE = "https://api.canva.com/rest/v1";
const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface CanvaAssetUploadJobResponse {
  job: {
    id: string;
    status: "in_progress" | "success" | "failed";
    asset?: {
      id: string;
      name: string;
      tags: string[];
      created_at: number;
      updated_at: number;
    };
    error?: {
      code: string;
      message: string;
    };
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
  return `${CANVA_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string, redirectUri: string, codeVerifier: string): Promise<CanvaTokenResponse> {
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
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
    console.error(`[Canva] Token exchange failed: ${response.status}`, error);
    throw new Error(`Canva token exchange failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<CanvaTokenResponse> {
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
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
 * Downloads the image from URL and uploads binary data to Canva
 */
export async function uploadAssetToCanva(accessToken: string, imageUrl: string, assetName: string): Promise<CanvaAssetUploadJobResponse> {
  // Download the image first
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();

  // Base64 encode the asset name for the metadata header
  const nameBase64 = Buffer.from(assetName).toString("base64");

  // Upload to Canva using asset-uploads endpoint
  const response = await fetch(`${CANVA_API_BASE}/asset-uploads`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: nameBase64 }),
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva asset upload failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  
  // The API returns a job object, we need to poll for completion
  // For now, return the job response
  return result;
}

/**
 * Create a design from an uploaded asset
 * Creates a custom-sized design with the uploaded asset
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
      design_type: {
        type: "custom",
        width,
        height,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva design creation failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Poll asset upload job until completion
 */
export async function pollAssetUploadJob(accessToken: string, jobId: string, maxAttempts = 30): Promise<CanvaAssetUploadJobResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${CANVA_API_BASE}/asset-uploads/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canva job status check failed: ${response.status} ${error}`);
    }

    const result: CanvaAssetUploadJobResponse = await response.json();
    
    if (result.job.status === "success") {
      return result;
    } else if (result.job.status === "failed") {
      throw new Error(`Asset upload failed: ${result.job.error?.message || "Unknown error"}`);
    }
    
    // Still in progress, wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error("Asset upload timed out after 60 seconds");
}

/**
 * Get brand template dataset (list of autofillable fields)
 */
export async function getBrandTemplateDataset(accessToken: string, templateId: string): Promise<any> {
  const response = await fetch(`${CANVA_API_BASE}/brand-templates/${templateId}/dataset`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva get template dataset failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Create autofill job to generate design from brand template
 */
export async function createAutofillJob(accessToken: string, templateId: string, data: Record<string, any>): Promise<any> {
  const response = await fetch(`${CANVA_API_BASE}/autofills`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brand_template_id: templateId,
      data,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva create autofill job failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Poll autofill job until completion
 */
export async function pollAutofillJob(accessToken: string, jobId: string, maxAttempts = 30): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${CANVA_API_BASE}/autofills/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canva autofill job status check failed: ${response.status} ${error}`);
    }

    const result = await response.json();
    
    if (result.job.status === "success") {
      return result;
    } else if (result.job.status === "failed") {
      throw new Error(`Autofill job failed: ${result.job.error?.message || "Unknown error"}`);
    }
    
    // Still in progress, wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error("Autofill job timed out after 60 seconds");
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
