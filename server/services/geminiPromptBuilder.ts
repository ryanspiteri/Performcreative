/**
 * Gemini Prompt Builder - Reference-Based Image Generation
 *
 * Builds prompts that instruct Gemini to study and replicate the style
 * of a reference image (competitor ad) whilst using new copy.
 *
 * Visual direction comes from the app-owned brief (visualDescription +
 * structured referenceFxPresent flag), not regex keyword matching on the
 * headline. The old analyseHeadline helper was removed because it auto-
 * injected "use fire / lightning / explosive energy" whenever a headline
 * contained "burn" or "power" — including brand names like "Hyperburn".
 */

import type { DetectedFxType, StyleMode } from "../../shared/iterationBriefSchema";

/** @deprecated kept only so legacy callers compile; risk level cut in UI in Day 4. */
export type CreativityLevel = "SAFE" | "BOLD" | "WILD";

export interface PromptBuildOptions {
  headline: string;
  subheadline?: string;
  productName: string;
  /** Short product key matching ACTIVE_PRODUCTS (e.g. "Hyperburn"). Used to look up the label spec. */
  productKey?: string;
  /** Selected flavour for label spec injection (e.g. "Mango"). Undefined when "Auto (Default)". */
  flavour?: string;
  /** @deprecated prefer visualDescription on the brief. Kept for fallback callers. */
  backgroundStyleDescription?: string;
  /** App-owned structured description of the variation's visual intent. Max 400 chars in v1 schema. */
  visualDescription?: string;
  /** True only when Stage 1 vision analysis actually detected dramatic FX in the reference ad. */
  referenceFxPresent?: boolean;
  /** Which FX types the reference ad uses (e.g. ["fire", "glow"]). Empty when clean/minimal. */
  detectedFxTypes?: DetectedFxType[];
  /** How tightly to hug the reference's visual language. */
  styleMode?: StyleMode;
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";
  targetAudience?: string;
  hasPersonReference?: boolean;
  /** When true, build a background-only prompt: Gemini generates the scene
      WITHOUT the product (sharp overlays the real product PNG in pass 2).
      The label-spec, style carve-out, and product integration sections are
      replaced with "leave a clear zone at <productPosition>" language. */
  compositingMode?: boolean;
  /** Where the product will be composited in pass 2. Tells Gemini where to
      leave clear space. Only used when compositingMode is true. */
  productPosition?: "center" | "left" | "right" | "bottom-center" | "bottom-left" | "bottom-right";
}

function compositingZoneDescription(position: string): string {
  switch (position) {
    case "center": return "the centre of the frame";
    case "left": return "the left side of the frame";
    case "right": return "the right side of the frame";
    case "bottom-center": return "the bottom-centre of the frame";
    case "bottom-left": return "the bottom-left of the frame";
    case "bottom-right": return "the bottom-right of the frame";
    default: return "the centre of the frame";
  }
}

// Label specs lift the tub description out of abstract ("preserve label, colour,
// cap, branding") into enumerated elements Gemini can match 1:1 against Image 2.
// Technique borrowed from a prompt that's been shown to reliably preserve the
// Hyperburn label across stylised scenes: name the wordmark, the subtext, the
// flavour strip, and the logo explicitly so the model can't hallucinate them.
//
// Keys match ACTIVE_PRODUCTS in drizzle/schema.ts. Products not in the map fall
// back to the generic preservation language. Add new products here as we dial
// them in — start narrow (Hyperburn is the first product the hypothesis targets).
const PRODUCT_LABEL_SPECS: Record<string, (flavour?: string) => string> = {
  Hyperburn: (flavour) => {
    const flavourClause = flavour
      ? `the "${flavour.toUpperCase()}" flavour label strip across the front`
      : `the flavour label strip across the front (exactly as shown in Image 2)`;
    return [
      `matte black tub with an orange graphic swoosh`,
      `bold white "HYPERBURN" wordmark`,
      `"ELITE THERMOGENIC" subtext beneath the wordmark`,
      flavourClause,
      `the ONEST "Z" logo positioned top-left`,
    ].join(", ");
  },
};

// Keywords that mean "this scene is stylised / non-photoreal." When ANY appear
// in the brief's visualDescription, we inject the product-is-photorealistic
// carve-out. Without it, Gemini defaults to stylising everything including
// the tub — which destroys small label text ("ELITE THERMOGENIC", flavour
// strips) because stylised small text is exactly Gemini's weakest output mode.
const STYLISED_SCENE_KEYWORDS = [
  "animated", "animation",
  "cartoon", "cartoony",
  "3d rendered", "3d-rendered", "cgi",
  "illustrated", "illustration",
  "painted", "painting",
  "hand-drawn", "hand drawn",
  "pixar", "disney", "studio ghibli",
  "stylised", "stylized",
  "anime", "manga",
  "sketch", "sketched",
  "watercolor", "watercolour",
];

