import * as db from "../db";
import { LOGOS } from "../config/brandAssets";
import * as sharpModule from "sharp";
const sharp = (sharpModule as any).default || sharpModule;

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
      url?: string;
      presetId?: string;
      title: string;
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
  thumbnail: string;
  // SVG gradient definition for Sharp rendering
  svgGradient: string;
}> = [
  {
    id: "dark-ember",
    name: "Dark Ember",
    category: "Dark",
    css: `background: radial-gradient(ellipse at 50% 80%, #3a0a0a 0%, #1a0505 30%, #0a0202 60%, #01040A 100%);`,
    thumbnail: "Deep black with warm red ember glow from bottom",
    svgGradient: `<radialGradient id="bg" cx="50%" cy="80%" rx="80%" ry="80%"><stop offset="0%" stop-color="#3a0a0a"/><stop offset="30%" stop-color="#1a0505"/><stop offset="60%" stop-color="#0a0202"/><stop offset="100%" stop-color="#01040A"/></radialGradient>`,
  },
  {
    id: "midnight-crimson",
    name: "Midnight Crimson",
    category: "Dark",
    css: `background: linear-gradient(165deg, #01040A 0%, #0d0208 35%, #1a0510 55%, #0a0105 75%, #01040A 100%);`,
    thumbnail: "Dark gradient with subtle crimson undertones",
    svgGradient: `<linearGradient id="bg" x1="0%" y1="0%" x2="30%" y2="100%"><stop offset="0%" stop-color="#01040A"/><stop offset="35%" stop-color="#0d0208"/><stop offset="55%" stop-color="#1a0510"/><stop offset="75%" stop-color="#0a0105"/><stop offset="100%" stop-color="#01040A"/></linearGradient>`,
  },
  {
    id: "electric-blue",
    name: "Electric Blue",
    category: "Dark",
    css: `background: radial-gradient(ellipse at 30% 20%, #0a1a3a 0%, #050d1a 40%, #01040A 100%);`,
    thumbnail: "Deep black with cool blue accent lighting",
    svgGradient: `<radialGradient id="bg" cx="30%" cy="20%" rx="80%" ry="80%"><stop offset="0%" stop-color="#0a1a3a"/><stop offset="40%" stop-color="#050d1a"/><stop offset="100%" stop-color="#01040A"/></radialGradient>`,
  },
  {
    id: "warm-amber",
    name: "Warm Amber",
    category: "Gradient",
    css: `background: radial-gradient(ellipse at 50% 30%, #3a2a0a 0%, #1a1505 35%, #01040A 100%);`,
    thumbnail: "Dark base with warm amber/gold glow from top",
    svgGradient: `<radialGradient id="bg" cx="50%" cy="30%" rx="80%" ry="80%"><stop offset="0%" stop-color="#3a2a0a"/><stop offset="35%" stop-color="#1a1505"/><stop offset="100%" stop-color="#01040A"/></radialGradient>`,
  },
  {
    id: "sunset-glow",
    name: "Sunset Glow",
    category: "Gradient",
    css: `background: linear-gradient(180deg, #2a1515 0%, #1a0a0a 40%, #01040A 100%);`,
    thumbnail: "Warm sunset gradient fading to black",
    svgGradient: `<linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#2a1515"/><stop offset="40%" stop-color="#1a0a0a"/><stop offset="100%" stop-color="#01040A"/></linearGradient>`,
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    category: "Gradient",
    css: `background: radial-gradient(ellipse at 60% 40%, #1a0a2a 0%, #0d0515 40%, #01040A 100%);`,
    thumbnail: "Deep purple gradient with premium feel",
    svgGradient: `<radialGradient id="bg" cx="60%" cy="40%" rx="80%" ry="80%"><stop offset="0%" stop-color="#1a0a2a"/><stop offset="40%" stop-color="#0d0515"/><stop offset="100%" stop-color="#01040A"/></radialGradient>`,
  },
  {
    id: "blush-pink",
    name: "Blush Pink",
    category: "Colourful",
    css: `background: linear-gradient(180deg, #f5c6c6 0%, #e8a8a8 40%, #d4908f 100%);`,
    thumbnail: "Soft pink/blush — great for female-targeted ads",
    svgGradient: `<linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f5c6c6"/><stop offset="40%" stop-color="#e8a8a8"/><stop offset="100%" stop-color="#d4908f"/></linearGradient>`,
  },
  {
    id: "clean-white",
    name: "Clean White",
    category: "Minimal",
    css: `background: linear-gradient(180deg, #f8f8f8 0%, #eeeeee 50%, #e0e0e0 100%);`,
    thumbnail: "Clean white/light grey studio look",
    svgGradient: `<linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f8f8f8"/><stop offset="50%" stop-color="#eeeeee"/><stop offset="100%" stop-color="#e0e0e0"/></linearGradient>`,
  },
  {
    id: "soft-cream",
    name: "Soft Cream",
    category: "Minimal",
    css: `background: linear-gradient(180deg, #faf5ee 0%, #f0e8d8 50%, #e8dcc8 100%);`,
    thumbnail: "Warm cream/beige minimal background",
    svgGradient: `<linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#faf5ee"/><stop offset="50%" stop-color="#f0e8d8"/><stop offset="100%" stop-color="#e8dcc8"/></linearGradient>`,
  },
  {
    id: "concrete-dark",
    name: "Concrete Dark",
    category: "Texture",
    css: `background: #1a1a1a;`,
    thumbnail: "Dark textured concrete/industrial look",
    svgGradient: `<linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#222222"/><stop offset="100%" stop-color="#1a1a1a"/></linearGradient>`,
  },
];

