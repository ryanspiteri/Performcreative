import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { LOGOS } from "../config/brandAssets";
import * as db from "../db";

interface CompositeResult {
  url: string;
  variation: string;
}

/**
 * Generate 3 variations of static ads by:
 * 1. Pulling a product render from the Product Render Manager (DB/S3)
 * 2. Downloading the competitor reference image for style transfer
 * 3. Extracting variation prompts from the approved creative brief
 * 4. Generating 3 background variations using nano banana with the reference image
 * 5. Compositing the actual product render on top of each background using Sharp
 * 6. Adding ONEST branding and logo
 */
export async function generateStaticAdVariations(
  creativeBrief: string,
  inspireImageUrl: string,
  product: string,
  brandName: string,
  teamFeedback?: string
): Promise<CompositeResult[]> {
  console.log("[ImageCompositing] Starting static ad generation with 3 variations");
  console.log("[ImageCompositing] Reference image:", inspireImageUrl?.substring(0, 100));

  // Pull product render from DB (Product Render Manager)
  let productRenderUrl: string;
  try {
    const renders = await db.getProductRendersByProduct(product);
    if (renders.length > 0) {
      const chosen = renders[Math.floor(Math.random() * renders.length)];
      productRenderUrl = chosen.url;
      console.log(`[ImageCompositing] Using uploaded render for ${product}: ${chosen.fileName}`);
    } else {
      const allRenders = await db.listProductRenders();
      if (allRenders.length > 0) {
        const chosen = allRenders[Math.floor(Math.random() * allRenders.length)];
        productRenderUrl = chosen.url;
        console.log(`[ImageCompositing] No renders for ${product}, using fallback: ${chosen.fileName}`);
      } else {
        productRenderUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png";
        console.log("[ImageCompositing] No renders uploaded at all, using hardcoded fallback");
      }
    }
  } catch (err: any) {
    console.warn("[ImageCompositing] Failed to fetch renders from DB:", err.message);
    productRenderUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png";
  }

  const logoUrl = LOGOS.wordmark_white;

  // Download the competitor reference image for style transfer
  let referenceImageData: { url: string; mimeType: string } | null = null;
  if (inspireImageUrl && inspireImageUrl.startsWith("http")) {
    try {
      console.log("[ImageCompositing] Downloading competitor reference image for style transfer...");
      const refRes = await axios.get(inspireImageUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      });

      // Upload to S3 so nano banana can access it via URL
      const { storagePut } = await import("../storage");
      const refKey = `reference-images/ref-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { url: refUrl } = await storagePut(refKey, Buffer.from(refRes.data), "image/jpeg");

      let mimeType = refRes.headers["content-type"] || "image/jpeg";
      if (mimeType.includes(";")) mimeType = mimeType.split(";")[0].trim();
      if (!mimeType.startsWith("image/")) mimeType = "image/jpeg";

      referenceImageData = { url: refUrl, mimeType };
      console.log("[ImageCompositing] Reference image uploaded to S3:", refUrl);
    } catch (err: any) {
      console.warn("[ImageCompositing] Failed to download reference image:", err.message);
    }
  }

  // Extract the 3 variation prompts from the creative brief
  const variationPrompts = extractVariationPrompts(creativeBrief, product, teamFeedback);
  console.log("[ImageCompositing] Extracted variation prompts:", variationPrompts.map(p => p.substring(0, 80) + "..."));

  // Generate 3 background variations using nano banana
  const { generateImage } = await import("../_core/imageGeneration");
  const results: CompositeResult[] = [];

  for (let i = 0; i < 3; i++) {
    try {
      console.log(`[ImageCompositing] Generating variation ${i + 1}/3...`);

      // Build the generation options with reference image for style transfer
      const genOptions: any = {
        prompt: variationPrompts[i],
      };

      // Pass the competitor ad as a reference image for style transfer (image-to-image)
      // This is the KEY fix — nano banana uses the reference to match visual style
      if (referenceImageData && i === 0) {
        // Variation 1 uses the reference image directly for closest style match
        genOptions.originalImages = [{
          url: referenceImageData.url,
          mimeType: referenceImageData.mimeType,
        }];
        console.log(`[ImageCompositing] Variation ${i + 1}: Using reference image for style transfer`);
      }

      const bgResult = await generateImage(genOptions);
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
        const bgResult = await generateImage({ prompt: variationPrompts[i] });
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
 * Extract the 3 variation prompts from the creative brief.
 * The brief contains a "## 7. THREE IMAGE GENERATION PROMPTS" section
 * with VARIATION 1 PROMPT, VARIATION 2 PROMPT, VARIATION 3 PROMPT.
 * Falls back to generic prompts if extraction fails.
 */
function extractVariationPrompts(brief: string, product: string, teamFeedback?: string): string[] {
  const prompts: string[] = [];

  const feedbackClause = teamFeedback
    ? `\n\nCRITICAL ADJUSTMENTS BASED ON TEAM FEEDBACK: ${teamFeedback}`
    : "";

  // Try to extract prompts from the brief using various patterns
  const patterns = [
    /\*\*VARIATION\s*1\s*PROMPT\*\*[^:]*:\s*([\s\S]*?)(?=\*\*VARIATION\s*2|\n##|\n\*\*V)/i,
    /\*\*VARIATION\s*2\s*PROMPT\*\*[^:]*:\s*([\s\S]*?)(?=\*\*VARIATION\s*3|\n##|\n\*\*V)/i,
    /\*\*VARIATION\s*3\s*PROMPT\*\*[^:]*:\s*([\s\S]*?)(?=\n##|$)/i,
  ];

  for (const pattern of patterns) {
    const match = brief.match(pattern);
    if (match && match[1]) {
      let prompt = match[1].trim();
      // Clean up markdown formatting
      prompt = prompt.replace(/^\s*[-*]\s*/gm, "").trim();
      // Remove any trailing section headers
      prompt = prompt.replace(/\n##[\s\S]*$/, "").trim();
      if (prompt.length > 50) {
        prompts.push(prompt + feedbackClause);
      }
    }
  }

  // If we couldn't extract all 3, try a simpler split approach
  if (prompts.length < 3) {
    const section7Match = brief.match(/##\s*7[\s\S]*?(?=##\s*\d|$)/i);
    if (section7Match) {
      const section = section7Match[0];
      const varSplits = section.split(/\*\*VARIATION\s*[0-9]/i);
      for (let i = 1; i < varSplits.length && prompts.length < 3; i++) {
        let text = varSplits[i].replace(/^[^:]*:\s*/, "").trim();
        text = text.replace(/^\s*[-*]\s*/gm, "").trim();
        if (text.length > 50) {
          prompts.push(text + feedbackClause);
        }
      }
    }
  }

  // Fallback: if we still don't have 3 prompts, generate from the brief's visual direction
  while (prompts.length < 3) {
    const idx = prompts.length + 1;
    const visualSection = brief.match(/##\s*4[\s\S]*?(?=##\s*5|$)/i)?.[0] || "";
    const fallbackPrompt = `Premium health supplement advertisement background for ONEST Health ${product}. ${
      idx === 1
        ? "Dark dramatic background matching the competitor reference style. Deep charcoal black base with warm amber and electric crimson accent lighting. Dramatic rim lighting from the right side. Subtle smoke or particle effects. Energy and power aesthetic."
        : idx === 2
        ? "Bold energetic background with deep navy to black gradient. Electric blue (#0347ED) accent lighting from below. Geometric angular shapes suggesting speed and power. Cool-toned with warm crimson (#FF3838) highlight accents."
        : "Minimalist premium dark background with sophisticated matte black texture. Soft warm spotlight from above creating a subtle gradient. Clean and refined with minimal effects. Premium luxury supplement aesthetic."
    } ${visualSection ? `Visual reference: ${visualSection.substring(0, 200)}` : ""} Leave ample space in the center for product placement. Square format 1200x1200px. No text, no product, no logo, just background.${feedbackClause}`;
    prompts.push(fallbackPrompt);
  }

  return prompts.slice(0, 3);
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
