/**
 * Gemini Prompt Builder - Enhanced prompt system for $100m-scale winning creatives
 * 
 * Analyses headlines and builds scroll-stopping, audience-specific prompts
 * that create visual metaphors and emotional hooks.
 */

export type CreativityLevel = "SAFE" | "BOLD" | "WILD";

export interface HeadlineAnalysis {
  corePromise: string; // What transformation/benefit is claimed?
  emotionalHook: string; // What feeling should this trigger?
  targetAvatar: string; // Who is this speaking to specifically?
  visualConcepts: string[]; // 2-3 creative directions
  patternInterrupt: string; // What unexpected element would make this stand out?
}

export interface PromptBuildOptions {
  headline: string;
  subheadline?: string;
  productName: string;
  backgroundStyle?: string;
  creativityLevel: CreativityLevel;
  targetAudience?: string; // e.g., "35-year-old busy mum", "25-year-old gym bro"
}

/**
 * Analyse headline to extract creative strategy
 */
export function analyseHeadline(headline: string, productName: string, targetAudience?: string): HeadlineAnalysis {
  // Extract key concepts from headline
  const lowerHeadline = headline.toLowerCase();
  
  // Detect transformation claims
  const hasTransformation = /transform|change|from.*to|become|turn into|shape|sculpt/i.test(headline);
  const hasTime = /week|day|month|hour|24\/7|fast|quick|rapid/i.test(headline);
  const hasSupport = /help|support|boost|enhance|improve/i.test(headline);
  const hasPower = /power|energy|burn|blast|ignite|unleash|unlock/i.test(headline);
  const hasSpeed = /fast|quick|rapid|instant|immediate/i.test(headline);
  
  // Build analysis
  const analysis: HeadlineAnalysis = {
    corePromise: "",
    emotionalHook: "",
    targetAvatar: targetAudience || "fitness enthusiast aged 25-45",
    visualConcepts: [],
    patternInterrupt: "",
  };
  
  // Determine core promise and emotional hook
  if (hasTransformation) {
    analysis.corePromise = "Body transformation, visible physical change";
    analysis.emotionalHook = "Hope and belief - 'this could actually work for me'";
    analysis.visualConcepts = [
      "Use visual metaphors showing before→after progression (e.g., apple→hourglass, caterpillar→butterfly)",
      "Show transformation through contrasting elements or split composition",
      "Use time-lapse visual effects suggesting change over time",
    ];
    analysis.patternInterrupt = "Literal object metaphors are unexpected in supplement ads - they're bold, clear, and memorable";
  } else if (hasPower || lowerHeadline.includes("burn")) {
    analysis.corePromise = "Metabolic power, fat burning, energy boost";
    analysis.emotionalHook = "Excitement and empowerment - 'I'll feel unstoppable'";
    analysis.visualConcepts = [
      "Use fire, lightning, or explosive energy effects around the product",
      "Show the product as a power source with radiating energy",
      "Include visual metaphors of ignition or combustion (match lighting, engine starting)",
    ];
    analysis.patternInterrupt = "Dramatic energy effects make the product feel powerful and immediate";
  } else if (hasSupport) {
    analysis.corePromise = "Support and assistance in achieving goals";
    analysis.emotionalHook = "Relief and confidence - 'I'm not alone in this'";
    analysis.visualConcepts = [
      "Use helping hand or support structure metaphors",
      "Show the product as a foundation or pillar",
      "Include visual elements suggesting partnership or teamwork",
    ];
    analysis.patternInterrupt = "Humanising the product as a supportive partner rather than just a supplement";
  } else if (hasTime) {
    analysis.corePromise = "Fast results, time-efficient transformation";
    analysis.emotionalHook = "Urgency and FOMO - 'I can't wait to start'";
    analysis.visualConcepts = [
      "Include clock, hourglass, or calendar visual elements",
      "Use motion blur or speed lines to suggest rapid change",
      "Show compressed timeline visually (e.g., seasons changing quickly)",
    ];
    analysis.patternInterrupt = "Time-based visual metaphors create urgency and make claims feel concrete";
  } else {
    // Generic/fallback analysis
    analysis.corePromise = "Premium supplement for fitness and health goals";
    analysis.emotionalHook = "Aspiration and desire - 'I want to be my best self'";
    analysis.visualConcepts = [
      "Premium fitness environment with dramatic lighting",
      "Product as the hero with subtle atmospheric effects",
      "Clean, aspirational composition suggesting quality and results",
    ];
    analysis.patternInterrupt = "Premium aesthetic stands out from generic supplement ads";
  }
  
  return analysis;
}

/**
 * Build creativity-level specific guidelines
 */
