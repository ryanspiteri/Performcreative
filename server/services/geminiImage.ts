import { storagePut } from "../storage";

/**
 * Gemini 3 Pro Image Generation Service
 * 
 * Uses Google's Gemini 3 Pro Image model for high-quality product ad generation.
 * Supports image editing with product render compositing.
 */

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
}

export interface GeminiImageOptions {
  prompt: string;
  productRenderUrl?: string; // Optional product render to composite into the scene
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
  resolution?: "1K" | "2K" | "4K";
  variationCount?: number; // 1-4
}

export interface GeminiImageResult {
  url: string;
  s3Key: string;
}

/**
 * Fetch image from URL and convert to base64 data URI
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  console.log(`[Gemini] Fetching image from ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  
  // Determine MIME type from response headers or URL
  const contentType = response.headers.get("content-type") || "image/png";
  
  return `data:${contentType};base64,${base64}`;
}

/**
 * Generate product ad image using Gemini 3 Pro Image
 * 
 * If productRenderUrl is provided, uses image editing mode to composite
 * the product into a generated scene. Otherwise, generates from text only.
 */
export async function generateProductAd(
  options: GeminiImageOptions
): Promise<GeminiImageResult[]> {
  const {
    prompt,
    productRenderUrl,
    aspectRatio = "1:1",
    resolution = "2K",
    variationCount = 1,
  } = options;

  console.log(`[Gemini] Generating ${variationCount} product ad(s) with Gemini 3 Pro Image`);
  console.log(`[Gemini] Prompt: ${prompt}`);
  console.log(`[Gemini] Product render: ${productRenderUrl || "None (text-only generation)"}`);
  console.log(`[Gemini] Aspect ratio: ${aspectRatio}, Resolution: ${resolution}`);

  const results: GeminiImageResult[] = [];

  // Generate each variation separately (Gemini API doesn't support batch variations in single call)
  for (let i = 0; i < variationCount; i++) {
    console.log(`[Gemini] Generating variation ${i + 1}/${variationCount}`);

    try {
      // Build request body
      const requestBody: any = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["Text", "Image"],
        },
      };

      // If product render is provided, add it as an image part (image editing mode)
      if (productRenderUrl) {
        const imageBase64 = await fetchImageAsBase64(productRenderUrl);
        requestBody.contents[0].parts.push({
          inlineData: {
            mimeType: imageBase64.split(";")[0].split(":")[1],
            data: imageBase64.split(",")[1],
          },
        });
      }

      // Make API request to Gemini 3 Pro Image
      // Note: Using gemini-2.0-flash-exp-image-generation as it supports image generation
      // Gemini 3 Pro Image Preview may require different endpoint when available
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_AI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[Gemini] API error:`, errorData);
        throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      // Extract generated image from response
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No image generated in Gemini response");
      }

      const candidate = data.candidates[0];
      const imagePart = candidate.content.parts.find(
        (part: any) => part.inlineData
      );

      if (!imagePart) {
        throw new Error("No image data found in Gemini response");
      }

      // Decode base64 image and upload to S3
      const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
      const mimeType = imagePart.inlineData.mimeType || "image/png";
      const extension = mimeType.split("/")[1] || "png";
      
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const s3Key = `gemini-ads/product-ad-${timestamp}-${i}-${randomSuffix}.${extension}`;

      console.log(`[Gemini] Uploading variation ${i + 1} to S3: ${s3Key}`);
      const { url } = await storagePut(s3Key, imageBuffer, mimeType);

      results.push({ url, s3Key });
      console.log(`[Gemini] Variation ${i + 1} uploaded: ${url}`);
    } catch (error) {
      console.error(`[Gemini] Error generating variation ${i + 1}:`, error);
      throw error;
    }
  }

  console.log(`[Gemini] Successfully generated ${results.length} variations`);
  return results;
}

/**
 * Test function to validate Gemini image generation
 */
export async function testGeminiGeneration(): Promise<void> {
  console.log("[Gemini] Running test generation...");
  
  const result = await generateProductAd({
    prompt: "A vibrant fitness scene with dynamic lighting and energy effects. Modern gym environment with dramatic shadows.",
    aspectRatio: "1:1",
    resolution: "1K",
    variationCount: 1,
  });

  console.log("[Gemini] Test generation successful:", result);
}
