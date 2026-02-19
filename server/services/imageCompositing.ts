import * as db from "../db";
import { LOGOS } from "../config/brandAssets";

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
    subheadline: string | null;
    background: {
      type: "uploaded" | "preset";
      // For uploaded: the URL of the uploaded background image
      url?: string;
      // For preset: the CSS preset ID
      presetId?: string;
      title: string;
      // Legacy fields (kept for backwards compat)
      description?: string;
      prompt?: string;
    };
  }>;
  benefits: string;
  productRenderUrl?: string;
}

// ============================================================
// CSS BACKGROUND PRESETS — no AI needed
// ============================================================
export const CSS_PRESETS: Array<{
  id: string;
  name: string;
  category: string;
  css: string;
  thumbnail: string; // small preview description
}> = [
  {
    id: "dark-ember",
    name: "Dark Ember",
    category: "Dark",
    css: `background: radial-gradient(ellipse at 50% 80%, #3a0a0a 0%, #1a0505 30%, #0a0202 60%, #01040A 100%);`,
    thumbnail: "Deep black with warm red ember glow from bottom",
  },
  {
    id: "midnight-crimson",
    name: "Midnight Crimson",
    category: "Dark",
    css: `background: linear-gradient(165deg, #01040A 0%, #0d0208 35%, #1a0510 55%, #0a0105 75%, #01040A 100%);`,
    thumbnail: "Dark gradient with subtle crimson undertones",
  },
  {
    id: "electric-blue",
    name: "Electric Blue",
    category: "Dark",
    css: `background: radial-gradient(ellipse at 30% 20%, #0a1a3a 0%, #050d1a 40%, #01040A 100%);`,
    thumbnail: "Deep black with cool blue accent lighting",
  },
  {
    id: "warm-amber",
    name: "Warm Amber",
    category: "Gradient",
    css: `background: radial-gradient(ellipse at 50% 30%, #3a2a0a 0%, #1a1505 35%, #01040A 100%);`,
    thumbnail: "Dark base with warm amber/gold glow from top",
  },
  {
    id: "sunset-glow",
    name: "Sunset Glow",
    category: "Gradient",
    css: `background: linear-gradient(180deg, #2a1515 0%, #1a0a0a 40%, #01040A 100%);`,
    thumbnail: "Warm sunset gradient fading to black",
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    category: "Gradient",
    css: `background: radial-gradient(ellipse at 60% 40%, #1a0a2a 0%, #0d0515 40%, #01040A 100%);`,
    thumbnail: "Deep purple gradient with premium feel",
  },
  {
    id: "blush-pink",
    name: "Blush Pink",
    category: "Colourful",
    css: `background: linear-gradient(180deg, #f5c6c6 0%, #e8a8a8 40%, #d4908f 100%);`,
    thumbnail: "Soft pink/blush — great for female-targeted ads",
  },
  {
    id: "clean-white",
    name: "Clean White",
    category: "Minimal",
    css: `background: linear-gradient(180deg, #f8f8f8 0%, #eeeeee 50%, #e0e0e0 100%);`,
    thumbnail: "Clean white/light grey studio look",
  },
  {
    id: "soft-cream",
    name: "Soft Cream",
    category: "Minimal",
    css: `background: linear-gradient(180deg, #faf5ee 0%, #f0e8d8 50%, #e8dcc8 100%);`,
    thumbnail: "Warm cream/beige minimal background",
  },
  {
    id: "concrete-dark",
    name: "Concrete Dark",
    category: "Texture",
    css: `background: #1a1a1a; background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23333333' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");`,
    thumbnail: "Dark textured concrete/industrial look",
  },
];

// ============================================================
// PUPPETEER BROWSER POOL
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

async function renderHtmlToPng(html: string, width: number, height: number): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 800));
    const screenshot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

// ============================================================
// SHARED HTML HELPERS
// ============================================================
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fontImports() {
  return `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  `;
}

function backgroundCss(bg: ImageSelections["images"][0]["background"]): string {
  if (bg.type === "uploaded" && bg.url) {
    return `background: url('${bg.url}') center/cover no-repeat;`;
  }
  if (bg.type === "preset" && bg.presetId) {
    const preset = CSS_PRESETS.find(p => p.id === bg.presetId);
    if (preset) return preset.css;
  }
  // Fallback
  return `background: radial-gradient(ellipse at 50% 80%, #3a0a0a 0%, #1a0505 30%, #01040A 100%);`;
}

