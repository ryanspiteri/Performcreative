import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PRODUCT_RENDERS, LOGOS } from "../config/brandAssets";

interface CompositeResult {
  url: string;
  variation: string;
}

/**
 * Generate 3 variations of static ads by:
 * 1. Generating 3 different background variations using nano banana image generation
 * 2. Compositing the actual product render from S3 CDN on top of each background using Sharp
 * 3. Adding ONEST branding and logo
 */
export async function generateStaticAdVariations(
  _productRenderPath: string,
  inspireImageUrl: string,
  product: string,
  brandName: string,
  teamFeedback?: string
): Promise<CompositeResult[]> {
  console.log("[ImageCompositing] Starting static ad generation with 3 variations");

  // Select a random product render from the real S3 CDN URLs
  const renderKeys = Object.keys(PRODUCT_RENDERS);
  const randomRenderKey = renderKeys[Math.floor(Math.random() * renderKeys.length)];
  const productRenderUrl = PRODUCT_RENDERS[randomRenderKey as keyof typeof PRODUCT_RENDERS];
  const logoUrl = LOGOS.wordmark_white;
  console.log("[ImageCompositing] Using product render:", randomRenderKey);

  // Generate 3 background variations using nano banana
  const { generateImage } = await import("../_core/imageGeneration");
  const results: CompositeResult[] = [];

  const feedbackClause = teamFeedback
    ? `\n\nIMPORTANT ADJUSTMENTS BASED ON TEAM FEEDBACK:\n${teamFeedback}`
    : "";

  const backgroundPrompts = [
    `Premium health supplement advertisement background. Dark modern aesthetic with deep black base. Geometric shapes, subtle gradients, and energy effects in orange and electric blue. Similar style to the competitor reference but unique. Include ample space in center for a product bottle. Professional fitness/health vibe. No text, no product, just background. 1200x1200px.${feedbackClause}`,

    `Dynamic health supplement ad background. Dark background with vibrant energy effects, lightning patterns in warm orange and cool blue tones. Modern, high-energy aesthetic. Product-centric composition with clear breathing room in center. Professional supplement brand look. No text, no product, just background. 1200x1200px.${feedbackClause}`,

    `Minimalist premium supplement ad background. Clean dark aesthetic with subtle textures, soft lighting, and refined composition. Sophisticated health brand feel. Ample space in center for product placement. Accent colors: warm orange and cool blue. Modern, premium, trustworthy vibe. No text, no product, just background. 1200x1200px.${feedbackClause}`,
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
        logoUrl,
        `variation_${i + 1}`
      );

      results.push({
        url: compositeUrl,
        variation: `variation_${i + 1}`,
      });

      console.log(`[ImageCompositing] Variation ${i + 1} completed`);
    } catch (err: any) {
      console.error(`[ImageCompositing] Failed to generate variation ${i + 1}:`, err.message);
      // If compositing fails, try to at least return the background
      try {
        const bgResult = await generateImage({ prompt: backgroundPrompts[i] });
        results.push({ url: bgResult.url as string, variation: `variation_${i + 1}` });
      } catch {
        results.push({
          url: `https://via.placeholder.com/1200x1200?text=Variation+${i + 1}+Failed`,
          variation: `variation_${i + 1}`,
        });
      }
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
  const sharp = (await import("sharp")).default;
  const tmpDir = os.tmpdir();

  // Download background image
  console.log("[Composite] Downloading background image...");
  const bgResponse = await axios.get(backgroundUrl, { responseType: "arraybuffer", timeout: 30000 });
  const bgPath = path.join(tmpDir, `bg_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  fs.writeFileSync(bgPath, Buffer.from(bgResponse.data));

  // Download product render from S3 CDN
  console.log("[Composite] Downloading product render from CDN...");
  const productResponse = await axios.get(productRenderUrl, { responseType: "arraybuffer", timeout: 30000 });
  const productPath = path.join(tmpDir, `product_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  fs.writeFileSync(productPath, Buffer.from(productResponse.data));

  // Download logo from S3 CDN
  console.log("[Composite] Downloading logo from CDN...");
  const logoResponse = await axios.get(logoUrl, { responseType: "arraybuffer", timeout: 30000 });
  const logoPath = path.join(tmpDir, `logo_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  fs.writeFileSync(logoPath, Buffer.from(logoResponse.data));

  try {
    // Get dimensions
    const bgMeta = await sharp(bgPath).metadata();
    const productMeta = await sharp(productPath).metadata();
    const logoMeta = await sharp(logoPath).metadata();

    const bgWidth = bgMeta.width || 1200;
    const bgHeight = bgMeta.height || 1200;

    // Resize product to fit (55% of background width, maintaining aspect ratio)
    const productWidth = Math.floor(bgWidth * 0.55);
    const productHeight = productMeta.height
      ? Math.floor(productWidth * (productMeta.height / (productMeta.width || 1)))
      : productWidth;

    // Resize logo (12% of background width)
    const logoWidth = Math.floor(bgWidth * 0.12);
    const logoHeight = logoMeta.height
      ? Math.floor(logoWidth * (logoMeta.height / (logoMeta.width || 1)))
      : Math.floor(logoWidth * 0.3);

    console.log(`[Composite] BG: ${bgWidth}x${bgHeight}, Product: ${productWidth}x${productHeight}, Logo: ${logoWidth}x${logoHeight}`);

    // Position: product centered, logo top-right
    const productX = Math.floor((bgWidth - productWidth) / 2);
    const productY = Math.floor((bgHeight - productHeight) / 2);
    const logoX = bgWidth - logoWidth - 30;
    const logoY = 30;

    const compositeBuffer = await sharp(bgPath)
      .composite([
        {
          input: await sharp(productPath)
            .resize(productWidth, productHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer(),
          left: productX,
          top: productY,
        },
        {
          input: await sharp(logoPath)
            .resize(logoWidth, logoHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer(),
          left: logoX,
          top: logoY,
        },
      ])
      .png()
      .toBuffer();

    // Upload to S3
    const { storagePut } = await import("../storage");
    const fileKey = `static-ads/${variationName}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { url } = await storagePut(fileKey, compositeBuffer, "image/png");

    console.log("[Composite] Composite image uploaded to S3:", url);
    return url;
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(bgPath); } catch {}
    try { fs.unlinkSync(productPath); } catch {}
    try { fs.unlinkSync(logoPath); } catch {}
  }
}
