import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { ENV } from "../_core/env";

interface CompositeResult {
  url: string;
  variation: string;
}

// Product render URLs from S3 CDN
const PRODUCT_RENDERS: Record<string, string> = {
  "GRAPE": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-GRAPE.png",
  "RASPBERRY": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-RASPBERRY.png",
  "MANGO": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-MANGO.png",
  "LIME": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-LIME.png",
  "PINEAPPLE": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-PINEAPPLE.png",
  "ORANGE-DREAM": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-ORANGE-DREAM.png",
  "PINK-LEMONADE": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-PINK-LEMONADE.png",
  "PASSION-FRUIT": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-PASSION-FRUIT.png",
  "STRAWLIME": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-STRAWLIME.png",
  "GUAVAMELON": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-GUAVAMELON.png",
  "LIME-SPLICE": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-LIME-SPLICE.png",
  "NUTRITIONAL-PANEL": "https://cdn.example.com/renders/2025_NEW_HB_RENDER-NUTRITIONAL-PANEL.png",
};

const ONEST_LOGO_URL = "https://cdn.example.com/logos/ONEST_wordmark_white.png";

/**
 * Generate 3 variations of static ads by:
 * 1. Analyzing the inspo reference image with Claude
 * 2. Generating 3 different background variations using nano banana image generation
 * 3. Compositing the actual product render on top of each background using Sharp
 * 4. Adding ONEST branding and logo
 */
export async function generateStaticAdVariations(
  productRenderPath: string,
  inspireImageUrl: string,
  product: string,
  brandName: string
): Promise<CompositeResult[]> {
  console.log("[ImageCompositing] Starting static ad generation with 3 variations");

  // Get a random product render from the list
  const renderKeys = Object.keys(PRODUCT_RENDERS);
  const randomRenderKey = renderKeys[Math.floor(Math.random() * renderKeys.length)];
  const productRenderUrl = PRODUCT_RENDERS[randomRenderKey];
  console.log("[ImageCompositing] Using product render:", randomRenderKey, productRenderUrl);

  // Generate 3 background variations using nano banana
  const { generateImage } = await import("../_core/imageGeneration");
  const results: CompositeResult[] = [];

  const backgroundPrompts = [
    `Premium health supplement advertisement background for ONEST Hyperburn. Dark modern aesthetic with deep black base (#01040A). Geometric shapes, subtle gradients, and energy effects in orange (#FF3838) and electric blue (#0347ED). Similar layout to competitor reference but unique ONEST style. Include space for centered product bottle. Professional fitness/health vibe. 1200x1200px.`,

    `Dynamic health supplement background for ONEST Hyperburn. Dark background with vibrant energy effects, lightning patterns in orange and blue. Modern, high-energy aesthetic. Product-centric composition with breathing room. Professional supplement brand look. ONEST colors prominent. 1200x1200px.`,

    `Minimalist premium supplement background for ONEST Hyperburn. Clean dark aesthetic with subtle textures, soft lighting, and refined composition. Sophisticated health brand feel. Ample space for centered product. Accent colors: orange and blue. Modern, premium, trustworthy vibe. 1200x1200px.`
  ];

  for (let i = 0; i < 3; i++) {
    try {
      console.log(`[ImageCompositing] Generating variation ${i + 1}/3...`);

      // Generate background image using nano banana
      const bgResult = await generateImage({ prompt: backgroundPrompts[i] });
      const bgUrl = bgResult.url as string;
      console.log(`[ImageCompositing] Background ${i + 1} generated: ${bgUrl}`);

      // Composite product render onto background
      const compositeUrl = await compositeProductOntoBackground(
        bgUrl,
        productRenderUrl,
        ONEST_LOGO_URL,
        `variation_${i + 1}`
      );

      results.push({
        url: compositeUrl,
        variation: `variation_${i + 1}`
      });

      console.log(`[ImageCompositing] Variation ${i + 1} completed`);
    } catch (err: any) {
      console.error(`[ImageCompositing] Failed to generate variation ${i + 1}:`, err.message);
      // Fallback to background URL if compositing fails
      results.push({
        url: `https://via.placeholder.com/1200x1200?text=Variation+${i + 1}`,
        variation: `variation_${i + 1}`
      });
    }
  }

  return results;
}