// ============================================================
// TEMPLATE 1: BOLD IMPACT
// Inspired by "Flatten Cortisol Belly" example
// Large headline with text stroke, product with glow ring,
// benefit badges with emoji icons at bottom
// ============================================================
function templateBoldImpact(
  bg: ImageSelections["images"][0]["background"],
  productRenderUrl: string,
  logoUrl: string,
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);
  const benefitIcons = ["🔥", "💪", "⚡"];

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${fontImports()}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; font-family: 'Bebas Neue', 'Impact', sans-serif; -webkit-font-smoothing: antialiased; }
  .ad { position: relative; width: ${W}px; height: ${H}px; ${backgroundCss(bg)} }
  .overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 35%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.3) 75%, rgba(0,0,0,0.85) 100%); }
  .content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: ${Math.floor(H * 0.03)}px ${Math.floor(W * 0.05)}px; }
  
  .logo { height: ${Math.floor(H * 0.035)}px; width: auto; filter: brightness(1.2); margin-bottom: ${Math.floor(H * 0.015)}px; }
  
  .headline {
    font-size: ${Math.floor(W * 0.085)}px;
    font-weight: 400;
    color: #FFFFFF;
    text-align: center;
    text-transform: uppercase;
    line-height: 0.95;
    letter-spacing: 3px;
    text-shadow: 0 0 40px rgba(255,56,56,0.4), 0 4px 20px rgba(0,0,0,0.8);
    -webkit-text-stroke: 1px rgba(255,255,255,0.1);
    max-width: 95%;
  }
  .headline em {
    font-style: normal;
    color: #FF3838;
    text-shadow: 0 0 30px rgba(255,56,56,0.6), 0 4px 20px rgba(0,0,0,0.8);
  }
  
  .subheadline {
    font-family: 'Oswald', sans-serif;
    font-size: ${Math.floor(W * 0.028)}px;
    font-weight: 500;
    color: #cccccc;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 4px;
    margin-top: ${Math.floor(H * 0.01)}px;
  }
  
  .product-zone {
    flex: 1; display: flex; align-items: center; justify-content: center; position: relative; min-height: 0;
  }
  .product-glow {
    position: absolute; width: ${Math.floor(W * 0.55)}px; height: ${Math.floor(W * 0.55)}px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,56,56,0.15) 0%, rgba(255,56,56,0.05) 40%, transparent 70%);
    filter: blur(20px);
  }
  .product-img {
    position: relative; z-index: 2;
    width: ${Math.floor(W * 0.45)}px; height: auto; max-height: ${Math.floor(H * 0.42)}px;
    object-fit: contain;
    filter: drop-shadow(0 10px 40px rgba(255,56,56,0.3)) drop-shadow(0 5px 20px rgba(0,0,0,0.6));
  }
  
  .benefits-row {
    display: flex; gap: ${Math.floor(W * 0.03)}px; margin-bottom: ${Math.floor(H * 0.015)}px;
  }
  .benefit-badge {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: ${Math.floor(H * 0.015)}px ${Math.floor(W * 0.025)}px;
    backdrop-filter: blur(10px);
  }
  .benefit-icon { font-size: ${Math.floor(W * 0.035)}px; }
  .benefit-text {
    font-family: 'Oswald', sans-serif; font-size: ${Math.floor(W * 0.018)}px;
    font-weight: 600; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px;
    text-align: center; line-height: 1.2;
  }
  
  .cta {
    background: #FF3838; color: #fff; font-family: 'Bebas Neue', sans-serif;
    font-size: ${Math.floor(W * 0.032)}px; letter-spacing: 4px;
    padding: ${Math.floor(H * 0.015)}px ${Math.floor(W * 0.1)}px;
    border-radius: 50px; box-shadow: 0 4px 25px rgba(255,56,56,0.5);
    margin-bottom: ${Math.floor(H * 0.025)}px;
  }
