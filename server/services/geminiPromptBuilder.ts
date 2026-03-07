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
