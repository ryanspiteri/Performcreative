/**
 * Nano Banana Pro (Imagen 3) Image Generation Service
 * 
 * Uses Google's Imagen 3 model via Gemini API for production-quality image generation.
 * 
 * Key advantages over Gemini 2.0 Flash:
 * - High-fidelity text rendering (headlines always visible and crisp)
 * - Advanced reasoning for complex composition
 * - Better product integration (lighting, shadows, depth)
 * - 4K resolution professional quality
 * - Can study control ad and replicate style accurately
 * 
 * Trade-offs:
 * - 10x more expensive (~$0.12 vs $0.02 per image)
 * - Slower generation (~10-15s vs 3-5s per image)
 */

import axios from "axios";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
if (!GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
}

export interface NanoBananaProOptions {
  prompt: string;
  controlImageUrl?: string; // Reference image for style matching
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  negativePrompt?: string;
}

export interface NanoBananaProResult {
  imageUrl: string;
  mimeType: string;
}

/**
 * Generate image using Nano Banana Pro (Imagen 3)
 */
export async function generateWithNanoBananaPro(
  options: NanoBananaProOptions
): Promise<NanoBananaProResult> {
  const { prompt, controlImageUrl, aspectRatio = "1:1", negativePrompt } = options;

  console.log(`[NanoBananaPro] Generating image with Imagen 3...`);
  console.log(`[NanoBananaPro] Aspect ratio: ${aspectRatio}`);
  console.log(`[NanoBananaPro] Control image: ${controlImageUrl ? "Yes" : "No"}`);

  // Map aspect ratios to Imagen 3 format
  const aspectRatioMap: Record<string, string> = {
    "1:1": "1:1",
    "4:5": "4:5",
    "9:16": "9:16",
    "16:9": "16:9",
  };

  try {
    // Build request body
    const requestBody: any = {
      model: "imagen-3.0-generate-001",
      prompt,
      number_of_images: 1,
      aspect_ratio: aspectRatioMap[aspectRatio],
      safety_filter_level: "block_only_high",
      person_generation: "allow_adult",
    };

    // Add negative prompt if provided
    if (negativePrompt) {
      requestBody.negative_prompt = negativePrompt;
    }

    // Add reference image if provided (for style matching)
    if (controlImageUrl) {
      // Download control image and convert to base64
      const imageResponse = await axios.get(controlImageUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      const base64Image = Buffer.from(imageResponse.data).toString("base64");
      const mimeType = imageResponse.headers["content-type"] || "image/jpeg";

      requestBody.reference_images = [
        {
          image: {
            bytes_base64_encoded: base64Image,
          },
          reference_type: "STYLE", // Use control image for style reference
        },
      ];
      console.log(`[NanoBananaPro] Added control image as style reference`);
    }

    // Call Imagen 3 API via Google AI
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_AI_API_KEY,
        },
        timeout: 60000, // 60 second timeout
      }
    );

    if (!response.data?.predictions?.[0]?.bytes_base64_encoded) {
      throw new Error("No image data returned from Imagen 3 API");
    }

    // Get base64 image from response
    const base64Image = response.data.predictions[0].bytes_base64_encoded;
    const mimeType = response.data.predictions[0].mime_type || "image/png";

    // Upload to S3
    const { storagePut } = await import("../storage");
    const imageBuffer = Buffer.from(base64Image, "base64");
    const fileKey = `iteration-outputs/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const { url: imageUrl } = await storagePut(fileKey, imageBuffer, mimeType);

    console.log(`[NanoBananaPro] Image generated successfully: ${imageUrl}`);

    return {
      imageUrl,
      mimeType,
    };
  } catch (err: any) {
    console.error(`[NanoBananaPro] Generation failed:`, err.message);
    if (err.response?.data) {
      console.error(`[NanoBananaPro] API error details:`, JSON.stringify(err.response.data, null, 2));
    }
    throw new Error(`Nano Banana Pro generation failed: ${err.message}`);
  }
}

/**
 * Generate product ad using Nano Banana Pro
 * This is the main entry point for the iteration pipeline
 */
export async function generateProductAdWithNanoBananaPro(options: {
  prompt: string;
  productRenderUrl?: string;
  controlImageUrl?: string;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
}): Promise<NanoBananaProResult> {
  const { prompt, productRenderUrl, controlImageUrl, aspectRatio } = options;

  // Enhanced prompt with product render instructions if provided
  let enhancedPrompt = prompt;
  if (productRenderUrl) {
    enhancedPrompt = `${prompt}\n\nIMPORTANT: The product bottle/container must be prominently featured in the composition. Ensure proper lighting, shadows, and integration with the background scene.`;
  }

  // Negative prompt to avoid common issues
  const negativePrompt = "blurry text, illegible text, distorted text, floating text, generic stock photo, cluttered composition, amateur quality, low resolution";

  return generateWithNanoBananaPro({
    prompt: enhancedPrompt,
    controlImageUrl,
    aspectRatio,
    negativePrompt,
  });
}