</style></head><body>
<div class="ad">
  <div class="overlay"></div>
  <div class="content">
    <img class="logo" src="${esc(logoUrl)}" alt="ONEST" crossorigin="anonymous" />
    <div class="headline">${formatHeadlineWithEmphasis(copy.headline)}</div>
    ${copy.subheadline ? `<div class="subheadline">${esc(copy.subheadline)}</div>` : ""}
    <div class="product-zone">
      <div class="product-glow"></div>
      <img class="product-img" src="${esc(productRenderUrl)}" alt="${esc(copy.product)}" crossorigin="anonymous" />
    </div>
    <div class="benefits-row">
      ${benefitItems.map((b, i) => `
        <div class="benefit-badge">
          <span class="benefit-icon">${benefitIcons[i] || "✓"}</span>
          <span class="benefit-text">${esc(b)}</span>
        </div>
      `).join("")}
    </div>
    <div class="cta">${esc(copy.cta)}</div>
  </div>
</div>
</body></html>`;
}

// ============================================================
// TEMPLATE 2: CLEAN EDITORIAL
// Inspired by "Beer Belly" example
// Light background, product on surface, elegant typography
// ============================================================
function templateCleanEditorial(
  bg: ImageSelections["images"][0]["background"],
  productRenderUrl: string,
  logoUrl: string,
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);
  const isLightBg = bg.type === "preset" && (bg.presetId === "blush-pink" || bg.presetId === "clean-white" || bg.presetId === "soft-cream");
  const textColor = isLightBg ? "#1a1a1a" : "#FFFFFF";
  const subtextColor = isLightBg ? "#444444" : "#cccccc";
  const accentColor = "#FF3838";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${fontImports()}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; font-family: 'Montserrat', sans-serif; -webkit-font-smoothing: antialiased; }
  .ad { position: relative; width: ${W}px; height: ${H}px; ${backgroundCss(bg)} }
  .overlay { position: absolute; inset: 0; ${isLightBg ? "" : "background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.5) 100%);"} }
  .content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: ${Math.floor(H * 0.05)}px ${Math.floor(W * 0.08)}px; }
  
  .top-section { text-align: center; }
  .headline-prefix {
    font-family: 'Montserrat', sans-serif; font-size: ${Math.floor(W * 0.028)}px;
    font-weight: 500; color: ${subtextColor}; margin-bottom: 8px;
  }
  .headline {
    font-family: 'Bebas Neue', sans-serif; font-size: ${Math.floor(W * 0.09)}px;
    color: ${textColor}; text-transform: uppercase; line-height: 0.92; letter-spacing: 2px;
  }
  .headline em { font-style: normal; color: ${accentColor}; }
  .subheadline {
    font-family: 'Montserrat', sans-serif; font-size: ${Math.floor(W * 0.022)}px;
    font-weight: 500; color: ${subtextColor}; margin-top: ${Math.floor(H * 0.012)}px;
    font-style: italic;
  }
  
  .product-zone {
    flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0;
    position: relative;
  }
  .product-img {
    width: ${Math.floor(W * 0.40)}px; height: auto; max-height: ${Math.floor(H * 0.40)}px;
    object-fit: contain;
    filter: drop-shadow(0 15px 40px rgba(0,0,0,0.25));
  }
  
  .benefits-col {
    position: absolute; right: ${Math.floor(W * 0.04)}px; top: 50%; transform: translateY(-50%);
    display: flex; flex-direction: column; gap: ${Math.floor(H * 0.02)}px;
  }
  .benefit-item {
    display: flex; align-items: flex-start; gap: 8px; max-width: ${Math.floor(W * 0.28)}px;
  }
  .benefit-check {
    width: 20px; height: 20px; border-radius: 50%; background: ${accentColor};
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;
    font-size: 11px; color: white;
  }
  .benefit-label {
    font-family: 'Montserrat', sans-serif; font-size: ${Math.floor(W * 0.017)}px;
    font-weight: 600; color: ${textColor}; line-height: 1.3;
  }
  
  .bottom-section { text-align: center; margin-bottom: ${Math.floor(H * 0.02)}px; }
  .cta {
    display: inline-block; background: ${accentColor}; color: #fff;
    font-family: 'Montserrat', sans-serif; font-size: ${Math.floor(W * 0.02)}px;
    font-weight: 800; text-transform: uppercase; letter-spacing: 3px;
    padding: ${Math.floor(H * 0.015)}px ${Math.floor(W * 0.08)}px;
    border-radius: 6px; box-shadow: 0 4px 15px rgba(255,56,56,0.3);
  }
  .trust-line {
    font-family: 'Montserrat', sans-serif; font-size: ${Math.floor(W * 0.014)}px;
    color: ${subtextColor}; margin-top: 10px; font-weight: 500;
  }
</style></head><body>
<div class="ad">
  <div class="overlay"></div>
  <div class="content">
    <div class="top-section">
      <div class="headline">${formatHeadlineWithEmphasis(copy.headline)}</div>
      ${copy.subheadline ? `<div class="subheadline">${esc(copy.subheadline)}</div>` : ""}
    </div>
    <div class="product-zone">
      <img class="product-img" src="${esc(productRenderUrl)}" alt="${esc(copy.product)}" crossorigin="anonymous" />
      <div class="benefits-col">
        ${benefitItems.map(b => `
          <div class="benefit-item">
            <div class="benefit-check">✓</div>
            <span class="benefit-label">${esc(b)}</span>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="bottom-section">
      <div class="cta">${esc(copy.cta)}</div>
      <div class="trust-line">Trusted by 100,000's of happy customers</div>
    </div>
  </div>
