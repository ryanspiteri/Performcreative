/**
 * Gemini Prompt Builder - Reference-Based Image Generation
 * 
 * Builds prompts that instruct Gemini to study and replicate the style
 * of a reference image (competitor ad) whilst using new copy.
 */

export type CreativityLevel = "SAFE" | "BOLD" | "WILD";

export interface HeadlineAnalysis {
  corePromise: string; // What transformation/benefit is claimed?
  emotionalHook: string; // What feeling should this trigger?
  targetAvatar: string; // Who is this speaking to specifically?
  visualConceptDescription: string; // Description of visual metaphor to use
}

export interface PromptBuildOptions {
  headline: string;
  subheadline?: string;
  productName: string;
  backgroundStyleDescription: string; // From user's selected background concept
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";
  targetAudience?: string;
}

/**
 * Analyse headline to extract creative strategy
 */
export function analyseHeadline(headline: string, productName: string, targetAudience?: string): HeadlineAnalysis {
  const lowerHeadline = headline.toLowerCase();
  
  // Detect transformation claims
  const hasTransformation = /transform|change|from.*to|become|turn into|shape|sculpt/i.test(headline);
  const hasTime = /week|day|month|hour|24\/7|fast|quick|rapid|around the clock/i.test(headline);
  const hasSupport = /help|support|boost|enhance|improve/i.test(headline);
  const hasPower = /power|energy|burn|blast|ignite|unleash|unlock/i.test(headline);
  const hasCravings = /cravings|hunger|appetite|temptation/i.test(headline);
  const hasEnd = /end|stop|eliminate|destroy|crush/i.test(headline);
  
  // Build analysis
  const analysis: HeadlineAnalysis = {
    corePromise: "",
    emotionalHook: "",
    targetAvatar: targetAudience || "fitness enthusiast aged 25-45",
    visualConceptDescription: "",
  };
  
  // Determine core promise, emotional hook, and visual concept
  if (hasTransformation) {
    analysis.corePromise = "Body transformation, visible physical change";
    analysis.emotionalHook = "Hope and belief - 'this could actually work for me'";
    analysis.visualConceptDescription = "Use visual metaphors showing transformation or progression (e.g., contrasting elements, before→after symbolism, metamorphosis imagery). The visual should suggest change and evolution.";
  } else if ((hasPower || lowerHeadline.includes("burn")) && hasTime) {
    analysis.corePromise = "24/7 metabolic power, continuous fat burning";
    analysis.emotionalHook = "Excitement and empowerment - 'This works even while I sleep'";
    analysis.visualConceptDescription = "Use fire or energy effects combined with time-based visual elements (clocks, 24/7 symbolism). Fire represents thermogenic burning, time elements represent continuous effect. Create dramatic, powerful imagery suggesting relentless fat-burning power.";
  } else if (hasPower || lowerHeadline.includes("burn")) {
    analysis.corePromise = "Metabolic power, fat burning, energy boost";
    analysis.emotionalHook = "Excitement and empowerment - 'I'll feel unstoppable'";
    analysis.visualConceptDescription = "Use fire, lightning, or explosive energy effects. The product should feel like a power source with dramatic lighting and atmospheric effects. Create bold, energetic imagery suggesting immediate metabolic ignition.";
  } else if ((hasCravings || lowerHeadline.includes("craving")) && hasEnd) {
    analysis.corePromise = "Appetite suppression, craving elimination, hunger control";
    analysis.emotionalHook = "Empowerment and relief - 'I can finally control my cravings'";
    analysis.visualConceptDescription = "Use fire or destructive imagery to represent 'ending' or 'eliminating' cravings. Fire can symbolize burning away temptation. Create powerful, liberating imagery suggesting freedom from hunger and cravings.";
  } else if (hasSupport) {
    analysis.corePromise = "Support and assistance in achieving goals";
    analysis.emotionalHook = "Relief and confidence - 'I'm not alone in this'";
    analysis.visualConceptDescription = "Use supportive visual elements or foundation imagery. The product should feel like a reliable partner. Create confident, reassuring imagery suggesting dependable support.";
  } else if (hasTime) {
    analysis.corePromise = "Fast results, time-efficient transformation";
    analysis.emotionalHook = "Urgency and FOMO - 'I can't wait to start'";
    analysis.visualConceptDescription = "Include clock, hourglass, or time-based visual elements. Use motion or speed effects to suggest rapid change. Create urgent, dynamic imagery suggesting quick results.";
  } else {
    // Generic/fallback analysis
    analysis.corePromise = "Premium supplement for fitness and health goals";
    analysis.emotionalHook = "Aspiration and desire - 'I want to be my best self'";
    analysis.visualConceptDescription = "Create premium, aspirational imagery with dramatic lighting and atmospheric effects. The product should feel high-quality and results-driven.";
  }
  
  return analysis;
}

/**
 * Build reference-based Gemini prompt
 * 
 * This prompt instructs Gemini to study the reference image and create
 * a new version that matches its style whilst using new copy.
 */