function isStylisedScene(visualDescription: string | undefined): boolean {
  if (!visualDescription) return false;
  const lower = visualDescription.toLowerCase();
  return STYLISED_SCENE_KEYWORDS.some((kw) => lower.includes(kw));
}

function productPreservationBlock(productKey: string | undefined, flavour: string | undefined): string {
  const specFn = productKey ? PRODUCT_LABEL_SPECS[productKey] : undefined;
  if (specFn) {
    return `The ONEST ${productKey} tub in Image 2 is the ONLY acceptable product in your output. It MUST match Image 2 exactly — ${specFn(flavour)}. Do NOT redesign, restyle, reinterpret, or hallucinate any label element. Every word on the packaging, the colour, the graphic, and the logo must appear in your output exactly as they appear in Image 2. If you cannot preserve them faithfully, fail rather than fabricate. The product shown in Image 1 belongs to a different brand — treat it as invisible when deciding what product to render.`;
  }
  return `The ONEST bottle in Image 2 is the ONLY acceptable product in your output. Do NOT generate, redraw, restyle, or replace it. Preserve its label, colour, cap, and branding pixel-accurate. If you cannot, fail rather than fabricate. The product shown in Image 1 belongs to a different brand — treat it as invisible when deciding what product to render.`;
}

function stylisedSceneCarveoutBlock(): string {
  return `=== STYLE CARVE-OUT — PRODUCT STAYS PHOTOREALISTIC ===
The scene you are generating is stylised (animated / illustrated / rendered / non-photoreal). The PRODUCT in Image 2 is the ONE element that MUST remain photorealistic. Render the scene, character, environment, and props in the requested style, but composite the product tub in with unchanged photorealism — as if an actual product photograph was placed into the stylised scene. Do NOT stylise, cartoonify, or reinterpret the tub's label, wordmark, subtext, flavour strip, logo, or packaging material. Apply only lighting and shadow appropriate to the scene; everything else about the product must be 1:1 with Image 2.`;
}

function styleModeBlock(styleMode: StyleMode | undefined): string {
  switch (styleMode) {
    case "MATCH_REFERENCE":
      return `=== STYLE FIDELITY — MATCH REFERENCE ===
Treat Image 1's composition, colour palette, lighting, texture, and typographic style as LOCKED. Reproduce them as faithfully as you can while substituting the copy below and using the product render from Image 2. Do not introduce props, colours, or compositions that aren't present in Image 1.`;
    case "DEPART_FROM_REFERENCE":
      return `=== STYLE FIDELITY — DEPART FROM REFERENCE ===
Use Image 1 as a quality benchmark only. You may reinvent composition, lighting, and props. Still use the product render from Image 2. Still produce a coherent supplement ad that feels premium.`;
    case "EVOLVE_REFERENCE":
    default:
      return `=== STYLE FIDELITY — EVOLVE REFERENCE ===
Study Image 1 carefully and replicate its overall layout, text placement, colour palette, lighting, product placement, background style, typography hierarchy, and aesthetic. Vary only what the variation brief calls for. Someone should look at your output beside Image 1 and say "same campaign, different headline".`;
  }
}

function fxGuardrailBlock(
  referenceFxPresent: boolean | undefined,
  detectedFxTypes: DetectedFxType[] | undefined,
): string {
  const fxPresent = referenceFxPresent === true;
  const detected = (detectedFxTypes ?? []).filter((t) => t !== "none");
  if (fxPresent && detected.length > 0) {
    return `=== DRAMATIC EFFECTS ===
The reference ad uses these effects: ${detected.join(", ")}. You may use them when they fit the variation's visual description. Do NOT add other dramatic effects the reference does not use.`;
  }
  return `=== DRAMATIC EFFECTS — HARD RULE ===
The reference ad does NOT use dramatic effects. Do NOT add fire, flames, lightning, ice, smoke, sparks, explosions, or glowing auras. Treat "burn", "ignite", "power", "blast" in the product name or headline as metaphorical — they are brand language, NOT visual instructions. If the reference is clean and minimal, make this clean and minimal.`;
}

