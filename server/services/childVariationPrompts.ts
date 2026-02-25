/**
 * Child Variation Prompt Builder
 * 
 * Generates prompts for creating tactical variations of parent images.
 * Each child maintains the same strategic direction (headline, concept) but
 * varies tactical elements (color, lighting, layout, etc.)
 */

export type ChildVariationType = 
  | "color_shift"
  | "lighting_variation"
  | "typography_tweak"
  | "product_angle"
  | "background_intensity"
  | "layout_adjustment"
  | "effect_intensity";

export interface ChildVariationOptions {
  parentImageUrl: string; // URL of the parent image to vary
  variationType: ChildVariationType;
  productName: string;
  headline: string;
  subheadline?: string;
  aspectRatio?: string;
}

/**
 * Build prompt for creating a child variation
 * 
 * The prompt instructs Gemini to create a variation of the parent image
 * with only the specified tactical change, keeping everything else the same.
 */
export function buildChildVariationPrompt(options: ChildVariationOptions): string {
  const {
    variationType,
    productName,
    headline,
    subheadline,
    aspectRatio = "1:1",
  } = options;

  const baseInstruction = `You are creating a TACTICAL VARIATION of the provided parent image.

CRITICAL: This is NOT a new creative. This is a variation of an existing image with ONE specific tactical change.

=== PARENT IMAGE ===
I am providing the parent image that you must use as your base reference.

=== WHAT TO KEEP EXACTLY THE SAME ===
- Headline: "${headline}"${subheadline ? `\n- Subheadline: "${subheadline}"` : ''}
- Product: ${productName} (same position, same angle, same prominence)
- Overall composition and layout
- Background concept and theme
- Visual metaphors and storytelling elements
- Text placement and hierarchy
- General mood and energy level

=== WHAT TO CHANGE ===
`;

  let variationInstructions = "";

  switch (variationType) {
    case "color_shift":
      variationInstructions = `COLOR PALETTE SHIFT:
- Change the color temperature or palette whilst keeping the same composition
- Examples:
  * Warm (orange/red) → Cool (blue/purple)
  * Saturated → Desaturated/muted
  * Bright → Dark/moody
  * Single dominant color → Complementary color
- Keep the same lighting direction and intensity
- Keep the same contrast levels
- The shift should feel intentional, not random
- Product label colors must remain accurate`;
      break;

    case "lighting_variation":
      variationInstructions = `LIGHTING DIRECTION/INTENSITY:
- Change how the scene is lit whilst keeping the same composition
- Examples:
  * Front lighting → Side lighting or back lighting
  * Soft diffused → Hard dramatic shadows
  * Single light source → Multiple light sources
  * Bright → Dim/atmospheric
  * Warm lighting → Cool lighting
- Keep the same color palette
- Keep the same background elements
- The lighting should create a different mood but same energy level`;
      break;

    case "typography_tweak":
      variationInstructions = `TYPOGRAPHY ADJUSTMENTS:
- Modify text styling whilst keeping the same words and general placement
- Examples:
  * Bold → Extra bold or medium weight
  * Larger text → Smaller text (but still legible)
  * Tighter letter spacing → Wider letter spacing
  * Different stroke thickness on text outline
  * Text slightly repositioned (e.g., top-center → top-left)
- Keep the same headline and subheadline text
- Keep the same color palette and lighting
- Keep the same background and product
- Text must remain highly legible`;
      break;

    case "product_angle":
      variationInstructions = `PRODUCT POSITIONING:
- Adjust the product bottle's position or angle whilst keeping the same scene
- Examples:
  * Rotate product 15-30° left or right
  * Tilt product forward or backward slightly
  * Move product slightly left/right/up/down in frame
  * Change product size (slightly larger or smaller)
- Keep the same background, lighting, and color palette
- Keep the same text and typography
- Product label must remain visible and legible
- Product should still feel naturally integrated into the scene`;
      break;

    case "background_intensity":
      variationInstructions = `BACKGROUND EFFECT INTENSITY:
- Dial the background effects up or down whilst keeping the same concept
- Examples:
  * Subtle fire → Raging inferno (or vice versa)
  * Few particles → Dense particle field (or vice versa)
  * Minimal smoke → Heavy atmospheric smoke (or vice versa)
  * Clean background → Busier background (or vice versa)
- Keep the same color palette and lighting direction
- Keep the same product position and text
- Keep the same visual concept and metaphor
- The change should be noticeable but not completely different`;
      break;

    case "layout_adjustment":
      variationInstructions = `LAYOUT COMPOSITION:
- Adjust the spatial arrangement whilst keeping the same elements
- Examples:
  * Centered product → Off-center (rule of thirds)
  * Symmetrical → Asymmetrical composition
  * Tight framing → Looser framing with more breathing room
  * Foreground elements repositioned
- Keep the same color palette, lighting, and effects
- Keep the same headline and typography style
- Keep the same background concept
- All elements must remain visible and balanced`;
      break;

    case "effect_intensity":
      variationInstructions = `VISUAL EFFECTS INTENSITY:
- Adjust the intensity of visual effects (glow, blur, particles, etc.)
- Examples:
  * Subtle glow → Strong dramatic glow (or vice versa)
  * Sharp focus → Slight motion blur on background
  * Minimal depth of field → Strong depth of field
  * Clean edges → Atmospheric blur/haze
  * Few light rays → Intense light rays (or vice versa)
- Keep the same composition, color palette, and layout
- Keep the same product position and text
- Keep the same background concept
- Effects should enhance, not distract`;
      break;
  }

  const closingInstructions = `

=== QUALITY STANDARDS ===
- The variation should feel like "the same ad, slightly different"
- Someone should be able to tell these are variations of each other
- The change should be noticeable but not jarring
- Maintain the same production quality as the parent
- Aspect ratio: ${aspectRatio}

=== AVOID ===
✗ Changing multiple tactical elements at once (only change what's specified)
✗ Creating something that looks completely different from the parent
✗ Changing the headline or core message
✗ Obscuring the product label
✗ Making the variation look worse than the parent
✗ Ignoring the parent image and creating something new

=== FINAL GOAL ===
Create a variation that a designer would make when exploring "what if we tried this slightly differently?"

The parent and child should feel like they belong to the same campaign, just with one tactical element adjusted for testing purposes.`;

  return baseInstruction + variationInstructions + closingInstructions;
}

