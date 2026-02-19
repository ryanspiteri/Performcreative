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

/**
 * Generate 3 ad creative variations by:
 * 1. Pulling a product render from the Product Render Manager (DB/S3)
 * 2. Downloading the competitor reference image for style transfer on Image 1
 * 3. Generating BACKGROUND-ONLY images via nano banana (no text, no product)
 * 4. Compositing the real product render onto each background using Sharp
 * 5. Overlaying crisp TEXT via SVG: headline, subheadline, benefits, CTA, logo
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
      console.log(`[ImageCompositing] Subheadline: "${config.subheadline || 'NONE'}"`);
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

      // Step 2: Composite product render + text overlays onto background
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
    return selections.images.map((img, i) => ({
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

/**
 * Composite a full ad creative: background + product render + text overlays
 * Uses Sharp for image compositing and SVG for crisp text rendering.
 * Each step has detailed error logging to diagnose production failures.
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
  const sharp = (await import("sharp")).default;
  const tmpDir = os.tmpdir();
  const tmpFiles: string[] = [];

  try {
    // ---- STEP 1: Download background ----
    console.log(`[Composite:${variationName}] Step 1: Downloading background from ${backgroundUrl.substring(0, 80)}...`);
    let bgBuffer: Buffer;
    try {
      const bgResponse = await axios.get(backgroundUrl, { responseType: "arraybuffer", timeout: 60000, headers: { "User-Agent": "Mozilla/5.0" } });
      bgBuffer = Buffer.from(bgResponse.data);
      console.log(`[Composite:${variationName}] Background downloaded: ${bgBuffer.length} bytes`);
    } catch (err: any) {
      throw new Error(`Failed to download background: ${err.message}`);
    }

    // ---- STEP 2: Download product render ----
    console.log(`[Composite:${variationName}] Step 2: Downloading product render from ${productRenderUrl.substring(0, 80)}...`);
    let productBuffer: Buffer;
    try {
      const productResponse = await axios.get(productRenderUrl, { responseType: "arraybuffer", timeout: 60000, headers: { "User-Agent": "Mozilla/5.0" } });
      productBuffer = Buffer.from(productResponse.data);
      console.log(`[Composite:${variationName}] Product render downloaded: ${productBuffer.length} bytes`);
    } catch (err: any) {
      throw new Error(`Failed to download product render (${productRenderUrl}): ${err.message}`);
    }

    // ---- STEP 3: Download logo ----
    console.log(`[Composite:${variationName}] Step 3: Downloading logo...`);
    let logoBuffer: Buffer;
    try {
      const logoResponse = await axios.get(logoUrl, { responseType: "arraybuffer", timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } });
      logoBuffer = Buffer.from(logoResponse.data);
      console.log(`[Composite:${variationName}] Logo downloaded: ${logoBuffer.length} bytes`);
    } catch (err: any) {
      console.warn(`[Composite:${variationName}] Logo download failed (non-fatal): ${err.message}`);
      logoBuffer = Buffer.alloc(0); // Will skip logo layer
    }

    // ---- STEP 4: Get metadata ----
    console.log(`[Composite:${variationName}] Step 4: Reading image metadata...`);
    const bgMeta = await sharp(bgBuffer).metadata();
    const productMeta = await sharp(productBuffer).metadata();
    console.log(`[Composite:${variationName}] BG: ${bgMeta.width}x${bgMeta.height} ${bgMeta.format}, Product: ${productMeta.width}x${productMeta.height} ${productMeta.format}`);

    const W = bgMeta.width || 1200;
    const H = bgMeta.height || 1200;

    // ---- STEP 5: Calculate layout ----
    const productWidth = Math.floor(W * 0.45);
    const productRatio = (productMeta.height || 1) / (productMeta.width || 1);
    const productHeight = Math.floor(productWidth * productRatio);
    const productX = Math.floor((W - productWidth) / 2);
    const productY = Math.floor(H * 0.32);

    console.log(`[Composite:${variationName}] Layout: ${W}x${H}, Product: ${productWidth}x${productHeight} at (${productX},${productY})`);

    // ---- STEP 6: Build composite layers ----
    const compositeInputs: any[] = [];

    // Layer 1: Dark gradient overlay for text readability
    console.log(`[Composite:${variationName}] Step 6a: Building gradient overlay...`);
    const gradientSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#01040A" stop-opacity="0.85"/>
          <stop offset="35%" stop-color="#01040A" stop-opacity="0.3"/>
          <stop offset="55%" stop-color="#01040A" stop-opacity="0.1"/>
          <stop offset="75%" stop-color="#01040A" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#01040A" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#topGrad)"/>
    </svg>`;
    compositeInputs.push({ input: Buffer.from(gradientSvg), top: 0, left: 0 });

    // Layer 2: Product render (resized)
    console.log(`[Composite:${variationName}] Step 6b: Resizing product render to ${productWidth}x${productHeight}...`);
    try {
      const resizedProduct = await sharp(productBuffer)
        .resize(productWidth, productHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      compositeInputs.push({ input: resizedProduct, left: productX, top: productY });
      console.log(`[Composite:${variationName}] Product resized: ${resizedProduct.length} bytes`);
    } catch (err: any) {
      console.error(`[Composite:${variationName}] Product resize failed: ${err.message}`);
      throw new Error(`Product render resize failed: ${err.message}`);
    }

    // Layer 3: Logo (if downloaded successfully)
    if (logoBuffer.length > 0) {
      console.log(`[Composite:${variationName}] Step 6c: Resizing logo...`);
      try {
        const logoMeta = await sharp(logoBuffer).metadata();
        const logoWidth = Math.floor(W * 0.15);
        const logoRatio = (logoMeta.height || 1) / (logoMeta.width || 1);
        const logoHeight = Math.floor(logoWidth * logoRatio);
        const resizedLogo = await sharp(logoBuffer)
          .resize(logoWidth, logoHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        compositeInputs.push({ input: resizedLogo, left: 40, top: 35 });
      } catch (err: any) {
        console.warn(`[Composite:${variationName}] Logo resize failed (non-fatal): ${err.message}`);
      }
    }

    // Layer 4: Text overlay (headline, subheadline, benefits, CTA)
    // Pre-render the SVG to a PNG buffer to avoid Sharp struggling with large embedded-font SVGs
    console.log(`[Composite:${variationName}] Step 6d: Building text overlay...`);
    try {
      const textSvg = buildTextOverlaySvg(W, H, copy, productY, productY + productHeight);
      const svgSizeKB = Math.round(textSvg.length / 1024);
      console.log(`[Composite:${variationName}] Text SVG size: ${textSvg.length} bytes (${svgSizeKB}KB)`);

      // Pre-render SVG to PNG to avoid librsvg issues with large base64 fonts
      const textPng = await sharp(Buffer.from(textSvg))
        .resize(W, H)
        .png()
        .toBuffer();
      console.log(`[Composite:${variationName}] Text overlay rendered to PNG: ${textPng.length} bytes`);
      compositeInputs.push({ input: textPng, top: 0, left: 0 });
    } catch (err: any) {
      console.error(`[Composite:${variationName}] Text overlay failed: ${err.message}`);
      // Fallback: try without embedded fonts
      console.log(`[Composite:${variationName}] Retrying text overlay without embedded fonts...`);
      try {
        const fallbackSvg = buildTextOverlaySvgSystemFonts(W, H, copy, productY, productY + productHeight);
        const fallbackPng = await sharp(Buffer.from(fallbackSvg))
          .resize(W, H)
          .png()
          .toBuffer();
        compositeInputs.push({ input: fallbackPng, top: 0, left: 0 });
        console.log(`[Composite:${variationName}] Fallback text overlay succeeded`);
      } catch (fallbackErr: any) {
        console.error(`[Composite:${variationName}] Fallback text also failed: ${fallbackErr.message}`);
        // Continue without text overlay rather than crashing entirely
        console.warn(`[Composite:${variationName}] Proceeding without text overlay`);
      }
    }

    // ---- STEP 7: Composite all layers ----
    console.log(`[Composite:${variationName}] Step 7: Compositing ${compositeInputs.length} layers...`);
    let compositeBuffer: Buffer;
    try {
      compositeBuffer = await sharp(bgBuffer)
        .resize(W, H, { fit: "cover" })
        .composite(compositeInputs)
        .png()
        .toBuffer();
      console.log(`[Composite:${variationName}] Composite complete: ${compositeBuffer.length} bytes`);
    } catch (err: any) {
      console.error(`[Composite:${variationName}] Sharp composite failed: ${err.message}`);
      console.error(`[Composite:${variationName}] Stack: ${err.stack}`);
      throw new Error(`Sharp composite failed: ${err.message}`);
    }

    // ---- STEP 8: Upload to S3 ----
    console.log(`[Composite:${variationName}] Step 8: Uploading to S3...`);
    const { storagePut } = await import("../storage");
    const fileKey = `static-ads/${variationName}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { url } = await storagePut(fileKey, compositeBuffer, "image/png");

    console.log(`[Composite:${variationName}] SUCCESS! Uploaded to: ${url}`);
    return url;
  } catch (err: any) {
    console.error(`[Composite:${variationName}] FATAL ERROR: ${err.message}`);
    console.error(`[Composite:${variationName}] Stack: ${err.stack}`);
    throw err;
  }
}

// ============================================================
// FONT HANDLING: Try embedded base64 first, fall back to system fonts
// ============================================================
let _fontBoldBase64: string | null = null;
let _fontRegularBase64: string | null = null;
let _fontsAvailable = false;

function tryLoadFonts(): boolean {
  if (_fontsAvailable) return true;
  try {
    // Try multiple possible paths for the font files
    const possibleDirs = [
      path.join(__dirname, "..", "assets", "fonts"),
      path.join(process.cwd(), "server", "assets", "fonts"),
      "/home/ubuntu/onest-creative-pipeline/server/assets/fonts",
    ];
    for (const dir of possibleDirs) {
      const boldPath = path.join(dir, "LiberationSans-Bold.ttf");
      const regPath = path.join(dir, "LiberationSans-Regular.ttf");
      if (fs.existsSync(boldPath) && fs.existsSync(regPath)) {
        _fontBoldBase64 = fs.readFileSync(boldPath).toString("base64");
        _fontRegularBase64 = fs.readFileSync(regPath).toString("base64");
        _fontsAvailable = true;
        console.log(`[Fonts] Loaded embedded fonts from ${dir}`);
        return true;
      }
    }
    console.warn("[Fonts] Font files not found in any expected location, using system font fallback");
    return false;
  } catch (err: any) {
    console.warn(`[Fonts] Failed to load font files: ${err.message}, using system font fallback`);
    return false;
  }
}

/**
 * Build SVG text overlay with headline, subheadline, benefits, and CTA.
 * Tries to embed Liberation Sans as base64 @font-face for reliable rendering.
 * Falls back to system fonts (Liberation Sans, DejaVu Sans, Arial, sans-serif)
 * if the font files aren't available.
 */