export function buildReferenceBasedPrompt(options: PromptBuildOptions): string {
  const {
    headline,
    subheadline,
    productName,
    productKey,
    flavour,
    backgroundStyleDescription,
    visualDescription,
    referenceFxPresent,
    detectedFxTypes,
    styleMode,
    aspectRatio = "1:1",
    hasPersonReference = false,
  } = options;

  const leadingVisual = (visualDescription && visualDescription.trim().length > 0)
    ? visualDescription.trim()
    : (backgroundStyleDescription && backgroundStyleDescription.trim().length > 0
        ? backgroundStyleDescription.trim()
        : "Clean, premium composition with the product as the clear focal point. Respect the reference ad's style.");

  const compositingMode = options.compositingMode === true;
  const productPosition = options.productPosition ?? "bottom-right";
  const zoneDesc = compositingZoneDescription(productPosition);

  const stylised = isStylisedScene(visualDescription);
  // In compositing mode, the product is overlaid in pass 2 — Gemini never
  // sees Image 2 and must NOT render any product. The HARD RULE inverts to
  // a "do not render product" instruction; style carve-out is unnecessary
  // (no product to stylise); product-integration block becomes a leave-zone
  // block. This is the reason the label can no longer hallucinate text.
  const productBlock = compositingMode
    ? `Do NOT render any product, tub, jar, bottle, container, supplement packaging, or branded product object in this image. The product will be composited on top of your output in a second pass using the actual product photograph. Your job is to generate the SCENE, BACKGROUND, CHARACTER, COPY, and ATMOSPHERE only — leaving a clear, unobstructed zone at ${zoneDesc} where the product will be overlaid.`
    : productPreservationBlock(productKey, flavour);
  const carveout = (compositingMode || !stylised) ? "" : `\n${stylisedSceneCarveoutBlock()}\n`;

  // Image list also changes in compositing mode — Pass 1 doesn't pass Image 2.
  const imageList = compositingMode
    ? `I am providing you with ${hasPersonReference ? 'TWO' : 'ONE'} image${hasPersonReference ? 's' : ''}:
- Image 1: A REFERENCE AD — use this for STYLE REFERENCE ONLY (layout, palette, mood, lighting, typography, composition). The product in Image 1 is NOT something you should render — ignore the product entirely.${hasPersonReference ? '\n- Image 2: A PERSON TYPE REFERENCE — generate a realistic person matching this general type/aesthetic (age range, build, style, energy). Do NOT copy the exact person. Create a new person with a similar look and place them naturally in the composition.' : ''}`
    : `I am providing you with ${hasPersonReference ? 'THREE' : 'TWO'} images:
- Image 1: A REFERENCE AD — use this for STYLE REFERENCE ONLY (layout, palette, mood, lighting, typography, composition). The product in Image 1 is NOT the product you are rendering.
- Image 2: The ONEST PRODUCT RENDER — this is the ONLY product to use in your output.${hasPersonReference ? '\n- Image 3: A PERSON TYPE REFERENCE — generate a realistic person matching this general type/aesthetic (age range, build, style, energy). Do NOT copy the exact person. Create a new, realistic person with a similar look and place them naturally in the ad composition.' : ''}`;

  const productIntegrationBlock = compositingMode
    ? `=== COMPOSITING ZONE (PASS 2 OVERLAY) ===
A real product photograph will be composited on top of your output at ${zoneDesc} in a second pass. Your job is to leave that area clear:
- Reserve roughly 35-45% of canvas width at ${zoneDesc} as an unobstructed zone.
- Do not place text, characters, props, or hands inside the zone.
- The zone should look natural in the scene — e.g. an empty kitchen counter, a clean stretch of floor, a clear patch of mirror — not a literal blank box.
- Lighting in the zone should match the rest of the scene so the composited product reads as belonging there.
- Cast a subtle direction-appropriate shadow region into the zone if the scene has consistent directional light, so the overlay receives realistic grounding.
NEVER render the product itself — even as a silhouette, placeholder, or implied shape. The zone stays empty until pass 2.`
    : `=== PRODUCT INTEGRATION ===
Integrate the ${productName} tub (from Image 2) into the scene following Image 1's approach:
- Floating vs grounded — match Image 1.
- Lighting, shadows, reflections — apply to the ONEST tub similarly to how Image 1 treats its product.
- Position (centre, left, right, offset) and prominence — match Image 1.
CRITICAL: Render the tub as if it was composited into the scene from a real product photograph${stylised ? ' — NOT stylised, NOT redesigned, NOT reinterpreted, even though the rest of the scene is stylised' : ''}. Every wordmark, subtext line, flavour strip, colour, and logo element on the packaging must appear in your output EXACTLY as it appears in Image 2. Do not obscure, alter, redraw, or hallucinate any label element. Do not invent a new product.`;

  const avoidList = compositingMode
    ? `=== AVOID ===
✗ Rendering ANY product, tub, jar, bottle, container, or supplement packaging
✗ Drawing a placeholder, silhouette, outline, or "ghost" shape where the product will go
✗ Filling the compositing zone with characters, hands, props, text, or scenery
✗ Adding fire, flames, lightning, ice, smoke, sparks, explosions, or glowing auras unless the reference ad uses them AND the Visual Description above calls for them
✗ Treating the product name (e.g., "Hyperburn", "Ignite") as a literal visual instruction — it is brand language
✗ Ignoring the reference image's style and creating something completely different
✗ Generic stock photo aesthetics (unless the reference uses that style)
✗ Text that's illegible, poorly contrasted, or hard to read
✗ Completely different colour palette from the reference`
    : `=== AVOID ===
✗ Adding fire, flames, lightning, ice, smoke, sparks, explosions, or glowing auras unless the reference ad uses them AND the Visual Description above calls for them
✗ Treating the product name (e.g., "Hyperburn", "Ignite") as a literal visual instruction — it is brand language
✗ Ignoring the reference image's style and creating something completely different
✗ Making it look like a different campaign or brand aesthetic
✗ Generic stock photo aesthetics (unless the reference uses that style)
✗ Obscuring the product label or branding
✗ Redrawing the product — always use the exact bottle from Image 2
✗ Text that's illegible, poorly contrasted, or hard to read
✗ Anything that looks "photoshopped" or artificially composited
✗ Completely different colour palette from the reference`;

  const prompt = `HARD RULE — PRODUCT ${compositingMode ? "ABSENCE" : "SOURCE"} (read before anything else):
${productBlock}

You are creating a premium supplement advertisement ${compositingMode ? "BACKGROUND" : "image"} for paid social media advertising (Meta/TikTok).

${imageList}

${styleModeBlock(styleMode)}
${carveout}
=== NEW COPY FOR THIS VERSION ===
Headline: "${headline}"${subheadline ? `\nSubheadline: "${subheadline}"` : ''}

Render the headline${subheadline ? ' and subheadline' : ''} in the SAME STYLE as the reference image (placement, size, typography, colour, effects). If the reference has text at the top, put it at the top. Replicate whatever text approach the reference uses.

=== VISUAL DESCRIPTION FOR THIS VARIATION ===
${leadingVisual}

${fxGuardrailBlock(referenceFxPresent, detectedFxTypes)}

${productIntegrationBlock}

=== COMPOSITION ===
- Aspect ratio: ${aspectRatio}
- Follow the same compositional approach as the reference (centred, rule of thirds, symmetrical, asymmetrical, etc.)
- Leave appropriate breathing room around text${compositingMode ? ` and the compositing zone at ${zoneDesc}` : ' and product'}
- Ensure nothing important is cut off at edges

${avoidList}

=== FINAL GOAL ===
Someone should look at your output and the reference image side-by-side and think: "These are clearly from the same campaign and brand — just with different headlines."`;

  return prompt;
}

