import axios from "axios";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { LOGOS } from "../config/brandAssets";
import * as db from "../db";

interface CompositeResult {
  url: string;
  variation: string;
}

/**
 * User selections for each image variation.
 * Each image gets its own headline, optional subheadline, and background.
 * Benefits are shared across all 3 images.
 */
export interface ImageSelections {
  images: Array<{
    headline: string;
    subheadline: string | null; // null means no subheadline
    background: { title: string; description: string; prompt: string };
  }>;
  benefits: string; // shared across all 3 images
  productRenderUrl?: string; // user-selected product render URL
}

// ============================================================
// PUPPETEER BROWSER POOL — reuse browser instance for performance
// ============================================================
let _browserInstance: any = null;

async function getBrowser() {
  if (_browserInstance && _browserInstance.isConnected()) {
    return _browserInstance;
  }
  const puppeteer = await import("puppeteer");
  _browserInstance = await puppeteer.default.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });
  console.log("[Puppeteer] Browser launched");
  return _browserInstance;
}

/**
 * Render an HTML ad creative template to a PNG buffer using Puppeteer.
 * This gives pixel-perfect text rendering with web fonts (Google Fonts).
 */
async function renderHtmlToPng(
  html: string,
  width: number,
  height: number
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    // Wait a bit for fonts to load
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 500));

    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
    });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

/**
 * Build the HTML template for an ad creative.
 * Uses Google Fonts (Montserrat) for bold, readable text.
 * Layout: ONEST logo top-left, headline near top, subheadline below,
 * product render centered, benefit callout, red CTA button at bottom.
 */
function buildAdHtml(
  backgroundUrl: string,
  productRenderUrl: string,
  logoUrl: string,
  copy: {
    headline: string;
    subheadline: string | null;
    benefits: string;
    cta: string;
    product: string;
  },
  width: number,
  height: number
): string {
  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Scale font sizes relative to canvas
  const headlineFontSize = Math.floor(width * 0.052);
  const subheadlineFontSize = Math.floor(width * 0.026);
  const benefitFontSize = Math.floor(width * 0.022);
  const ctaFontSize = Math.floor(width * 0.02);
  const logoHeight = Math.floor(height * 0.04);
  const productWidth = Math.floor(width * 0.42);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      font-family: 'Montserrat', 'Arial Black', 'Impact', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .ad-container {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      background: #01040A;
    }

    .background-image {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
    }

    /* Dark gradient overlay for text readability */
    .gradient-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: linear-gradient(
        to bottom,
        rgba(1, 4, 10, 0.88) 0%,
        rgba(1, 4, 10, 0.35) 30%,
        rgba(1, 4, 10, 0.12) 50%,
        rgba(1, 4, 10, 0.35) 70%,
        rgba(1, 4, 10, 0.92) 100%
      );
    }

    .content-layer {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: ${Math.floor(height * 0.03)}px ${Math.floor(width * 0.06)}px;
    }

    /* ONEST Logo — top left */
    .logo-container {
      position: absolute;
      top: ${Math.floor(height * 0.03)}px;
      left: ${Math.floor(width * 0.04)}px;
    }

    .logo-container img {
      height: ${logoHeight}px;
      width: auto;
      filter: brightness(1.1);
    }

    /* Headline — large, bold, white, centered near top */
    .headline {
      margin-top: ${Math.floor(height * 0.09)}px;
      font-size: ${headlineFontSize}px;
      font-weight: 900;
      color: #FFFFFF;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: ${Math.floor(headlineFontSize * 0.06)}px;
      line-height: 1.15;
      text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.4);
      max-width: 90%;
    }

    /* Red accent bar under headline */
    .accent-bar {
      width: ${Math.floor(width * 0.12)}px;
      height: 4px;
      background: #FF3838;
      border-radius: 2px;
      margin-top: ${Math.floor(height * 0.012)}px;
    }

    /* Subheadline — lighter, smaller */
    .subheadline {
      margin-top: ${Math.floor(height * 0.01)}px;
      font-size: ${subheadlineFontSize}px;
      font-weight: 600;
      color: #E0E0E0;
      text-align: center;
      letter-spacing: ${Math.floor(subheadlineFontSize * 0.04)}px;
      text-shadow: 0 1px 8px rgba(0,0,0,0.6);
      max-width: 85%;
    }

    /* Product render — centered */
    .product-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }

    .product-container img {
      max-width: ${productWidth}px;
      max-height: ${Math.floor(height * 0.40)}px;
      object-fit: contain;
      filter: drop-shadow(0 8px 30px rgba(255, 56, 56, 0.25)) drop-shadow(0 4px 15px rgba(0,0,0,0.5));
    }

    /* Benefit callout — red text */
    .benefit-callout {
      font-size: ${benefitFontSize}px;
      font-weight: 800;
      color: #FF3838;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: ${Math.floor(benefitFontSize * 0.08)}px;
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
      margin-bottom: ${Math.floor(height * 0.015)}px;
    }

    /* CTA Button — red pill shape */
    .cta-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #FF3838;
      color: #FFFFFF;
      font-size: ${ctaFontSize}px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: ${Math.floor(ctaFontSize * 0.15)}px;
      padding: ${Math.floor(height * 0.015)}px ${Math.floor(width * 0.08)}px;
      border-radius: ${Math.floor(height * 0.03)}px;
      box-shadow: 0 4px 20px rgba(255, 56, 56, 0.4), 0 2px 8px rgba(0,0,0,0.3);
      margin-bottom: ${Math.floor(height * 0.035)}px;
    }
  </style>