/**
 * Get a random variation type for automatic child generation
 */
export function getRandomVariationType(): ChildVariationType {
  const types: ChildVariationType[] = [
    "color_shift",
    "lighting_variation",
    "typography_tweak",
    "product_angle",
    "background_intensity",
    "layout_adjustment",
    "effect_intensity",
  ];
  
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Get a diverse set of variation types for generating multiple children
 * Ensures variety by not repeating types until all have been used
 */
export function getDiverseVariationTypes(count: number): ChildVariationType[] {
  const allTypes: ChildVariationType[] = [
    "color_shift",
    "lighting_variation",
    "typography_tweak",
    "product_angle",
    "background_intensity",
    "layout_adjustment",
    "effect_intensity",
  ];
  
  const result: ChildVariationType[] = [];
  let availableTypes = [...allTypes];
  
  for (let i = 0; i < count; i++) {
    // Refill pool when exhausted
    if (availableTypes.length === 0) {
      availableTypes = [...allTypes];
    }
    
    // Pick random type from available pool
    const randomIndex = Math.floor(Math.random() * availableTypes.length);
    const selectedType = availableTypes[randomIndex];
    
    result.push(selectedType);
    availableTypes.splice(randomIndex, 1);
  }
  
  return result;
}

/**
 * Example usage:
 * 
 * const prompt = buildChildVariationPrompt({
 *   parentImageUrl: "https://cdn.example.com/parent-image.png",
 *   variationType: "color_shift",
 *   productName: "ONEST Health Hyperburn",
 *   headline: "THIS IS THE END OF CRAVINGS",
 *   aspectRatio: "1:1"
 * });
 * 
 * Then call Gemini API with:
 * - The prompt above
 * - Parent image as inline data
 * - Product render as inline data (optional, if needed)
 */