export function buildReferenceBasedPrompt(options: PromptBuildOptions): string {
  const {
    headline,
    subheadline,
    productName,
    backgroundStyleDescription,
    aspectRatio = "1:1",
    targetAudience,
  } = options;
  
  // Analyse headline to extract creative strategy
  const analysis = analyseHeadline(headline, productName, targetAudience);
  
  // Build prompt
  const prompt = `You are creating a premium supplement advertisement image for paid social media advertising (Meta/TikTok).

I am providing you with TWO images:
- Image 1: A REFERENCE AD (competitor ad) — use this for STYLE REFERENCE ONLY
- Image 2: The ONEST PRODUCT RENDER — this is the ONLY product to use in your output

STUDY Image 1 carefully and replicate its:
- Overall layout and composition
- Text placement, size, and styling approach
- Color palette and mood
- Lighting style and direction
- Product placement approach (floating, grounded, centered, offset, etc.)
- Background style and depth
- Visual effects and overlays
- Typography hierarchy
- Overall aesthetic and vibe

Your goal is to create a NEW version of this ad for ${productName} that MATCHES the visual style of Image 1 whilst using the new copy below and integrating the ONEST product from Image 2.

=== NEW COPY FOR THIS VERSION ===
Headline: "${headline}"${subheadline ? `\nSubheadline: "${subheadline}"` : ''}

Render the headline${subheadline ? ' and subheadline' : ''} in the SAME STYLE as the reference image:
- Match the text placement from the reference (top, center, bottom, overlaying product, etc.)
- Match the text size proportions from the reference
- Match the typography style (bold/regular, uppercase/mixed case, font weight) from the reference
- Match the text color and effects (stroke, shadow, glow, outline) from the reference
- If the reference has text at the top, put it at the top
- If the reference has text overlaying the product, do the same
- Replicate whatever text approach the reference uses

=== VISUAL CONCEPT ===
${analysis.visualConceptDescription}

This concept should create a visual metaphor that supports the headline claim: ${analysis.corePromise}

The background and composition should trigger this emotional response: ${analysis.emotionalHook}

=== BACKGROUND & ATMOSPHERE ===
${backgroundStyleDescription}

The background should:
- Match the mood and energy level of the reference image
- Use a similar approach to color, lighting, and depth
- Create similar visual impact and drama
- Include visual elements that support the headline concept described above

=== PRODUCT INTEGRATION ===
CRITICAL — PRODUCT SOURCE RULE:
You MUST use ONLY Image 2 (the ONEST product render) as the product in your output.
Do NOT copy, replicate, or draw the product shown in Image 1 (the reference ad). That is a different brand — treat it as invisible when it comes to the product itself. Only use Image 1 for style, layout, composition, and atmosphere reference.

Integrate the ${productName} bottle (from Image 2) into the scene following the same approach as Image 1:
- Is the product in Image 1 floating or grounded? Match that approach for the ONEST bottle.
- How do background elements interact with the product in Image 1 (wrapping around, behind, in front)? Replicate that relationship with the ONEST bottle.
- What lighting effects are used on the product in Image 1? Apply similar lighting to the ONEST bottle.
- Are there shadows, reflections, or depth cues in Image 1? Add similar effects to the ONEST bottle.
- How prominent is the product in Image 1? Match that prominence level.
- Where is the product positioned in Image 1 (center, left, right, offset)? Use similar positioning for the ONEST bottle.

CRITICAL: The product label and branding on the ONEST bottle (Image 2) must be preserved and clearly visible. Do not obscure, alter, or redraw the product's existing design. Do not invent a new product — use the exact bottle from Image 2.

=== QUALITY STANDARDS ===
- Match the production quality of the reference image
- If the reference looks premium and cinematic, make this premium and cinematic
- If the reference is bold and dramatic, make this bold and dramatic
- If the reference is clean and minimal, make this clean and minimal
- Replicate the "vibe" and energy level of the reference whilst telling a new story with the new headline

=== COMPOSITION ===
- Aspect ratio: ${aspectRatio}
- Follow the same compositional approach as the reference (centered, rule of thirds, symmetrical, asymmetrical, etc.)
- Maintain similar visual hierarchy: study what the eye sees first in the reference and replicate that priority
- Leave appropriate breathing room around text and product
- Ensure nothing important is cut off at edges
- Balance the frame similarly to how the reference balances its elements

=== AVOID ===
✗ Ignoring the reference image's style and creating something completely different
✗ Making it look like a different campaign or brand aesthetic
✗ Generic stock photo aesthetics (unless the reference uses that style)
✗ Obscuring the product label or branding
✗ Text that's illegible, poorly contrasted, or hard to read
✗ Anything that looks "photoshopped" or artificially composited
✗ Completely different color palette from the reference
✗ Different mood or energy level from the reference

=== FINAL GOAL ===
Someone should look at your output and the reference image side-by-side and think:
"These are clearly from the same campaign/brand/style - just with different headlines"

The new version should feel like a natural variation of the reference, not a completely different creative direction. Match the reference's aesthetic whilst bringing the new headline to life visually.`;

  return prompt;
}

/**
 * Example usage:
 * 
 * const prompt = buildReferenceBasedPrompt({
 *   headline: "THIS IS THE END OF CRAVINGS",
 *   subheadline: undefined,
 *   productName: "ONEST Health Hyperburn",
 *   backgroundStyleDescription: "Dramatic fire and flames in warm orange, red, and yellow tones against dark background. Embers, sparks, and smoke particles creating atmospheric depth.",
 *   aspectRatio: "1:1",
 *   targetAudience: "35-year-old busy mum struggling with cravings"
 * });
 * 
 * Then call Gemini API with:
 * - The prompt above
 * - Reference image (competitor ad) as inline data
 * - Product render as inline data
 */

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
