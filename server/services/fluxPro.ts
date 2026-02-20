/**
 * Flux Pro API Integration
 * Black Forest Labs API for photographic background generation
 * Docs: https://docs.bfl.ml/
 */

// Using native fetch (Node 18+)

const FLUX_API_KEY = process.env.FLUX_PRO_API_KEY;
const FLUX_API_BASE = "https://api.bfl.ai";

interface FluxProRequest {
  prompt: string;
  width?: number;
  height?: number;
  prompt_upsampling?: boolean;
  safety_tolerance?: number;
}

interface FluxProResponse {
  id: string;
  polling_url?: string;
}

interface FluxProResult {
  id: string;
  status: "Ready" | "Pending" | "Request Moderated" | "Content Moderated" | "Error";
  result?: {
    sample: string; // URL to generated image
  };
}

/**
 * Generate a background image using Flux Pro
 * Returns the URL of the generated image
 */
export async function generateFluxProBackground(
  prompt: string,
  width: number = 1200,
  height: number = 1200
): Promise<string> {
  if (!FLUX_API_KEY) {
    throw new Error("FLUX_PRO_API_KEY not configured");
  }

  console.log(`[FluxPro] Generating background: "${prompt.slice(0, 100)}..."`);

  // Step 1: Submit generation request
  const requestBody: FluxProRequest = {
    prompt,
    width,
    height,
    prompt_upsampling: false,
    safety_tolerance: 2,
  };

  const submitResponse = await fetch(`${FLUX_API_BASE}/v1/flux-pro-1.1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-key": FLUX_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(
      `Flux Pro API request failed: ${submitResponse.status} ${errorText}`
    );
  }

  const submitData = (await submitResponse.json()) as FluxProResponse;
  const requestId = submitData.id;
  const pollingUrl = submitData.polling_url || `${FLUX_API_BASE}/v1/get_result?id=${requestId}`;

  console.log(`[FluxPro] Request submitted: ${requestId}`);
  console.log(`[FluxPro] Polling URL: ${pollingUrl}`);

  // Step 2: Poll for result (max 120 seconds)
  const maxAttempts = 60;
  const pollInterval = 2000; // 2 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const resultResponse = await fetch(pollingUrl, {
      headers: {
        "x-key": FLUX_API_KEY,
      },
    });

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      throw new Error(
        `Flux Pro result check failed: ${resultResponse.status} ${errorText}`
      );
    }

    const resultData = (await resultResponse.json()) as FluxProResult;

    if (resultData.status === "Ready" && resultData.result?.sample) {
      console.log(`[FluxPro] Generation complete: ${resultData.result.sample}`);
      return resultData.result.sample;
    }

    if (resultData.status === "Error") {
      throw new Error("Flux Pro generation failed with error status");
    }

    if (
      resultData.status === "Request Moderated" ||
      resultData.status === "Content Moderated"
    ) {
      throw new Error(
        `Flux Pro generation moderated: ${resultData.status}`
      );
    }

    console.log(
      `[FluxPro] Polling attempt ${attempt + 1}/${maxAttempts}: ${resultData.status}`
    );
  }

  throw new Error("Flux Pro generation timed out after 120 seconds");
}
