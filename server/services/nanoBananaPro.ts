/**
 * Nano Banana Image Generation Service
 *
 * Supports two models:
 *
 * 1. Nano Banana Pro (gemini-3-pro-image-preview)
 *    - Highest quality, advanced reasoning ("Thinking")
 *    - High-fidelity text rendering, up to 4K
 *    - ~$0.15/image, ~10-15s generation time
 *
 * 2. Nano Banana 2 (gemini-3.1-flash-image-preview)
 *    - 4× faster, ~$0.04/image
 *    - Ranked #1 in Image Arena (as of March 2026)
 *    - Same resolution support (up to 4K)
 *    - Slightly less "thinking" depth but excellent quality
 */

import axios from "axios";
import { storagePut } from "../storage";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
if (!GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
}

/** Which Gemini image model to use */
export type ImageModel = "nano_banana_pro" | "nano_banana_2";

const MODEL_IDS: Record<ImageModel, string> = {
  nano_banana_pro: "gemini-3-pro-image-preview",
  nano_banana_2: "gemini-3.1-flash-image-preview",
};

export const MODEL_LABELS: Record<ImageModel, string> = {
  nano_banana_pro: "Nano Banana Pro",
  nano_banana_2: "Nano Banana 2",
};

export interface NanoBananaProOptions {
  prompt: string;
  controlImageUrl?: string; // Reference image for style matching
  productRenderUrl?: string; // Product render to composite
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "4:5" | "5:4";
  resolution?: "1K" | "2K" | "4K";
  /** Which model to use. Defaults to nano_banana_pro for backwards compatibility. */
  model?: ImageModel;
  /** When true, uses two-pass compositing: generate background only, then overlay real product render */
  useCompositing?: boolean;
  /** Product position for compositing (default: "center") */
  productPosition?: "center" | "left" | "right" | "bottom-center" | "bottom-left" | "bottom-right";
  /** Product scale as fraction of canvas width (default: 0.45) */
  productScale?: number;
  /** Person type reference image URL. Gemini generates a person matching this type/aesthetic. */
  personImageUrl?: string;
}

export interface NanoBananaProResult {
  imageUrl: string;
  s3Key: string;
}

/**
 * Generate a product ad image using Nano Banana Pro or Nano Banana 2
 */
export async function generateProductAdWithNanoBananaPro(
  options: NanoBananaProOptions
): Promise<NanoBananaProResult> {
  const {
    prompt,
    controlImageUrl,
    productRenderUrl,
    aspectRatio = "1:1",
    resolution = "2K",
    model = "nano_banana_pro",
    useCompositing = false,
    productPosition = "center",
    productScale = 0.45,
  } = options;

  const modelId = MODEL_IDS[model];
  const modelLabel = MODEL_LABELS[model];

  // NOTE: Two-pass compositing (useCompositing) was disabled in Round 15.
  // The productCompositor module has been removed. If two-pass compositing is
  // needed again, it should be rebuilt from scratch.

  return generateProductAdWithNanaBananaPro_internal({
    prompt,
    controlImageUrl,
    productRenderUrl,
    aspectRatio,
    resolution,
    modelId,
    modelLabel,
    personImageUrl: options.personImageUrl,
  });
}

// ----------------------------------------------------------------
// Internal helper — calls the Gemini API directly
// ----------------------------------------------------------------

interface InternalOptions {
  prompt: string;
  controlImageUrl?: string;
  productRenderUrl?: string;
  aspectRatio: string;
  resolution: string;
  modelId: string;
  modelLabel: string;
  personImageUrl?: string;
}

