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

  // TWO-PASS COMPOSITING MODE
  // Pass 1: Generate background + text only (NO product) using background-only prompt
  // Pass 2: Sharp composites the real product render on top
  // This guarantees pixel-perfect product labels with no AI product hallucination
  if (useCompositing && productRenderUrl) {
    console.log(`[NanaBanana] Using TWO-PASS compositing mode (${modelLabel}) for pixel-perfect labels`);
    const { compositeProductOnBackground, buildBackgroundOnlyPrompt } = await import("./productCompositor");

    // Extract headline and background style from the incoming prompt so we can
    // rebuild it as a background-only prompt (strips all product integration instructions)
    const headlineMatch = prompt.match(/Headline:\s*"([^"]+)"/);
    const subheadlineMatch = prompt.match(/Subheadline:\s*"([^"]+)"/);
    const backgroundMatch = prompt.match(/=== BACKGROUND & ATMOSPHERE ===\n([\s\S]+?)\n===/);
    const productNameMatch = prompt.match(/for ([A-Za-z0-9 ]+) that MATCHES/) ||
                             prompt.match(/supplement bottle.*?([A-Za-z0-9 ]+) must be/);

    const extractedHeadline = headlineMatch?.[1] || "PREMIUM SUPPLEMENT";
    const extractedSubheadline = subheadlineMatch?.[1];
    const extractedBackground = backgroundMatch?.[1]?.trim() ||
      "Dramatic premium lighting with cinematic depth and atmospheric effects";
    const extractedProductName = productNameMatch?.[1]?.trim() || "ONEST Health Supplement";

    const backgroundOnlyPrompt = buildBackgroundOnlyPrompt({
      headline: extractedHeadline,
      subheadline: extractedSubheadline,
      productName: extractedProductName,
      backgroundStyleDescription: extractedBackground,
      aspectRatio,
      productPosition: productPosition as any,
    });

    console.log(`[NanaBanana] Pass 1 — background-only prompt (headline: "${extractedHeadline}")`);

    // Pass 1: Generate background + text only (no product)
    // NOTE: We still pass controlImageUrl so Gemini can match the reference style,
    // but the background-only prompt explicitly forbids drawing any product.
    const bgResult = await generateProductAdWithNanaBananaPro_internal({
      prompt: backgroundOnlyPrompt,
      controlImageUrl,
      aspectRatio,
      resolution,
      modelId,
      modelLabel,
    });

    console.log(`[NanaBanana] Pass 1 complete: background generated at ${bgResult.imageUrl}`);

    // Pass 2: Composite real product render onto the background
    const composited = await compositeProductOnBackground({
      backgroundUrl: bgResult.imageUrl,
      productRenderUrl,
      productPosition: productPosition as any,
      productScale,
      addShadow: true,
      addGlow: false,
    });

    console.log(`[NanaBanana] Pass 2 complete: composited image at ${composited.imageUrl}`);

    return {
      imageUrl: composited.imageUrl,
      s3Key: composited.s3Key,
    };
  }

  return generateProductAdWithNanaBananaPro_internal({
    prompt,
    controlImageUrl,
    productRenderUrl,
    aspectRatio,
    resolution,
    modelId,
    modelLabel,
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
}

async function generateProductAdWithNanaBananaPro_internal(
  opts: InternalOptions
): Promise<NanoBananaProResult> {
  const { prompt, controlImageUrl, productRenderUrl, aspectRatio, resolution, modelId, modelLabel } = opts;

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

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      requestBody,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 180000,
      }
    );

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