</head>
<body>
  <div class="ad-container">
    <img class="background-image" src="${escHtml(backgroundUrl)}" alt="background" crossorigin="anonymous" />
    <div class="gradient-overlay"></div>
    <div class="content-layer">
      <div class="logo-container">
        <img src="${escHtml(logoUrl)}" alt="ONEST" crossorigin="anonymous" />
      </div>
      <div class="headline">${escHtml(copy.headline)}</div>
      <div class="accent-bar"></div>
      ${copy.subheadline ? `<div class="subheadline">${escHtml(copy.subheadline)}</div>` : ""}
      <div class="product-container">
        <img src="${escHtml(productRenderUrl)}" alt="${escHtml(copy.product)}" crossorigin="anonymous" />
      </div>
      <div class="benefit-callout">${escHtml(copy.benefits)}</div>
      <div class="cta-button">${escHtml(copy.cta)}</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Composite a full ad creative using Puppeteer HTML/CSS rendering.
 * Downloads background + product render + logo, builds HTML template,
 * screenshots it to PNG, uploads to S3.
 */
async function compositeAdCreative(
  backgroundUrl: string,
  productRenderUrl: string,
  logoUrl: string,
  copy: {
    headline: string;
    subheadline: string | null;
    benefits: string;
    cta: string;
    product: string;
  },
  variationName: string
): Promise<string> {
  const W = 1200;
  const H = 1200;

  console.log(`[Composite:${variationName}] Building HTML ad creative...`);
  console.log(`[Composite:${variationName}] Headline: "${copy.headline}"`);
  console.log(`[Composite:${variationName}] Background: ${backgroundUrl.substring(0, 80)}...`);

  try {
    // Build the HTML template
    const html = buildAdHtml(backgroundUrl, productRenderUrl, logoUrl, copy, W, H);

    // Render to PNG via Puppeteer
    console.log(`[Composite:${variationName}] Rendering HTML to PNG via Puppeteer...`);
    const pngBuffer = await renderHtmlToPng(html, W, H);
    console.log(`[Composite:${variationName}] PNG rendered: ${pngBuffer.length} bytes`);

    // Upload to S3
    console.log(`[Composite:${variationName}] Uploading to S3...`);
    const { storagePut } = await import("../storage");
    const fileKey = `static-ads/${variationName}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { url } = await storagePut(fileKey, pngBuffer, "image/png");

    console.log(`[Composite:${variationName}] SUCCESS! Uploaded to: ${url}`);
    return url;
  } catch (err: any) {
    console.error(`[Composite:${variationName}] FATAL ERROR: ${err.message}`);
    console.error(`[Composite:${variationName}] Stack: ${err.stack}`);
    throw err;
  }
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Generate 3 ad creative variations by:
 * 1. Pulling a product render from the Product Render Manager (DB/S3)
 * 2. Downloading the competitor reference image for style transfer on Image 1
 * 3. Generating BACKGROUND-ONLY images via nano banana (no text, no product)
 * 4. Building HTML ad template with background + product + text
 * 5. Rendering HTML to PNG via Puppeteer (pixel-perfect text)
 * 6. Uploading final composites to S3
 */
export async function generateStaticAdVariations(
  creativeBrief: string,
  inspireImageUrl: string,
  product: string,
  brandName: string,
  selections?: ImageSelections,
  teamFeedback?: string
): Promise<CompositeResult[]> {
  console.log("[ImageCompositing] Starting ad creative generation with 3 variations");
  console.log("[ImageCompositing] Reference image:", inspireImageUrl?.substring(0, 100));

  // Pull product render: use explicitly selected URL first, then DB, then fallback
  let productRenderUrl: string;
  if (selections?.productRenderUrl) {
    productRenderUrl = selections.productRenderUrl;
    console.log(`[ImageCompositing] Using user-selected product render: ${productRenderUrl.substring(0, 80)}`);
  } else {
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
  }

  const logoUrl = LOGOS.wordmark_white;

  // Download the competitor reference image for style transfer (Image 1 only)
  let referenceImageData: { url: string; mimeType: string } | null = null;
  if (inspireImageUrl && inspireImageUrl.startsWith("http")) {
    try {
      console.log("[ImageCompositing] Downloading competitor reference image for style transfer...");
      const refRes = await axios.get(inspireImageUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      });
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

  // Build per-image config from selections or fallback
  const imageConfigs = buildImageConfigs(selections, creativeBrief, product, teamFeedback);

  // Generate backgrounds and composite
  const { generateImage } = await import("../_core/imageGeneration");
  const results: CompositeResult[] = [];

  for (let i = 0; i < 3; i++) {
    const config = imageConfigs[i];
    const variationLabel = i === 0 ? "Control (Closest to Inspo)" : `Variation ${i + 1}`;

    try {
      console.log(`[ImageCompositing] === Image ${i + 1}/3: ${variationLabel} ===`);
      console.log(`[ImageCompositing] Headline: "${config.headline}"`);
      console.log(`[ImageCompositing] Subheadline: "${config.subheadline || "NONE"}"`);
      console.log(`[ImageCompositing] Benefits: "${config.benefits}"`);

      // Step 1: Generate BACKGROUND ONLY via nano banana (no text, no product)
      const bgPrompt = buildBackgroundPrompt(config.backgroundPrompt, product);
      const genOptions: any = { prompt: bgPrompt };

      // Image 1 uses competitor reference for closest style match
      if (referenceImageData && i === 0) {
        genOptions.originalImages = [{
          url: referenceImageData.url,
          mimeType: referenceImageData.mimeType,
        }];
        console.log(`[ImageCompositing] Image 1: Using reference image for style transfer`);
      }

      console.log(`[ImageCompositing] Generating background ${i + 1}...`);
      const bgResult = await generateImage(genOptions);
      const bgUrl = bgResult.url as string;
      console.log(`[ImageCompositing] Background ${i + 1} generated: ${bgUrl}`);

      // Step 2: Composite via Puppeteer HTML/CSS rendering
      const compositeUrl = await compositeAdCreative(
        bgUrl,
        productRenderUrl,
        logoUrl,
        {
          headline: config.headline,
          subheadline: config.subheadline,
          benefits: config.benefits,
          cta: "SHOP NOW",
          product,
        },
        `${i === 0 ? "control" : `variation_${i + 1}`}`
      );

      results.push({
        url: compositeUrl,
        variation: variationLabel,
      });

      console.log(`[ImageCompositing] Image ${i + 1} completed: ${variationLabel}`);
    } catch (err: any) {
      console.error(`[ImageCompositing] Failed to generate image ${i + 1}:`, err.message);
      // Fallback: try background-only without compositing
      try {
        const bgPrompt = buildBackgroundPrompt(config.backgroundPrompt, product);
        const bgResult = await generateImage({ prompt: bgPrompt });
        results.push({ url: bgResult.url as string, variation: `${variationLabel} (background only - compositing failed)` });
      } catch {
        results.push({
          url: `https://via.placeholder.com/1200x1200/01040A/FF3838?text=Image+${i + 1}+Failed`,
          variation: `${variationLabel} (failed)`,
        });
      }
    }
  }

  return results;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build per-image configs from user selections or fallback to brief extraction
 */