function getCreativityGuidelines(level: CreativityLevel): string {
  switch (level) {
    case "SAFE":
      return `
CREATIVITY LEVEL: SAFE (Proven Patterns)
- Use established visual metaphors that have worked before
- Maintain premium but familiar aesthetic
- Focus on clear, obvious visual storytelling
- Avoid controversial or polarising elements
- Keep composition clean and professional
- Lower risk, proven to convert`;
      
    case "BOLD":
      return `
CREATIVITY LEVEL: BOLD (Unexpected Concepts)
- Use surprising visual metaphors that haven't been seen before
- Push creative boundaries whilst maintaining brand integrity
- Create "wait, what?" moments that demand attention
- Balance unexpected elements with premium feel
- Higher upside potential, moderate risk`;
      
    case "WILD":
      return `
CREATIVITY LEVEL: WILD (Moonshot Potential)
- Use controversial, polarising, or provocative visual concepts
- Break all conventional supplement ad rules
- Create strong reactions (love it or hate it)
- Prioritise scroll-stopping power over universal appeal
- Highest upside potential, highest risk
- May alienate some viewers but deeply resonate with others`;
  }
}

/**
 * Build enhanced Gemini prompt for scroll-stopping product ads
 */
export function buildEnhancedPrompt(options: PromptBuildOptions): string {
  const {
    headline,
    subheadline,
    productName,
    backgroundStyle,
    creativityLevel,
    targetAudience,
  } = options;
  
  // Analyse headline
  const analysis = analyseHeadline(headline, productName, targetAudience);
  
  // Build prompt sections
  const sections: string[] = [];
  
  // Opening hook
  sections.push(
    `Create a SCROLL-STOPPING product advertisement for this ${productName} supplement that would make a ${analysis.targetAvatar} immediately stop scrolling and feel compelled to learn more.`
  );
  
  // Headline and emotional goal
  sections.push(
    `\nHEADLINE: "${headline}"${subheadline ? `\nSUBHEADLINE: "${subheadline}"` : ""}\nEMOTIONAL GOAL: Make them feel ${analysis.emotionalHook}`
  );
  
  // Visual strategy
  sections.push(
    `\nVISUAL STRATEGY:\nThe image must achieve THREE goals simultaneously:\n1. STOP THE SCROLL - Create immediate visual intrigue or pattern interrupt\n2. SUPPORT THE CLAIM - Visually prove/demonstrate the headline promise: ${analysis.corePromise}\n3. TRIGGER DESIRE - Make them imagine themselves achieving the result`
  );
  
  // Hero concept (select best visual concept based on creativity level)
  const conceptIndex = creativityLevel === "SAFE" ? 0 : creativityLevel === "BOLD" ? 1 : 2;
  const selectedConcept = analysis.visualConcepts[conceptIndex] || analysis.visualConcepts[0];
  
  sections.push(
    `\nHERO CONCEPT:\n${selectedConcept}`
  );
  
  // Composition rules
  sections.push(
    `\nCOMPOSITION:\n- ${productName} bottle as the hero element, prominently displayed in centre\n- Use visual metaphors, props, or environmental storytelling to amplify emotional impact\n- Create depth and visual interest - avoid flat, boring product shots\n- Include unexpected elements that create curiosity\n- ${backgroundStyle || "Dramatic lighting with premium aesthetic"}\n- The product label and branding must be preserved exactly as shown`
  );
  
  // Creativity level guidelines
  sections.push(getCreativityGuidelines(creativityLevel));
  
  // Winning creative principles
  sections.push(
    `\nWINNING CREATIVE PRINCIPLES:\n✓ Bold, confident, slightly unexpected\n✓ Creates immediate curiosity or emotional response\n✓ Feels premium but relatable (not sterile/clinical)\n✓ Has a clear "hero moment" - one dominant visual idea\n✓ Would stand out in a feed of generic supplement ads\n✓ Makes the benefit feel tangible and achievable`
  );
  
  // Avoid list
  sections.push(
    `\nAVOID:\n✗ Generic stock photo aesthetics\n✗ Cluttered compositions with too many elements\n✗ Cliché fitness imagery (dumbbells, tape measures, scales) unless specifically relevant\n✗ Anything that looks "try-hard" or desperate\n✗ Sterile lab/medical vibes unless specifically needed`
  );
  
  // Pattern interrupt
  sections.push(
    `\nPATTERN INTERRUPT:\n${analysis.patternInterrupt}`
  );
  
  // Closing
  sections.push(
    `\nThe final image should make someone think "I've never seen a supplement ad like this before" whilst still feeling premium and trustworthy. No people in shot. Clean, professional composition that would make someone stop mid-scroll.`
  );
  
  return sections.join("\n");
}

/**
 * Example usage:
 * 
 * const prompt = buildEnhancedPrompt({
 *   headline: "From Apple Shaped to Hour Glass in Weeks",
 *   subheadline: "Transform your body composition",
 *   productName: "ONEST Health Hyperburn",
 *   backgroundStyle: "Warm amber lighting with soft background blur",
 *   creativityLevel: "BOLD",
 *   targetAudience: "35-year-old busy mum who's frustrated with midsection weight"
 * });
 */