// ============================================================
// HELPER: Fetch remote image as Buffer
// ============================================================
async function fetchImageBuffer(url: string): Promise<Buffer> {
  console.log(`[ImageCompositing] Fetching image: ${url.substring(0, 80)}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status}): ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  console.log(`[ImageCompositing] ✓ Fetched ${(buf.length / 1024).toFixed(1)}KB`);
  return buf;
}

// ============================================================
// HELPER: XML-escape text for SVG
// ============================================================
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// ============================================================
// HELPER: Split headline into main + emphasis word(s)
// ============================================================
function splitHeadline(headline: string): { main: string; emphasis: string } {
  const words = headline.split(" ");
  if (words.length <= 1) return { main: headline, emphasis: "" };
  if (words.length <= 3) {
    return { main: words.slice(0, -1).join(" "), emphasis: words[words.length - 1] };
  }
  return { main: words.slice(0, -2).join(" "), emphasis: words.slice(-2).join(" ") };
}

// ============================================================
// HELPER: Get SVG gradient for a background selection
// ============================================================
function getSvgGradient(bg: ImageSelections["images"][0]["background"]): string {
  if (bg.type === "preset" && bg.presetId) {
    const preset = CSS_PRESETS.find(p => p.id === bg.presetId);
    if (preset) return preset.svgGradient;
  }
  // Default dark ember
  return CSS_PRESETS[0].svgGradient;
}

// ============================================================
// HELPER: Check if background is light-coloured
// ============================================================
function isLightBackground(bg: ImageSelections["images"][0]["background"]): boolean {
  return bg.type === "preset" && ["blush-pink", "clean-white", "soft-cream"].includes(bg.presetId || "");
}

// ============================================================
// HELPER: Word-wrap text to fit within a max width (approx)
// ============================================================
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============================================================
// TEMPLATE 1: BOLD IMPACT (SVG-based)
// Large headline, product centre, benefit badges, CTA
// ============================================================
function svgBoldImpact(
  bg: ImageSelections["images"][0]["background"],
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const { main, emphasis } = splitHeadline(copy.headline);
  const isLight = isLightBackground(bg);
  const textCol = isLight ? "#1a1a1a" : "#FFFFFF";
  const subCol = isLight ? "#444444" : "#cccccc";
  const accent = "#FF3838";
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);
  const gradient = getSvgGradient(bg);

  // Word-wrap headline if long
  const headlineLines = wrapText(main, 18);
  const headlineFontSize = headlineLines.length > 1 ? 76 : 88;
  const headlineStartY = 130;
  const headlineLineHeight = headlineFontSize + 6;

  // Benefits positioning
  const benefitY = 830;
  const benefitGap = 20;
  const pillWidth = (W - 120 - benefitGap * (benefitItems.length - 1)) / benefitItems.length;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${gradient}
    <filter id="shadow1"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.6"/></filter>
    <filter id="glow1"><feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="${accent}" flood-opacity="0.3"/></filter>
  </defs>
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- Dark overlay gradient -->
  <rect width="${W}" height="${H}" fill="url(#overlay1)" opacity="0.6"/>
  <defs><linearGradient id="overlay1" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#000" stop-opacity="0.7"/>
    <stop offset="35%" stop-color="#000" stop-opacity="0.15"/>
    <stop offset="65%" stop-color="#000" stop-opacity="0.1"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.8"/>
  </linearGradient></defs>

  <!-- Logo placeholder area (composited separately) -->

  <!-- Headline -->
  ${headlineLines.map((line, i) => 
    `<text x="${W/2}" y="${headlineStartY + i * headlineLineHeight}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="${textCol}" filter="url(#shadow1)" letter-spacing="3">${esc(line)}</text>`
  ).join("\n  ")}
  ${emphasis ? `<text x="${W/2}" y="${headlineStartY + headlineLines.length * headlineLineHeight}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="${accent}" filter="url(#glow1)" letter-spacing="3">${esc(emphasis)}</text>` : ""}

  ${copy.subheadline ? `<text x="${W/2}" y="${headlineStartY + (headlineLines.length + (emphasis ? 1 : 0)) * headlineLineHeight + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="500" fill="${subCol}" letter-spacing="4">${esc(copy.subheadline.toUpperCase())}</text>` : ""}

  <!-- Product glow ring -->
  <ellipse cx="${W/2}" cy="560" rx="240" ry="240" fill="none" stroke="${accent}" stroke-opacity="0.08" stroke-width="80" filter="url(#glow1)"/>

  <!-- Product image placeholder (composited separately) -->

  <!-- Benefit badges -->
  ${benefitItems.map((b, i) => {
    const x = 60 + i * (pillWidth + benefitGap);
    return `
    <rect x="${x}" y="${benefitY}" width="${pillWidth}" height="60" rx="12" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <text x="${x + pillWidth/2}" y="${benefitY + 36}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${textCol}" letter-spacing="1">${esc(b.toUpperCase())}</text>`;
  }).join("")}

  <!-- CTA Button -->
  <rect x="${W/2 - 150}" y="920" width="300" height="55" rx="28" fill="${accent}"/>
  <text x="${W/2}" y="954" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="26" fill="white" letter-spacing="4">${esc(copy.cta)}</text>

  <!-- Benefit callout -->
  <text x="${W/2}" y="${benefitY + 90}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="${subCol}" letter-spacing="2">${esc(copy.benefits.toUpperCase().substring(0, 50))}</text>
</svg>`;
}

// ============================================================
// TEMPLATE 2: CLEAN EDITORIAL (SVG-based)
// Product centre, benefits on right side with checkmarks
// ============================================================
function svgCleanEditorial(
  bg: ImageSelections["images"][0]["background"],
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const { main, emphasis } = splitHeadline(copy.headline);
  const isLight = isLightBackground(bg);
  const textCol = isLight ? "#1a1a1a" : "#FFFFFF";
  const subCol = isLight ? "#444444" : "#cccccc";
  const accent = "#FF3838";
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);
  const gradient = getSvgGradient(bg);

  const headlineLines = wrapText(main, 16);
  const headlineFontSize = headlineLines.length > 1 ? 80 : 92;
  const headlineStartY = 140;
  const headlineLineHeight = headlineFontSize + 4;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${gradient}
    <filter id="shadow2"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.4"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${!isLight ? `<rect width="${W}" height="${H}" opacity="0.4"><animate attributeName="opacity" values="0.4" dur="0s"/></rect>` : ""}

  <!-- Headline -->
  ${headlineLines.map((line, i) => 
    `<text x="${W/2}" y="${headlineStartY + i * headlineLineHeight}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="${textCol}" filter="url(#shadow2)" letter-spacing="2">${esc(line)}</text>`
  ).join("\n  ")}
  ${emphasis ? `<text x="${W/2}" y="${headlineStartY + headlineLines.length * headlineLineHeight}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="${accent}" letter-spacing="2">${esc(emphasis)}</text>` : ""}

  ${copy.subheadline ? `<text x="${W/2}" y="${headlineStartY + (headlineLines.length + (emphasis ? 1 : 0)) * headlineLineHeight + 16}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-style="italic" fill="${subCol}">${esc(copy.subheadline)}</text>` : ""}

  <!-- Product image placeholder (composited separately) -->

  <!-- Benefits on right side -->
  ${benefitItems.map((b, i) => {
    const y = 480 + i * 70;
    return `
    <circle cx="700" cy="${y}" r="14" fill="${accent}"/>
    <text x="700" y="${y + 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white">✓</text>
    <text x="724" y="${y + 6}" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="${textCol}">${esc(b)}</text>`;
  }).join("")}

  <!-- CTA Button -->
  <rect x="${W/2 - 140}" y="920" width="280" height="50" rx="6" fill="${accent}"/>
  <text x="${W/2}" y="952" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="white" letter-spacing="3">${esc(copy.cta)}</text>

  <!-- Trust line -->
  <text x="${W/2}" y="1000" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${subCol}">Trusted by 100,000's of happy customers</text>