function buildTextOverlaySvg(
  width: number,
  height: number,
  copy: {
    headline: string;
    subheadline: string | null;
    benefits: string;
    cta: string;
    product: string;
  },
  productTop: number,
  productBottom: number
): string {
  const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Try to load and embed fonts; if unavailable, use system font fallback
  const hasEmbeddedFonts = tryLoadFonts();

  let fontDefs = "";
  let FONT: string;

  if (hasEmbeddedFonts && _fontBoldBase64 && _fontRegularBase64) {
    fontDefs = `
    <defs>
      <style type="text/css">
        @font-face {
          font-family: 'AdFont';
          font-weight: bold;
          src: url('data:font/truetype;base64,${_fontBoldBase64}') format('truetype');
        }
        @font-face {
          font-family: 'AdFont';
          font-weight: normal;
          src: url('data:font/truetype;base64,${_fontRegularBase64}') format('truetype');
        }
      </style>
    </defs>`;
    FONT = "AdFont, Liberation Sans, Arial, Helvetica, sans-serif";
  } else {
    // System font fallback — these are widely available on Linux servers
    FONT = "Liberation Sans, DejaVu Sans, Noto Sans, Arial, Helvetica, sans-serif";
    fontDefs = ""; // No embedded fonts needed
  }

  // Font sizes relative to canvas width
  const headlineFontSize = Math.floor(width * 0.055); // ~66px at 1200w
  const subheadlineFontSize = Math.floor(width * 0.028); // ~34px
  const benefitFontSize = Math.floor(width * 0.024); // ~29px
  const ctaFontSize = Math.floor(width * 0.022); // ~26px

  // Headline positioning: above the product
  const headlineY = Math.floor(height * 0.14);

  // Word-wrap headline if too long
  const headlineLines = wrapText(copy.headline.toUpperCase(), 22);

  let svgParts: string[] = [];

  // HEADLINE — large, bold, white with red accent underline
  headlineLines.forEach((line, i) => {
    const lineY = headlineY + (i * (headlineFontSize + 8));
    svgParts.push(`
      <text x="${width / 2}" y="${lineY}" text-anchor="middle"
        font-family="${FONT}"
        font-size="${headlineFontSize}" font-weight="bold" fill="white"
        letter-spacing="2">${escXml(line)}</text>
    `);
  });

  // Red accent line under headline
  const accentLineY = headlineY + (headlineLines.length * (headlineFontSize + 8)) + 5;
  const accentWidth = Math.floor(width * 0.15);
  svgParts.push(`
    <rect x="${(width - accentWidth) / 2}" y="${accentLineY}" width="${accentWidth}" height="4" rx="2" fill="#FF3838"/>
  `);

  // SUBHEADLINE — below headline accent, lighter weight
  if (copy.subheadline) {
    const subY = accentLineY + 30;
    svgParts.push(`
      <text x="${width / 2}" y="${subY}" text-anchor="middle"
        font-family="${FONT}"
        font-size="${subheadlineFontSize}" font-weight="normal" fill="#E0E0E0"
        letter-spacing="1">${escXml(copy.subheadline)}</text>
    `);
  }

  // BENEFIT CALLOUT — below product area
  const benefitY = Math.min(productBottom + Math.floor(height * 0.06), Math.floor(height * 0.82));
  svgParts.push(`
    <text x="${width / 2}" y="${benefitY}" text-anchor="middle"
      font-family="${FONT}"
      font-size="${benefitFontSize}" font-weight="bold" fill="#FF3838"
      letter-spacing="1.5">${escXml(copy.benefits.toUpperCase())}</text>
  `);

  // CTA BUTTON — bottom area, red pill-shaped button
  const ctaY = Math.min(benefitY + Math.floor(height * 0.06), Math.floor(height * 0.90));
  const ctaText = copy.cta.toUpperCase();
  const ctaBoxWidth = Math.floor(width * 0.35);
  const ctaBoxHeight = Math.floor(height * 0.055);
  const ctaBoxX = (width - ctaBoxWidth) / 2;
  const ctaBoxY = ctaY - ctaBoxHeight / 2;

  svgParts.push(`
    <rect x="${ctaBoxX}" y="${ctaBoxY}" width="${ctaBoxWidth}" height="${ctaBoxHeight}" rx="${ctaBoxHeight / 2}" fill="#FF3838"/>
    <text x="${width / 2}" y="${ctaBoxY + ctaBoxHeight / 2 + ctaFontSize / 3}" text-anchor="middle"
      font-family="${FONT}"
      font-size="${ctaFontSize}" font-weight="bold" fill="white"
      letter-spacing="3">${escXml(ctaText)}</text>
  `);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${fontDefs}
    ${svgParts.join("\n")}
  </svg>`;
}

/**
 * Fallback SVG text overlay using ONLY system fonts (no embedded base64).
 * Used when the embedded font version fails in production.
 */
function buildTextOverlaySvgSystemFonts(
  width: number,
  height: number,
  copy: {
    headline: string;
    subheadline: string | null;
    benefits: string;
    cta: string;
    product: string;
  },
  productTop: number,
  productBottom: number
): string {
  const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const FONT = "Liberation Sans, DejaVu Sans, Noto Sans, Arial, Helvetica, sans-serif";

  const headlineFontSize = Math.floor(width * 0.055);
  const subheadlineFontSize = Math.floor(width * 0.028);
  const benefitFontSize = Math.floor(width * 0.024);
  const ctaFontSize = Math.floor(width * 0.022);
  const headlineY = Math.floor(height * 0.14);
  const headlineLines = wrapText(copy.headline.toUpperCase(), 22);

  let svgParts: string[] = [];

  headlineLines.forEach((line, i) => {
    const lineY = headlineY + (i * (headlineFontSize + 8));
    svgParts.push(`<text x="${width / 2}" y="${lineY}" text-anchor="middle" font-family="${FONT}" font-size="${headlineFontSize}" font-weight="bold" fill="white" letter-spacing="2">${escXml(line)}</text>`);
  });

  const accentLineY = headlineY + (headlineLines.length * (headlineFontSize + 8)) + 5;
  const accentWidth = Math.floor(width * 0.15);
  svgParts.push(`<rect x="${(width - accentWidth) / 2}" y="${accentLineY}" width="${accentWidth}" height="4" rx="2" fill="#FF3838"/>`);

  if (copy.subheadline) {
    const subY = accentLineY + 30;
    svgParts.push(`<text x="${width / 2}" y="${subY}" text-anchor="middle" font-family="${FONT}" font-size="${subheadlineFontSize}" font-weight="normal" fill="#E0E0E0" letter-spacing="1">${escXml(copy.subheadline)}</text>`);
  }

  const benefitY = Math.min(productBottom + Math.floor(height * 0.06), Math.floor(height * 0.82));
  svgParts.push(`<text x="${width / 2}" y="${benefitY}" text-anchor="middle" font-family="${FONT}" font-size="${benefitFontSize}" font-weight="bold" fill="#FF3838" letter-spacing="1.5">${escXml(copy.benefits.toUpperCase())}</text>`);

  const ctaY = Math.min(benefitY + Math.floor(height * 0.06), Math.floor(height * 0.90));
  const ctaText = copy.cta.toUpperCase();
  const ctaBoxWidth = Math.floor(width * 0.35);
  const ctaBoxHeight = Math.floor(height * 0.055);
  const ctaBoxX = (width - ctaBoxWidth) / 2;
  const ctaBoxY = ctaY - ctaBoxHeight / 2;

  svgParts.push(`<rect x="${ctaBoxX}" y="${ctaBoxY}" width="${ctaBoxWidth}" height="${ctaBoxHeight}" rx="${ctaBoxHeight / 2}" fill="#FF3838"/>`);
  svgParts.push(`<text x="${width / 2}" y="${ctaBoxY + ctaBoxHeight / 2 + ctaFontSize / 3}" text-anchor="middle" font-family="${FONT}" font-size="${ctaFontSize}" font-weight="bold" fill="white" letter-spacing="3">${escXml(ctaText)}</text>`);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join("\n")}</svg>`;
}

/**
 * Simple word-wrap for headline text
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? " " : "") + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  return lines.slice(0, 3); // Max 3 lines
}
