/**
 * Nano Banana Pro Image Generation Service
 * 
 * Uses Gemini 3 Pro Image Preview (gemini-3-pro-image-preview) for production-quality
 * image generation with high-fidelity text rendering and advanced reasoning.
 * 
 * Key Features:
 * - High-fidelity text rendering (headlines always visible and accurate)
 * - Advanced reasoning ("Thinking") for complex compositions
 * - Better product integration (lighting, shadows, depth)
 * - Up to 4K resolution support
 * - Up to 14 reference images for style matching
 * 
 * Trade-offs vs Gemini 2.5 Flash Image:
 * - 10x more expensive (~$0.12 vs $0.02 per image)
 * - Slower generation (~10-15s vs 3-5s per image)
 * - But produces professional-grade outputs worth the cost
 */

import axios from "axios";
import { storagePut } from "../storage";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
if (!GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
}

export interface NanoBananaProOptions {
  prompt: string;
  controlImageUrl?: string; // Reference image for style matching
  productRenderUrl?: string; // Product render to composite
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "4:5" | "5:4";
  resolution?: "1K" | "2K" | "4K";
}

export interface NanoBananaProResult {
  imageUrl: string;
  s3Key: string;
}

/**
 * Generate a product ad image using Nano Banana Pro (Gemini 3 Pro Image)
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
  } = options;

  console.log("[NanoBananaPro] Generating image with Gemini 3 Pro Image Preview");
  console.log(`[NanoBananaPro] Aspect ratio: ${aspectRatio}, Resolution: ${resolution}`);

  try {
    // Build request body for Gemini API
    const contents: any[] = [];

    // Add control image as reference (if provided)
    if (controlImageUrl) {
      console.log(`[NanoBananaPro] Using control image: ${controlImageUrl}`);
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

    // Add product render (if provided)
    if (productRenderUrl) {
      console.log(`[NanoBananaPro] Using product render: ${productRenderUrl}`);
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

    // Add text prompt
    contents.push({
      parts: [{ text: prompt }],
    });

    // Build generation config
    const generationConfig: any = {
      response_modalities: ["IMAGE"],
      image_config: {
        aspect_ratio: aspectRatio,
        image_size: resolution,
      },
    };

    const requestBody = {
      contents,
      generationConfig,
    };

    console.log(`[NanoBananaPro] Sending request to Gemini API...`);

    // Call Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_AI_API_KEY}`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 second timeout for Nano Banana Pro (slower than Flash)
      }
    );

    console.log(`[NanoBananaPro] Received response from Gemini API`);

    // Extract generated image from response
    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidates in Gemini API response");
    }

    const parts = candidates[0].content.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No parts in Gemini API response");
    }

    // Find the image part
    const imagePart = parts.find((p: any) => p.inline_data);
    if (!imagePart) {
      throw new Error("No image in Gemini API response");
    }

    const imageData = imagePart.inline_data.data;
    const mimeType = imagePart.inline_data.mime_type;

    console.log(`[NanoBananaPro] Image generated successfully, uploading to S3...`);

    // Upload to S3
    const imageBuffer = Buffer.from(imageData, "base64");
    const fileExtension = mimeType === "image/png" ? "png" : "jpg";
    const s3Key = `nano-banana-pro/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    
    const { url: imageUrl } = await storagePut(s3Key, imageBuffer, mimeType);

    console.log(`[NanoBananaPro] Image uploaded to S3: ${imageUrl}`);

    return {
      imageUrl,
      s3Key,
    };
  } catch (error: any) {
    console.error("[NanoBananaPro] Error generating image:", error.response?.data || error.message);
    throw new Error(`Nano Banana Pro generation failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

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
    console.error(`[NanoBananaPro] Error fetching image from ${url}:`, error.message);
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
}