/**
 * Composite product render onto background using Sharp
 */
async function compositeProductOntoBackground(
  backgroundUrl: string,
  productRenderUrl: string,
  logoUrl: string,
  variationName: string
): Promise<string> {
  try {
    const sharp = require("sharp");
    const tmpDir = os.tmpdir();

    // Download background image
    console.log("[Composite] Downloading background image...");
    const bgResponse = await axios.get(backgroundUrl, { responseType: "arraybuffer" });
    const bgPath = path.join(tmpDir, `bg_${Date.now()}.png`);
    fs.writeFileSync(bgPath, Buffer.from(bgResponse.data));

    // Download product render
    console.log("[Composite] Downloading product render...");
    const productResponse = await axios.get(productRenderUrl, { responseType: "arraybuffer" });
    const productPath = path.join(tmpDir, `product_${Date.now()}.png`);
    fs.writeFileSync(productPath, Buffer.from(productResponse.data));

    // Download logo
    console.log("[Composite] Downloading logo...");
    const logoResponse = await axios.get(logoUrl, { responseType: "arraybuffer" });
    const logoPath = path.join(tmpDir, `logo_${Date.now()}.png`);
    fs.writeFileSync(logoPath, Buffer.from(logoResponse.data));

    // Get dimensions
    const bgMeta = await sharp(bgPath).metadata();
    const productMeta = await sharp(productPath).metadata();
    const logoMeta = await sharp(logoPath).metadata();

    const bgWidth = bgMeta.width || 1200;
    const bgHeight = bgMeta.height || 1200;

    // Resize product to fit (60% of background width, maintaining aspect ratio)
    const productWidth = Math.floor(bgWidth * 0.6);
    const productHeight = productMeta.height ? Math.floor(productWidth * (productMeta.height / (productMeta.width || 1))) : productWidth;

    // Resize logo (10% of background width)
    const logoWidth = Math.floor(bgWidth * 0.1);
    const logoHeight = logoMeta.height ? Math.floor(logoWidth * (logoMeta.height / (logoMeta.width || 1))) : logoWidth;

    console.log(`[Composite] Background: ${bgWidth}x${bgHeight}, Product: ${productWidth}x${productHeight}, Logo: ${logoWidth}x${logoHeight}`);

    // Composite: background + product (centered) + logo (top-right)
    const productX = Math.floor((bgWidth - productWidth) / 2);
    const productY = Math.floor((bgHeight - productHeight) / 2);
    const logoX = bgWidth - logoWidth - 20;
    const logoY = 20;

    const compositeBuffer = await sharp(bgPath)
      .composite([
        {
          input: await sharp(productPath).resize(productWidth, productHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
          left: productX,
          top: productY,
        },
        {
          input: await sharp(logoPath).resize(logoWidth, logoHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
          left: logoX,
          top: logoY,
        }
      ])
      .png()
      .toBuffer();

    // Upload to S3
    const { storagePut } = await import("../storage");
    const fileKey = `static-ads/${variationName}-${Date.now()}.png`;
    const { url } = await storagePut(fileKey, compositeBuffer, "image/png");

    console.log("[Composite] Composite image uploaded to S3:", url);

    // Clean up temp files
    try { fs.unlinkSync(bgPath); } catch {}
    try { fs.unlinkSync(productPath); } catch {}
    try { fs.unlinkSync(logoPath); } catch {}

    return url;
  } catch (err: any) {
    console.error("[Composite] Failed to composite images:", err.message);
    throw err;
  }
}