function buildImageConfigs(
  selections: ImageSelections | undefined,
  brief: string,
  product: string,
  teamFeedback?: string
): Array<{ headline: string; subheadline: string | null; benefits: string; backgroundPrompt: string }> {
  if (selections && selections.images && selections.images.length >= 3) {
    return selections.images.map((img) => ({
      headline: img.headline,
      subheadline: img.subheadline,
      benefits: selections.benefits,
      backgroundPrompt: img.background.prompt + (teamFeedback ? `\n\nADJUSTMENTS: ${teamFeedback}` : ""),
    }));
  }

  // Fallback: extract from brief
  const fallbackPrompts = extractVariationPrompts(brief, product, teamFeedback);
  return [
    {
      headline: `FUEL YOUR ${product.toUpperCase()}`,
      subheadline: "Premium Australian Formulation",
      benefits: "Science-Backed Results",
      backgroundPrompt: fallbackPrompts[0],
    },
    {
      headline: `UNLOCK ${product.toUpperCase()} POWER`,
      subheadline: "Trusted by Athletes",
      benefits: "Science-Backed Results",
      backgroundPrompt: fallbackPrompts[1],
    },
    {
      headline: `${product.toUpperCase()} REDEFINED`,
      subheadline: "No Compromises",
      benefits: "Science-Backed Results",
      backgroundPrompt: fallbackPrompts[2],
    },
  ];
}

