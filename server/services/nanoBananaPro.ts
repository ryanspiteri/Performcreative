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
    useCompositing = false,
    productPosition = "center",
    productScale = 0.45,
  } = options;

  // TWO-PASS COMPOSITING MODE
  // Generates background only, then composites real product render on top
  // This guarantees pixel-perfect product labels
  if (useCompositing && productRenderUrl) {
    console.log("[NanoBananaPro] Using TWO-PASS compositing mode for pixel-perfect labels");
    const { compositeProductOnBackground } = await import("./productCompositor");

    // Pass 1: Generate background only (no product)
    const bgResult = await generateProductAdWithNanoBananaPro({
      prompt: prompt + "\n\nCRITICAL: Do NOT include any product bottle, jar, container, or supplement packaging in this image. Generate ONLY the background scene, text, and atmospheric effects. Leave a clear space in the " + productPosition + " area for the product to be composited later.",
      controlImageUrl,
      // Do NOT pass productRenderUrl — we want background only
      aspectRatio,
      resolution,
      useCompositing: false, // Prevent infinite recursion
    });

    console.log(`[NanoBananaPro] Pass 1 complete: background generated at ${bgResult.imageUrl}`);

    // Pass 2: Composite real product render onto the background
    const composited = await compositeProductOnBackground({
      backgroundUrl: bgResult.imageUrl,
      productRenderUrl,
      productPosition: productPosition as any,
      productScale,
      addShadow: true,
      addGlow: false,
    });

    console.log(`[NanoBananaPro] Pass 2 complete: composited image at ${composited.imageUrl}`);

    return {
      imageUrl: composited.imageUrl,
      s3Key: composited.s3Key,
    };
  }

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
    };

    // Only add image_config if we're generating images (not editing)
    if (!controlImageUrl) {
      generationConfig.image_config = {
        aspect_ratio: aspectRatio,
        image_size: resolution,
      };
    }

    const requestBody = {
      contents,
      generation_config: generationConfig, // Note: snake_case for REST API
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
        timeout: 180000, // 180 second timeout for Nano Banana Pro (Thinking mode with complex prompts can take 90-120s)
      }
    );

    console.log(`[NanoBananaPro] Received response from Gemini API`);
    console.log(`[NanoBananaPro] Full response:`, JSON.stringify(response.data, null, 2));

    // Extract generated image from response
    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidates in Gemini API response");
    }

    const parts = candidates[0].content.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No parts in Gemini API response");
    }

    // Filter out thought images and find the final image
    // Thought images have "thought": true, final images don't
    const finalImageParts = parts.filter((p: any) => p.inlineData && !p.thought);
    
    if (finalImageParts.length === 0) {
      console.error("[NanoBananaPro] No final image found, all parts:", JSON.stringify(parts, null, 2));
      throw new Error("No final image in Gemini API response (only thought images found)");
    }

    // Use the last final image (in case there are multiple)
    const imagePart = finalImageParts[finalImageParts.length - 1];
    const imageData = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType;

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
