import * as db from "../db";
import { LOGOS } from "../config/brandAssets";
import { generateFluxProBackground } from "./fluxPro";
import { generateStaticAdWithBannerbear, BANNERBEAR_TEMPLATES } from "./bannerbear";

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
      type: "uploaded" | "preset" | "flux";
      url?: string;
      presetId?: string;
      title: string;
      description?: string;
      prompt?: string;
    };
  }>;
  benefits: string;
  productRenderUrl?: string;
  bannerbearTemplate?: string; // Optional: specific Bannerbear template UID
}

// ============================================================
// CSS BACKGROUND PRESETS — kept for backwards compatibility
// ============================================================
export const CSS_PRESETS: Array<{
  id: string;
  name: string;
  category: string;
  css: string;
  thumbnail: string;
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
];

// Bannerbear template rotation — alternate between templates for variety
const TEMPLATE_ROTATION = [
  BANNERBEAR_TEMPLATES.hyperburnHelps,
  BANNERBEAR_TEMPLATES.bluePurpleGradient,
  BANNERBEAR_TEMPLATES.hyperburnHelps,
];

// ============================================================
// MAIN ENTRY POINT — Flux Pro + Bannerbear Pipeline
// ============================================================

export async function generateStaticAdVariations(
  creativeBrief: string,
  inspireImageUrl: string,
  product: string,
  brandName: string,
  selections?: ImageSelections,
  teamFeedback?: string
): Promise<CompositeResult[]> {
  console.log("[ImageCompositing] Starting ad creative generation (3 variations, Flux Pro + Bannerbear)");

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

  // Build per-image config from selections or fallback
  const imageConfigs = buildImageConfigs(selections, creativeBrief, product, teamFeedback);

  const results: CompositeResult[] = [];

  for (let i = 0; i < 3; i++) {
    const config = imageConfigs[i];
    const variationLabel = i === 0 ? "Control" : `Variation ${i + 1}`;

    try {
      console.log(`[ImageCompositing] === Image ${i + 1}/3: ${variationLabel} ===`);
      console.log(`[ImageCompositing] Headline: "${config.headline}"`);
      console.log(`[ImageCompositing] Background: ${config.background.type} - ${config.background.title}`);

      // ---- STEP 1: Get or generate background image ----
      let backgroundImageUrl: string;

      if (config.background.type === "uploaded" && config.background.url) {
        // User uploaded their own background
        backgroundImageUrl = config.background.url;
        console.log(`[ImageCompositing] Using uploaded background: ${backgroundImageUrl.substring(0, 80)}...`);
      } else if (config.background.prompt) {
        // Generate background with Flux Pro
        console.log(`[ImageCompositing] Generating background with Flux Pro...`);
        console.log(`[ImageCompositing] Prompt: "${config.background.prompt.substring(0, 120)}..."`);

        backgroundImageUrl = await generateFluxProBackground(
          config.background.prompt,
          1088,
          1088
        );
        console.log(`[ImageCompositing] Flux Pro background generated: ${backgroundImageUrl.substring(0, 80)}...`);

        // Download and re-upload to S3 for permanent storage (Flux URLs expire in 10 min)
        backgroundImageUrl = await persistFluxImage(backgroundImageUrl, variationLabel);
      } else {
        // Fallback: generate a default background with Flux Pro
        const defaultPrompt = `Premium dark background for health supplement advertisement. Deep charcoal black base (#01040A) with dramatic ${i === 0 ? "crimson red (#FF3838)" : i === 1 ? "electric blue (#0347ED)" : "warm amber"} accent lighting. Subtle atmospheric effects, premium fitness aesthetic. No text, no product, no logos, no people.`;
        backgroundImageUrl = await generateFluxProBackground(defaultPrompt, 1088, 1088);
        backgroundImageUrl = await persistFluxImage(backgroundImageUrl, variationLabel);
      }

      // ---- STEP 2: Composite with Bannerbear ----
      console.log(`[ImageCompositing] Compositing with Bannerbear...`);

      // Select Bannerbear template — use user selection, rotation, or default
      const templateUid = selections?.bannerbearTemplate || TEMPLATE_ROTATION[i];

      const finalImageUrl = await generateStaticAdWithBannerbear({
        templateUid,
        headline: config.headline,
        subheadline: config.subheadline || undefined,
        benefitCallout: config.benefits,
        backgroundImageUrl,
        productRenderUrl,
        logoUrl,
      });

      results.push({ url: finalImageUrl, variation: variationLabel });
      console.log(`[ImageCompositing] Image ${i + 1} DONE: ${finalImageUrl}`);
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
// HELPER: Persist Flux Pro image to S3 (their URLs expire in 10 min)
// ============================================================
async function persistFluxImage(fluxUrl: string, label: string): Promise<string> {
  try {
    console.log(`[ImageCompositing] Persisting Flux image to S3...`);
    const resp = await fetch(fluxUrl);
    if (!resp.ok) throw new Error(`Failed to download Flux image: ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());

    const { storagePut } = await import("../storage");
    const fileKey = `flux-backgrounds/${label.toLowerCase().replace(/\s+/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { url } = await storagePut(fileKey, buffer, "image/jpeg");
    console.log(`[ImageCompositing] Persisted to S3: ${url}`);
    return url;
  } catch (err: any) {
    console.warn(`[ImageCompositing] Failed to persist Flux image, using original URL: ${err.message}`);
    return fluxUrl; // Fall back to the temporary URL
  }
}

// ============================================================
// HELPER: Build image configs from selections or fallback
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

  // Fallback: use Flux Pro generation prompts
  return [
    {
      headline: `FUEL YOUR ${product.toUpperCase()}`,
      subheadline: "Premium Australian Formulation",
      benefits: "Burn Fat | Boost Energy | Crush Cravings",
      background: {
        type: "flux" as const,
        title: "Dark Energy",
        prompt: "Premium dark background for health supplement advertisement. Deep charcoal black base with dramatic crimson red accent lighting from the right side. Subtle smoke particles floating. Warm amber rim light. Energy and power aesthetic. Gym atmosphere with dark moody lighting. Subtle texture grain. No text, no product, no logos, no people.",
      },
    },
    {
      headline: `UNLOCK ${product.toUpperCase()} POWER`,
      subheadline: "Trusted by Athletes",
      benefits: "Clinically Dosed | Science-Backed | No Fillers",
      background: {
        type: "flux" as const,
        title: "Electric Blue",
        prompt: "Bold energetic background for supplement ad. Deep navy to black gradient. Electric blue accent lighting from below creating upward glow. Geometric angular light rays suggesting speed and power. Cool-toned base with warm crimson highlight accents at edges. Subtle particle effects. Premium fitness aesthetic. No text, no product, no logos, no people.",
      },
    },
    {
      headline: `${product.toUpperCase()} REDEFINED`,
      subheadline: "No Compromises",
      benefits: "Premium Ingredients | Real Results | Australian Made",
      background: {
        type: "flux" as const,
        title: "Minimal Premium",
        prompt: "Minimalist premium dark background for supplement ad. Sophisticated matte black texture. Soft warm spotlight from above creating a centered gradient pool of light. Clean and refined with minimal effects. Subtle surface texture. Premium luxury supplement aesthetic. Soft vignette at edges. No text, no product, no logos, no people.",
      },
    },
  ];
}