/**
 * Build a background-only prompt that explicitly tells nano banana NOT to include text or products
 */
function buildBackgroundPrompt(basePrompt: string, product: string): string {
  return `${basePrompt}

CRITICAL INSTRUCTIONS:
- Generate ONLY the background scene/environment. 
- DO NOT include any text, words, letters, numbers, or typography.
- DO NOT include any product bottles, containers, or packaging.
- DO NOT include any logos or brand marks.
- The image should be a pure background/scene that a product can be composited onto later.
- Leave clear space in the center-bottom area for product placement.
- Square format, 1200x1200 pixels.
- Style: Premium health supplement advertisement background.
- Brand colors: deep black (#01040A), red accents (#FF3838), blue accents (#0347ED).`;
}

/**
 * Extract variation prompts from the creative brief (fallback when no selections)
 */
function extractVariationPrompts(brief: string, product: string, teamFeedback?: string): string[] {
  const prompts: string[] = [];
  const feedbackClause = teamFeedback ? `\nADJUSTMENTS: ${teamFeedback}` : "";

  // Try to extract prompts from brief
  const patterns = [
    /\*\*VARIATION\s*1\s*PROMPT\*\*[^:]*:\s*([\s\S]*?)(?=\*\*VARIATION\s*2|\n##|\n\*\*V)/i,
    /\*\*VARIATION\s*2\s*PROMPT\*\*[^:]*:\s*([\s\S]*?)(?=\*\*VARIATION\s*3|\n##|\n\*\*V)/i,
    /\*\*VARIATION\s*3\s*PROMPT\*\*[^:]*:\s*([\s\S]*?)(?=\n##|$)/i,
  ];

  for (const pattern of patterns) {
    const match = brief.match(pattern);
    if (match && match[1]) {
      let prompt = match[1].trim().replace(/^\s*[-*]\s*/gm, "").replace(/\n##[\s\S]*$/, "").trim();
      if (prompt.length > 50) prompts.push(prompt + feedbackClause);
    }
  }

  // Fallback generic prompts
  while (prompts.length < 3) {
    const idx = prompts.length + 1;
    const fallback = idx === 1
      ? `Dark dramatic background for premium health supplement ad. Deep charcoal black base (#01040A) with warm amber and electric crimson (#FF3838) accent lighting. Dramatic rim lighting from the right. Subtle smoke and particle effects. Energy and power aesthetic. Premium gym/fitness atmosphere.${feedbackClause}`
      : idx === 2
      ? `Bold energetic background for supplement ad. Deep navy to black gradient. Electric blue (#0347ED) accent lighting from below. Geometric angular shapes suggesting speed and power. Cool-toned with warm crimson (#FF3838) highlight accents.${feedbackClause}`
      : `Minimalist premium dark background for supplement ad. Sophisticated matte black texture (#01040A). Soft warm spotlight from above creating subtle gradient. Clean and refined. Premium luxury aesthetic.${feedbackClause}`;
    prompts.push(fallback);
  }

  return prompts.slice(0, 3);
}