</div>
</body></html>`;
}

// ============================================================
// TEMPLATE 3: FEATURE SHOWCASE
// Inspired by "Cortisol Belly Gone" example
// Product left, benefits stacked right with checkmarks
// ============================================================
function templateFeatureShowcase(
  bg: ImageSelections["images"][0]["background"],
  productRenderUrl: string,
  logoUrl: string,
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);
  const isLightBg = bg.type === "preset" && (bg.presetId === "blush-pink" || bg.presetId === "clean-white" || bg.presetId === "soft-cream");
  const textColor = isLightBg ? "#1a1a1a" : "#FFFFFF";
  const subtextColor = isLightBg ? "#555555" : "#bbbbbb";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${fontImports()}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; font-family: 'Montserrat', sans-serif; -webkit-font-smoothing: antialiased; }
  .ad { position: relative; width: ${W}px; height: ${H}px; ${backgroundCss(bg)} }
  .overlay { position: absolute; inset: 0; ${isLightBg ? "" : "background: linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.5) 100%);"} }
  .content { position: absolute; inset: 0; display: flex; flex-direction: column; padding: ${Math.floor(H * 0.04)}px ${Math.floor(W * 0.05)}px; }
  
  .logo-row { display: flex; align-items: center; margin-bottom: ${Math.floor(H * 0.02)}px; }
  .logo { height: ${Math.floor(H * 0.03)}px; width: auto; }
  
  .headline-section { margin-bottom: ${Math.floor(H * 0.01)}px; }
  .headline {
    font-family: 'Bebas Neue', sans-serif; font-size: ${Math.floor(W * 0.075)}px;
    color: ${textColor}; text-transform: uppercase; line-height: 0.95; letter-spacing: 2px;
  }
  .headline em { font-style: normal; color: #FF3838; }
  
  .main-area {
    flex: 1; display: flex; align-items: center; gap: ${Math.floor(W * 0.03)}px; min-height: 0;
  }
  .product-side {
    flex: 0 0 50%; display: flex; align-items: center; justify-content: center;
  }
  .product-img {
    width: ${Math.floor(W * 0.42)}px; height: auto; max-height: ${Math.floor(H * 0.50)}px;
    object-fit: contain;
    filter: drop-shadow(0 10px 35px rgba(0,0,0,0.4));
  }
  
  .benefits-side {
    flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${Math.floor(H * 0.025)}px;
  }
  .benefit-card {
    display: flex; align-items: flex-start; gap: 12px;
    background: ${isLightBg ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.05)"};
    border: 1px solid ${isLightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"};
    border-radius: 12px; padding: ${Math.floor(H * 0.018)}px ${Math.floor(W * 0.02)}px;
    backdrop-filter: blur(8px);
  }
  .benefit-icon-circle {
    width: ${Math.floor(W * 0.04)}px; height: ${Math.floor(W * 0.04)}px;
    border-radius: 50%; background: #FF3838; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: ${Math.floor(W * 0.02)}px; color: white; font-weight: 800;
  }
  .benefit-content { display: flex; flex-direction: column; gap: 2px; }
  .benefit-title {
    font-family: 'Oswald', sans-serif; font-size: ${Math.floor(W * 0.02)}px;
    font-weight: 700; color: ${textColor}; text-transform: uppercase; letter-spacing: 1px;
  }
  
  .cta-row { display: flex; justify-content: center; margin-top: ${Math.floor(H * 0.02)}px; margin-bottom: ${Math.floor(H * 0.02)}px; }
  .cta {
    background: #FF3838; color: #fff; font-family: 'Bebas Neue', sans-serif;
    font-size: ${Math.floor(W * 0.03)}px; letter-spacing: 4px;
    padding: ${Math.floor(H * 0.014)}px ${Math.floor(W * 0.1)}px;
    border-radius: 50px; box-shadow: 0 4px 20px rgba(255,56,56,0.4);
  }
</style></head><body>
<div class="ad">
  <div class="overlay"></div>
  <div class="content">
    <div class="logo-row">
      <img class="logo" src="${esc(logoUrl)}" alt="ONEST" crossorigin="anonymous" />
    </div>
    <div class="headline-section">
      <div class="headline">${formatHeadlineWithEmphasis(copy.headline)}</div>
    </div>
    <div class="main-area">
      <div class="product-side">
        <img class="product-img" src="${esc(productRenderUrl)}" alt="${esc(copy.product)}" crossorigin="anonymous" />
      </div>
      <div class="benefits-side">
        ${benefitItems.map((b, i) => `
          <div class="benefit-card">
            <div class="benefit-icon-circle">✓</div>
            <div class="benefit-content">
              <span class="benefit-title">${esc(b)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="cta-row">
      <div class="cta">${esc(copy.cta)}</div>
    </div>
  </div>
</div>
</body></html>`;
}

// ============================================================
// TEMPLATE 4: DARK PREMIUM
// Full-bleed dark, dramatic lighting, large centred product,
// gradient text effects, floating benefit pills
// ============================================================
function templateDarkPremium(
  bg: ImageSelections["images"][0]["background"],
  productRenderUrl: string,
  logoUrl: string,
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${fontImports()}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; font-family: 'Montserrat', sans-serif; -webkit-font-smoothing: antialiased; }
  .ad { position: relative; width: ${W}px; height: ${H}px; ${backgroundCss(bg)} }
  .overlay { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%); }
  .vignette { position: absolute; inset: 0; box-shadow: inset 0 0 ${Math.floor(W * 0.15)}px rgba(0,0,0,0.7); }
  .content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: ${Math.floor(H * 0.04)}px ${Math.floor(W * 0.06)}px; }
  
  .top-bar { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: ${Math.floor(H * 0.01)}px; }
  .logo { height: ${Math.floor(H * 0.03)}px; width: auto; }
  .product-name {
    font-family: 'Oswald', sans-serif; font-size: ${Math.floor(W * 0.018)}px;
    font-weight: 600; color: #FF3838; text-transform: uppercase; letter-spacing: 3px;
  }
  
  .headline {
    font-family: 'Bebas Neue', sans-serif; font-size: ${Math.floor(W * 0.095)}px;
    color: #FFFFFF; text-align: center; text-transform: uppercase;
    line-height: 0.9; letter-spacing: 3px;
    background: linear-gradient(180deg, #FFFFFF 30%, #888888 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 2px 10px rgba(0,0,0,0.5));
  }
  .headline em {
    -webkit-text-fill-color: #FF3838;
    filter: drop-shadow(0 0 20px rgba(255,56,56,0.4));
  }
  
  ${copy.subheadline ? `
  .subheadline {
    font-family: 'Oswald', sans-serif; font-size: ${Math.floor(W * 0.024)}px;
    font-weight: 500; color: #999; text-transform: uppercase; letter-spacing: 6px;
    margin-top: ${Math.floor(H * 0.008)}px;
  }` : ""}
  
  .product-zone {
    flex: 1; display: flex; align-items: center; justify-content: center; position: relative; min-height: 0;
  }
  .product-spotlight {
    position: absolute; width: ${Math.floor(W * 0.7)}px; height: ${Math.floor(H * 0.15)}px;
    bottom: 0; left: 50%; transform: translateX(-50%);
    background: radial-gradient(ellipse, rgba(255,56,56,0.08) 0%, transparent 70%);
    filter: blur(15px);
  }
  .product-img {
    position: relative; z-index: 2;
    width: ${Math.floor(W * 0.48)}px; height: auto; max-height: ${Math.floor(H * 0.45)}px;
    object-fit: contain;
    filter: drop-shadow(0 0 60px rgba(255,56,56,0.15)) drop-shadow(0 10px 30px rgba(0,0,0,0.5));
  }
  
  .benefit-pills {
    display: flex; gap: ${Math.floor(W * 0.02)}px; margin-bottom: ${Math.floor(H * 0.015)}px;
  }
  .pill {
    background: rgba(255,56,56,0.12); border: 1px solid rgba(255,56,56,0.25);
    border-radius: 50px; padding: ${Math.floor(H * 0.01)}px ${Math.floor(W * 0.025)}px;
    font-family: 'Oswald', sans-serif; font-size: ${Math.floor(W * 0.016)}px;
    font-weight: 600; color: #FF3838; text-transform: uppercase; letter-spacing: 1px;
  }
  
  .cta {
    background: linear-gradient(135deg, #FF3838 0%, #cc2020 100%);
    color: #fff; font-family: 'Bebas Neue', sans-serif;
    font-size: ${Math.floor(W * 0.03)}px; letter-spacing: 5px;
    padding: ${Math.floor(H * 0.016)}px ${Math.floor(W * 0.12)}px;
    border-radius: 4px; box-shadow: 0 4px 25px rgba(255,56,56,0.4), 0 0 60px rgba(255,56,56,0.15);
    margin-bottom: ${Math.floor(H * 0.025)}px;
  }
</style></head><body>
<div class="ad">
  <div class="overlay"></div>
  <div class="vignette"></div>
  <div class="content">
    <div class="top-bar">
      <img class="logo" src="${esc(logoUrl)}" alt="ONEST" crossorigin="anonymous" />
      <span class="product-name">${esc(copy.product)}</span>
    </div>
    <div class="headline">${formatHeadlineWithEmphasis(copy.headline)}</div>
    ${copy.subheadline ? `<div class="subheadline">${esc(copy.subheadline)}</div>` : ""}
    <div class="product-zone">
      <div class="product-spotlight"></div>
      <img class="product-img" src="${esc(productRenderUrl)}" alt="${esc(copy.product)}" crossorigin="anonymous" />
    </div>
    <div class="benefit-pills">
      ${benefitItems.map(b => `<span class="pill">${esc(b)}</span>`).join("")}
    </div>
    <div class="cta">${esc(copy.cta)}</div>
  </div>
</div>
</body></html>`;
}