// ─── Organic Photo Prompt Builder ────────────────────────────────────────

export interface OrganicPhotoPromptOptions {
  topic: string;
  pillar: string;
  purpose: string;
  product?: string;
  overlayProduct?: boolean;
  slideIndex?: number;
  totalSlides?: number;
  slideBrief?: string;
  headline?: string;
  body?: string;
  aspectRatio?: "1:1" | "4:5" | "9:16";
}

/** Map content pillars to visual language for lifestyle photos. */
const PILLAR_VISUALS: Record<string, string> = {
  "PTC Value": "Clean, educational layout. Think whiteboard-style clarity, product front and center, supporting data or ingredient highlights visible. Studio lighting, professional but approachable.",
  "Story": "Behind-the-scenes, authentic moments. Natural lighting, candid angles, real environments (kitchen, gym, office). Feels like a snapshot from someone's actual day.",
  "Edutaining": "Eye-catching, slightly playful composition. Bold colors, unexpected angles, visual hooks that make someone stop scrolling. Think infographic meets lifestyle photo.",
  "Trends": "Trendy, current aesthetic. Whatever's visually popular right now on Instagram/TikTok. Clean backgrounds, aesthetic color grading, minimal but impactful.",
  "Sale": "High-energy, promotional feel. Product prominent, bold visual treatment, urgency cues (stacking, multiples, lifestyle context showing value).",
  "Motivation": "Dramatic lighting, powerful composition. Sunrise/sunset tones, silhouettes, wide shots, epic scale. Feels aspirational and cinematic.",
  "Life Dump": "Casual, raw, unfiltered. Phone-camera aesthetic, messy-desk vibes, real life. Authenticity over production value. Warm, natural tones.",
  "Workout": "Gym environment, sweat, movement, energy. Dynamic angles, close-ups of effort, equipment in frame. High contrast, gritty texture, powerful.",
};