async function generateProductAdWithNanaBananaPro_internal(
  opts: InternalOptions
): Promise<NanoBananaProResult> {
  const { prompt, controlImageUrl, productRenderUrl, aspectRatio, resolution, modelId, modelLabel, personImageUrl } = opts;

  console.log(`[NanaBanana] Generating image with ${modelLabel} (${modelId})`);
  console.log(`[NanaBanana] Aspect ratio: ${aspectRatio}, Resolution: ${resolution}`);

  try {
    const contents: any[] = [];

    if (controlImageUrl) {
      console.log(`[NanaBanana] Using control image: ${controlImageUrl}`);
      const controlImageData = await fetchImageAsBase64(controlImageUrl);
      contents.push({
        parts: [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: controlImageData,
            },
          },
        ],
      });
    }

    if (productRenderUrl) {
      console.log(`[NanaBanana] Using product render: ${productRenderUrl}`);
      const productImageData = await fetchImageAsBase64(productRenderUrl);
      contents.push({
        parts: [
          {
            inline_data: {
              mime_type: "image/png",
              data: productImageData,
            },
          },
        ],
      });
    }

    if (personImageUrl) {
      console.log(`[NanaBanana] Using person type reference: ${personImageUrl}`);
      const personImageData = await fetchImageAsBase64(personImageUrl);
      contents.push({
        parts: [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: personImageData,
            },
          },
        ],
      });
    }

    contents.push({
      parts: [{ text: prompt }],
    });

    const generationConfig: any = {
      response_modalities: ["IMAGE"],
    };

    if (!controlImageUrl) {
      generationConfig.image_config = {
        aspect_ratio: aspectRatio,
        image_size: resolution,
      };
    }

    const requestBody = {
      contents,
      generation_config: generationConfig,
    };

    console.log(`[NanaBanana] Sending request to Gemini API (${modelId})...`);

    // Nano Banana Pro is officially quoted at 2-3 min per image, but slow
    // days plus our heavier prompts (label specs + style carve-outs + angle
    // blocks) have hit 4 min. 360s gives real headroom; retry-once on
    // timeout handles the long tail without inflating the floor for fast
    // requests.
    const HTTP_TIMEOUT = 360_000;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GOOGLE_AI_API_KEY}`;
    const requestConfig = {
      headers: { "Content-Type": "application/json" },
      timeout: HTTP_TIMEOUT,
    };

    let response;
    try {
      response = await axios.post(apiUrl, requestBody, requestConfig);
    } catch (err: any) {
      // Retry once on timeout. If Gemini is just slow this run, a second
      // attempt usually lands fast. If both attempts time out, surface the
      // error so the partial-success path in iterationPipeline can ship the
      // other variations and mark this one as failed.
      const isTimeout = err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
      if (!isTimeout) throw err;
      console.warn(`[NanaBanana] First attempt timed out after ${HTTP_TIMEOUT}ms, retrying once...`);
      response = await axios.post(apiUrl, requestBody, requestConfig);
      console.log(`[NanaBanana] Retry succeeded.`);
    }

    console.log(`[NanaBanana] Received response from Gemini API`);

    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidates in Gemini API response");
    }

    const parts = candidates[0].content.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No parts in Gemini API response");
    }

    const finalImageParts = parts.filter((p: any) => p.inlineData && !p.thought);

    if (finalImageParts.length === 0) {
      console.error("[NanaBanana] No final image found, all parts:", JSON.stringify(parts, null, 2));
      throw new Error("No final image in Gemini API response (only thought images found)");
    }

    const imagePart = finalImageParts[finalImageParts.length - 1];
    const imageData = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType;

    console.log(`[NanaBanana] Image generated successfully, uploading to S3...`);

    const imageBuffer = Buffer.from(imageData, "base64");
    const fileExtension = mimeType === "image/png" ? "png" : "jpg";
    const s3Key = `nano-banana/${modelId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    const { url: imageUrl } = await storagePut(s3Key, imageBuffer, mimeType);

    console.log(`[NanaBanana] Image uploaded to S3: ${imageUrl}`);

    return { imageUrl, s3Key };
  } catch (error: any) {
    console.error(`[NanaBanana] Error generating image (${modelLabel}):`, error.response?.data || error.message);
    throw new Error(
      `${modelLabel} generation failed: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// NanaBananaProResult is already exported above — no re-export needed

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
    });
    return Buffer.from(response.data).toString("base64");
  } catch (error: any) {
    console.error(`[NanaBanana] Error fetching image from ${url}:`, error.message);
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
}