// ============================================================
// HEADLINE FORMATTING HELPER
// Makes the last word or key word red using <em> tag
// ============================================================
function formatHeadlineWithEmphasis(headline: string): string {
  const words = headline.split(" ");
  if (words.length <= 1) return esc(headline);
  // Make the last word or last 2 words red for emphasis
  if (words.length <= 3) {
    return words.slice(0, -1).map(w => esc(w)).join(" ") + " <em>" + esc(words[words.length - 1]) + "</em>";
  }
  // For longer headlines, make the last 2 words red
  return words.slice(0, -2).map(w => esc(w)).join(" ") + " <em>" + words.slice(-2).map(w => esc(w)).join(" ") + "</em>";
}

// ============================================================
// TEMPLATE REGISTRY
// ============================================================
const TEMPLATES = [
  { id: "bold-impact", name: "Bold Impact", fn: templateBoldImpact },
  { id: "clean-editorial", name: "Clean Editorial", fn: templateCleanEditorial },
  { id: "feature-showcase", name: "Feature Showcase", fn: templateFeatureShowcase },
  { id: "dark-premium", name: "Dark Premium", fn: templateDarkPremium },
];

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Generate 3 ad creative variations using:
 * 1. Uploaded backgrounds or CSS presets (NO AI generation)
 * 2. Product render from DB
 * 3. Different HTML/CSS templates for visual variety
 * 4. Puppeteer rendering for pixel-perfect output
 */