</svg>`;
}

// ============================================================
// TEMPLATE 3: FEATURE SHOWCASE (SVG-based)
// Product left, benefits stacked right with checkmarks
// ============================================================
function svgFeatureShowcase(
  bg: ImageSelections["images"][0]["background"],
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const { main, emphasis } = splitHeadline(copy.headline);
  const isLight = isLightBackground(bg);
  const textCol = isLight ? "#1a1a1a" : "#FFFFFF";
  const subCol = isLight ? "#555555" : "#bbbbbb";
  const accent = "#FF3838";
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);
  const gradient = getSvgGradient(bg);

  const headlineLines = wrapText(main, 20);
  const headlineFontSize = 72;
  const headlineStartY = 120;
  const headlineLineHeight = headlineFontSize + 4;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${gradient}
    <filter id="shadow3"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000" flood-opacity="0.4"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${!isLight ? `<defs><linearGradient id="ov3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#000" stop-opacity="0.5"/><stop offset="50%" stop-color="#000" stop-opacity="0.15"/><stop offset="100%" stop-color="#000" stop-opacity="0.4"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#ov3)"/>` : ""}

  <!-- Logo placeholder (composited separately) -->

  <!-- Headline at top -->
  ${headlineLines.map((line, i) => 
    `<text x="60" y="${headlineStartY + i * headlineLineHeight}" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="${textCol}" filter="url(#shadow3)" letter-spacing="2">${esc(line)}</text>`
  ).join("\n  ")}
  ${emphasis ? `<text x="60" y="${headlineStartY + headlineLines.length * headlineLineHeight}" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="${accent}" letter-spacing="2">${esc(emphasis)}</text>` : ""}

  <!-- Product image placeholder (composited on left side) -->

  <!-- Benefit cards on right -->
  ${benefitItems.map((b, i) => {
    const y = 420 + i * 100;
    const cardBg = isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.05)";
    const borderCol = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
    return `
    <rect x="560" y="${y}" width="460" height="80" rx="12" fill="${cardBg}" stroke="${borderCol}" stroke-width="1"/>
    <circle cx="600" cy="${y + 40}" r="18" fill="${accent}"/>
    <text x="600" y="${y + 46}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white">✓</text>
    <text x="630" y="${y + 45}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${textCol}" letter-spacing="1">${esc(b.toUpperCase())}</text>`;
  }).join("")}

  <!-- CTA Button -->
  <rect x="${W/2 - 150}" y="940" width="300" height="55" rx="28" fill="${accent}"/>
  <text x="${W/2}" y="974" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="26" fill="white" letter-spacing="4">${esc(copy.cta)}</text>