const PURPOSE_DIRECTION: Record<string, string> = {
  "Educate": "Composition should be clear and readable. Space for text overlays. The image teaches or informs.",
  "Inspire": "Evocative, emotional. The image should make someone feel something before they read any text.",
  "Entertain": "Fun, surprising, scroll-stopping. Unexpected composition or subject matter.",
  "Sell": "Product-forward. The item should be the hero of the image, shown in its best light.",
  "Connect": "Human, relatable, intimate. Close-ups, eye contact, shared moments. Feels personal.",
};

/**
 * Build a Gemini prompt for organic lifestyle/editorial photos.
 * Distinct from ad prompts: no competitor references, no heavy text overlays.
 */
export function buildOrganicPhotoPrompt(options: OrganicPhotoPromptOptions): string {
  const {
    topic,
    pillar,
    purpose,
    product,
    overlayProduct = false,
    slideIndex,
    totalSlides,
    slideBrief,
    headline,
    body,
    aspectRatio = "1:1",
  } = options;

  const pillarVisual = PILLAR_VISUALS[pillar] || PILLAR_VISUALS["Trends"];
  const purposeDir = PURPOSE_DIRECTION[purpose] || PURPOSE_DIRECTION["Inspire"];

  const isCarousel = totalSlides != null && totalSlides > 1;
  const slideContext = isCarousel
    ? `\nThis is slide ${(slideIndex ?? 0) + 1} of ${totalSlides} in a carousel post. Maintain visual consistency with other slides (same color palette, lighting style, aspect ratio) while varying the specific subject/angle for this slide.`
    : "";

  const briefSection = slideBrief
    ? `\n=== SLIDE BRIEF ===\n${slideBrief}\nFollow this brief for the visual concept and mood of this specific image.\n`
    : "";

  const headlineSection = headline
    ? `\nIf text overlay is appropriate, the headline is: "${headline}"${body ? `\nSupporting text: "${body}"` : ""}\nKeep text minimal and clean. This is organic content, not an ad.`
    : "\nDo NOT add text overlays. This is a visual-only image.";

  const productSection = overlayProduct && product
    ? `\n=== PRODUCT INTEGRATION ===
I am providing a product render image. Integrate the ${product} product naturally into the scene.
Do NOT make it look like an advertisement. The product should feel like it belongs in the environment,
like someone placed it on a counter, is holding it mid-workout, or it's sitting in a gym bag.
Preserve the product label and branding. Make it visible but not the sole focus unless the content
pillar calls for it (e.g., "Sale" or "PTC Value" pillars should feature product prominently).`
    : overlayProduct
    ? "\nNote: Product overlay requested but no product specified. Generate the scene without a product."
    : "\nDo NOT include any product in this image. Pure lifestyle/editorial content.";

  return `You are generating an organic social media photo for Instagram/TikTok.

This is NOT an advertisement. It's authentic content for a personal brand in the health and fitness space.
The image should look like high-quality content a fitness influencer would post, not a corporate ad.

=== TOPIC ===
${topic}

=== VISUAL DIRECTION (Content Pillar: ${pillar}) ===
${pillarVisual}

=== CREATIVE DIRECTION (Purpose: ${purpose}) ===
${purposeDir}
${slideContext}${briefSection}${headlineSection}${productSection}

=== COMPOSITION ===
- Aspect ratio: ${aspectRatio}
- High resolution, crisp detail
- Professional but authentic (not stock-photo sterile)
- Color grading should match the pillar's mood

=== AVOID ===
✗ Corporate/stock photo aesthetic
✗ Heavy promotional text overlays
✗ Fake or plastic-looking scenes
✗ Generic fitness imagery (e.g., random dumbbells on white background)
✗ Anything that looks AI-generated or uncanny
✗ Cluttered composition — keep it clean and intentional

=== GOAL ===
Someone scrolling Instagram should think: "That's a great photo" — not "That's an ad."
The image should feel intentional, editorial, and on-brand for a fitness entrepreneur.`;
}