export async function generateStaticAdVariations(
  creativeBrief: string,
  inspireImageUrl: string,
  product: string,
  brandName: string,
  selections?: ImageSelections,
  teamFeedback?: string
): Promise<CompositeResult[]> {
  console.log("[ImageCompositing] Starting ad creative generation with 3 variations (NO AI backgrounds)");

  // Pull product render
  let productRenderUrl: string;
  if (selections?.productRenderUrl) {
    productRenderUrl = selections.productRenderUrl;
    console.log(`[ImageCompositing] Using user-selected product render`);
  } else {
    try {
      const renders = await db.getProductRendersByProduct(product);
      if (renders.length > 0) {
        productRenderUrl = renders[Math.floor(Math.random() * renders.length)].url;
        console.log(`[ImageCompositing] Using uploaded render for ${product}`);
      } else {
        const allRenders = await db.listProductRenders();
        if (allRenders.length > 0) {
          productRenderUrl = allRenders[0].url;
          console.log(`[ImageCompositing] Using fallback render`);
        } else {
          productRenderUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png";
          console.log("[ImageCompositing] No renders uploaded, using hardcoded fallback");
        }
      }
    } catch (err: any) {
      console.warn("[ImageCompositing] Failed to fetch renders:", err.message);
      productRenderUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png";
    }
  }

  const logoUrl = LOGOS.wordmark_white;
  const W = 1080;
  const H = 1080;

  // Build per-image config from selections or fallback
  const imageConfigs = buildImageConfigs(selections, creativeBrief, product, teamFeedback);

  // Assign different templates to each variation for visual variety
  const templateAssignments = [
    TEMPLATES[0], // Bold Impact for Control
    TEMPLATES[2], // Feature Showcase for Variation 2
    TEMPLATES[3], // Dark Premium for Variation 3
  ];

  const results: CompositeResult[] = [];

  for (let i = 0; i < 3; i++) {
    const config = imageConfigs[i];
    const template = templateAssignments[i];
    const variationLabel = i === 0 ? "Control" : `Variation ${i + 1}`;

    try {
      console.log(`[ImageCompositing] === Image ${i + 1}/3: ${variationLabel} (${template.name}) ===`);
      console.log(`[ImageCompositing] Headline: "${config.headline}"`);
      console.log(`[ImageCompositing] Background: ${config.background.type} - ${config.background.title}`);

      const copy = {
        headline: config.headline,
        subheadline: config.subheadline,
        benefits: config.benefits,
        cta: "SHOP NOW",
        product,
      };

      const html = template.fn(config.background, productRenderUrl, logoUrl, copy, W, H);

      console.log(`[ImageCompositing] Rendering ${template.name} template via Puppeteer...`);
      const pngBuffer = await renderHtmlToPng(html, W, H);
      console.log(`[ImageCompositing] PNG rendered: ${(pngBuffer.length / 1024 / 1024).toFixed(1)}MB`);

      const { storagePut } = await import("../storage");
      const fileKey = `static-ads/${variationLabel.toLowerCase().replace(/\s+/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const { url } = await storagePut(fileKey, pngBuffer, "image/png");

      results.push({ url, variation: variationLabel });
      console.log(`[ImageCompositing] Image ${i + 1} DONE: ${url}`);
    } catch (err: any) {
      console.error(`[ImageCompositing] Failed image ${i + 1}:`, err.message);
      results.push({
        url: `https://via.placeholder.com/1080x1080/01040A/FF3838?text=Image+${i + 1}+Failed`,
        variation: `${variationLabel} (failed)`,
      });
    }
  }

  return results;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function buildImageConfigs(
  selections: ImageSelections | undefined,
  brief: string,
  product: string,
  teamFeedback?: string
): Array<{
  headline: string;
  subheadline: string | null;
  benefits: string;
  background: ImageSelections["images"][0]["background"];
}> {
  if (selections && selections.images && selections.images.length >= 3) {
    return selections.images.map((img) => ({
      headline: img.headline,
      subheadline: img.subheadline,
      benefits: selections.benefits,
      background: img.background,
    }));
  }

  // Fallback: use CSS presets
  return [
    {
      headline: `FUEL YOUR ${product.toUpperCase()}`,
      subheadline: "Premium Australian Formulation",
      benefits: "Burn Fat | Boost Energy | Crush Cravings",
      background: { type: "preset" as const, presetId: "dark-ember", title: "Dark Ember" },
    },
    {
      headline: `UNLOCK ${product.toUpperCase()} POWER`,
      subheadline: "Trusted by Athletes",
      benefits: "Clinically Dosed | Science-Backed | No Fillers",
      background: { type: "preset" as const, presetId: "midnight-crimson", title: "Midnight Crimson" },
    },
    {
      headline: `${product.toUpperCase()} REDEFINED`,
      subheadline: "No Compromises",
      benefits: "Premium Ingredients | Real Results | Australian Made",
      background: { type: "preset" as const, presetId: "electric-blue", title: "Electric Blue" },
    },
  ];
}