</svg>`;
}

// ============================================================
// TEMPLATE 4: DARK PREMIUM (SVG-based)
// Full dark, dramatic, large centred product, gradient text
// ============================================================
function svgDarkPremium(
  bg: ImageSelections["images"][0]["background"],
  copy: { headline: string; subheadline: string | null; benefits: string; cta: string; product: string },
  W: number, H: number
): string {
  const { main, emphasis } = splitHeadline(copy.headline);
  const accent = "#FF3838";
  const benefitItems = copy.benefits.split(/[,|•]/).map(b => b.trim()).filter(Boolean).slice(0, 3);
  const gradient = getSvgGradient(bg);

  const headlineLines = wrapText(main, 16);
  const headlineFontSize = headlineLines.length > 1 ? 82 : 96;
  const headlineStartY = 140;
  const headlineLineHeight = headlineFontSize + 4;

  // Benefit pills
  const pillY = 840;
  const pillGap = 15;
  const pillWidth = (W - 100 - pillGap * (benefitItems.length - 1)) / benefitItems.length;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${gradient}
    <radialGradient id="vig4" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.6"/></radialGradient>
    <filter id="shadow4"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000" flood-opacity="0.5"/></filter>
    <filter id="glow4"><feDropShadow dx="0" dy="0" stdDeviation="15" flood-color="${accent}" flood-opacity="0.25"/></filter>
    <linearGradient id="textGrad4" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="30%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#888888"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#vig4)"/>

  <!-- Top bar: logo + product name -->
  <!-- Logo composited separately -->
  <text x="${W - 60}" y="60" text-anchor="end" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="${accent}" letter-spacing="3">${esc(copy.product.toUpperCase())}</text>

  <!-- Headline with gradient fill -->
  ${headlineLines.map((line, i) => 
    `<text x="${W/2}" y="${headlineStartY + i * headlineLineHeight}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="url(#textGrad4)" filter="url(#shadow4)" letter-spacing="3">${esc(line)}</text>`
  ).join("\n  ")}
  ${emphasis ? `<text x="${W/2}" y="${headlineStartY + headlineLines.length * headlineLineHeight}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="${headlineFontSize}" font-weight="bold" fill="${accent}" filter="url(#glow4)" letter-spacing="3">${esc(emphasis)}</text>` : ""}

  ${copy.subheadline ? `<text x="${W/2}" y="${headlineStartY + (headlineLines.length + (emphasis ? 1 : 0)) * headlineLineHeight + 16}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="500" fill="#999" letter-spacing="6">${esc(copy.subheadline.toUpperCase())}</text>` : ""}

  <!-- Product spotlight glow -->
  <ellipse cx="${W/2}" cy="700" rx="350" ry="60" fill="${accent}" opacity="0.06" filter="url(#glow4)"/>

  <!-- Product image placeholder (composited separately) -->

  <!-- Benefit pills -->
  ${benefitItems.map((b, i) => {
    const x = 50 + i * (pillWidth + pillGap);
    return `
    <rect x="${x}" y="${pillY}" width="${pillWidth}" height="45" rx="23" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.25" stroke-width="1"/>
    <text x="${x + pillWidth/2}" y="${pillY + 29}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="${accent}" letter-spacing="1">${esc(b.toUpperCase())}</text>`;
  }).join("")}

  <!-- CTA Button -->
  <rect x="${W/2 - 160}" y="910" width="320" height="55" rx="4" fill="${accent}"/>
  <text x="${W/2}" y="944" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="26" fill="white" letter-spacing="5">${esc(copy.cta)}</text>
</svg>`;
}

// ============================================================
// TEMPLATE REGISTRY
// ============================================================
const SVG_TEMPLATES = [
  { id: "bold-impact", name: "Bold Impact", fn: svgBoldImpact },
  { id: "clean-editorial", name: "Clean Editorial", fn: svgCleanEditorial },
  { id: "feature-showcase", name: "Feature Showcase", fn: svgFeatureShowcase },
  { id: "dark-premium", name: "Dark Premium", fn: svgDarkPremium },
];

// ============================================================
// SHARP-BASED RENDERING (No Puppeteer/Chromium needed!)
// ============================================================

/**
 * Render an ad image using Sharp compositing:
 * 1. Render SVG template as base layer
 * 2. Composite product render image
 * 3. Composite logo image
 * Returns a PNG buffer.
 */
async function renderAdWithSharp(
  svgTemplate: string,
  productImgBuffer: Buffer,
  logoImgBuffer: Buffer,
  templateId: string,
  W: number,
  H: number
): Promise<Buffer> {
  console.log(`[Sharp] Rendering template: ${templateId} (${W}x${H})`);

  // 1. Render SVG background + text as base
  const basePng = await sharp(Buffer.from(svgTemplate))
    .resize(W, H)
    .png()
    .toBuffer();

  // 2. Resize product render (different position per template)
  let productW: number, productH: number, productTop: number, productLeft: number;

  if (templateId === "feature-showcase") {
    // Product on left side
    productW = Math.floor(W * 0.42);
    productH = Math.floor(H * 0.45);
    productTop = Math.floor(H * 0.35);
    productLeft = Math.floor(W * 0.06);
  } else {
    // Product centred
    productW = Math.floor(W * 0.42);
    productH = Math.floor(H * 0.40);
    productTop = Math.floor(H * 0.38);
    productLeft = Math.floor((W - productW) / 2);
  }

  const productResized = await sharp(productImgBuffer)
    .resize(productW, productH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 3. Resize logo
  const logoH = Math.floor(H * 0.035);
  const logoResized = await sharp(logoImgBuffer)
    .resize({ height: logoH, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoResized).metadata();
  const logoW = logoMeta.width || 120;

  let logoTop: number, logoLeft: number;
  if (templateId === "feature-showcase") {
    logoTop = Math.floor(H * 0.04);
    logoLeft = 60;
  } else if (templateId === "dark-premium") {
    logoTop = Math.floor(H * 0.035);
    logoLeft = 60;
  } else {
    // Centred at top
    logoTop = Math.floor(H * 0.03);
    logoLeft = Math.floor((W - logoW) / 2);
  }

  // 4. Composite all layers
  const result = await sharp(basePng)
    .composite([
      { input: productResized, top: productTop, left: productLeft },
      { input: logoResized, top: logoTop, left: logoLeft },
    ])
    .png()
    .toBuffer();

  console.log(`[Sharp] ✓ Rendered ${templateId}: ${(result.length / 1024).toFixed(1)}KB`);
  return result;
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Generate 3 ad creative variations using:
 * 1. CSS preset backgrounds (rendered as SVG gradients)
 * 2. Product render from DB
 * 3. Different SVG templates for visual variety
 * 4. Sharp compositing for pixel-perfect output (NO Puppeteer!)
 */
export async function generateStaticAdVariations(
  creativeBrief: string,
  inspireImageUrl: string,
  product: string,
  brandName: string,
  selections?: ImageSelections,
  teamFeedback?: string
): Promise<CompositeResult[]> {
  console.log("[ImageCompositing] Starting ad creative generation with 3 variations (Sharp-based, NO Puppeteer)");

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

  const rawLogoUrl = LOGOS.wordmark_white;
  const W = 1080;
  const H = 1080;

  // Pre-fetch images
  console.log(`[ImageCompositing] Pre-fetching product render and logo...`);
  const [productImgBuffer, logoImgBuffer] = await Promise.all([
    fetchImageBuffer(productRenderUrl),
    fetchImageBuffer(rawLogoUrl),
  ]);

  // Build per-image config from selections or fallback
  const imageConfigs = buildImageConfigs(selections, creativeBrief, product, teamFeedback);

  // Assign different templates to each variation for visual variety
  const templateAssignments = [
    SVG_TEMPLATES[0], // Bold Impact for Control
    SVG_TEMPLATES[2], // Feature Showcase for Variation 2
    SVG_TEMPLATES[3], // Dark Premium for Variation 3
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

      // Handle uploaded background images
      let bgForTemplate = config.background;
      if (config.background.type === "uploaded" && config.background.url) {
        // For uploaded backgrounds, we'll use the image as a full-bleed background
        // by compositing it under the SVG text layer
        bgForTemplate = { ...config.background };
      }

      // Generate SVG template
      const svgContent = template.fn(bgForTemplate, copy, W, H);

      // Handle uploaded background: composite background image under SVG
      let finalBuffer: Buffer;
      if (config.background.type === "uploaded" && config.background.url) {
        const bgImgBuffer = await fetchImageBuffer(config.background.url);
        const bgResized = await sharp(bgImgBuffer)
          .resize(W, H, { fit: "cover" })
          .png()
          .toBuffer();

        // Render SVG text overlay
        const svgOverlay = await sharp(Buffer.from(svgContent))
          .resize(W, H)
          .png()
          .toBuffer();

        // Product and logo
        const productW = template.id === "feature-showcase" ? Math.floor(W * 0.42) : Math.floor(W * 0.42);
        const productH = template.id === "feature-showcase" ? Math.floor(H * 0.45) : Math.floor(H * 0.40);
        const productTop = template.id === "feature-showcase" ? Math.floor(H * 0.35) : Math.floor(H * 0.38);
        const productLeft = template.id === "feature-showcase" ? Math.floor(W * 0.06) : Math.floor((W - productW) / 2);

        const productResized = await sharp(productImgBuffer)
          .resize(productW, productH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        const logoH = Math.floor(H * 0.035);
        const logoResized = await sharp(logoImgBuffer)
          .resize({ height: logoH, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        const logoMeta = await sharp(logoResized).metadata();
        const logoW = logoMeta.width || 120;
        const logoTop = template.id === "feature-showcase" ? Math.floor(H * 0.04) : Math.floor(H * 0.03);
        const logoLeft = template.id === "feature-showcase" || template.id === "dark-premium" ? 60 : Math.floor((W - logoW) / 2);

        finalBuffer = await sharp(bgResized)
          .composite([
            { input: svgOverlay, top: 0, left: 0 },
            { input: productResized, top: productTop, left: productLeft },
            { input: logoResized, top: logoTop, left: logoLeft },
          ])
          .png()
          .toBuffer();
      } else {
        // CSS preset background: use SVG gradient
        finalBuffer = await renderAdWithSharp(svgContent, productImgBuffer, logoImgBuffer, template.id, W, H);
      }

      console.log(`[ImageCompositing] PNG rendered: ${(finalBuffer.length / 1024 / 1024).toFixed(1)}MB (SUCCESS)`);

      const { storagePut } = await import("../storage");
      const fileKey = `static-ads/${variationLabel.toLowerCase().replace(/\s+/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const { url } = await storagePut(fileKey, finalBuffer, "image/png");

      results.push({ url, variation: variationLabel });
      console.log(`[ImageCompositing] Image ${i + 1} DONE: ${url}`);
    } catch (err: any) {
      console.error(`[ImageCompositing] FAILED image ${i + 1} (${variationLabel}): ${err.message}`);
      console.error(`[ImageCompositing] Error stack:`, err.stack);
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
