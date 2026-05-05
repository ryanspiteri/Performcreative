/**
 * Winning Ad Framework — distilled from analysis of 10+ proven Hyperburn static ads.
 *
 * Inject this into Stage 2 brief generation so Claude produces variations grounded
 * in real conversion data rather than generic supplement ad patterns.
 *
 * Patterns extracted from:
 * - CORTISOL_BELLY_GONE, DAD-FLAB-GONE, FRIENDS THINK LIPO, EFFORTLESS FAT BURNING
 * - HB-G-786 (3D animated testimonial), HB-G-758 (UGC handwritten sign)
 * - FLATTEN YOUR STOMACH FAST, MELT BEER BELLY, WATERDROPS, HB KILLED MY FUPA
 */

export const WINNING_AD_FRAMEWORK = `
=== WINNING AD FRAMEWORK (from proven Hyperburn creatives) ===

You are writing this brief using a framework distilled from 10+ high-performing Hyperburn static ads.
Apply these patterns — they are not suggestions, they are what converts.

--- PROVEN AD ANGLES (ranked by frequency in winning ads) ---

1. TESTIMONIAL (most common, ~60% of winners)
   - First-person voice: "My [body part] went in [X] days", "I watched my belly vanish"
   - Body parts that work: cortisol belly, beer belly, dad flab, fupa, muffin top, meno belly
   - Always include a timeframe: "in 30 days", "in just weeks", "in 4-weeks"
   - Social surprise variant: "My friends think I got lipo" — disbelief framing converts
   adAngle value: "testimonial"

2. CLAIM-LED (bold promise, ~20% of winners)
   - Directive command: "Flatten your stomach fast", "Dad flab gone in 30 days"
   - Negate the pain: "No crash diets required", "Without the workout"
   - Specific timeframe in bold/italic emphasis
   adAngle value: "claim_led"

3. UGC/ORGANIC (~20% of winners)
   - Handwritten-sign aesthetic, real-photo setting, screenshot crop
   - Headline sounds like a real person texting: "Hyperburn killed my fupa, muffin top and meno belly in 4-weeks!"
   - Emoji reactions feel real
   adAngle value: "ugc_organic"

--- PROVEN VISUAL COMPOSITIONS (use one per variation) ---

COMPOSITION A — "Monochromatic Blob" (works with: testimonial)
Background: Flat solid color matching the product flavour (pink for Pink Lemonade, yellow for Mango, purple for Purple Fury, green for Sour Apple). Large 3D organic blob/sphere shapes in slightly darker shade of same color family float in background — top-right and bottom-left corners.
Layout: Headline occupies left 55% of frame in large bold white text, product tub floats right 45% resting/hovering on blob shapes. ONEST logo top-centre in brand colour. Product has subtle drop shadow.
Text treatment: All-caps bold white, very large (takes up most of left column height), no subheadline needed.
variationType: "background_only"

COMPOSITION B — "Soft Gradient Pyramid" (works with: testimonial, social proof)
Background: Soft pastel gradient matching product flavor palette — centre lighter, edges darker. Scattered bokeh light spots/circles in background at low opacity.
Layout: Logo top-centre. Quote-style headline at top in mixed weights (thin regular + bold italic emphasis on key word e.g., "LIPO"). Multiple product tubs stacked in pyramid formation bottom-centre (6 tubs: 1 top, 2 middle, 3 bottom). Disclaimer small at very bottom.
Text treatment: Sentence case, large but not all-caps. Italic on the "shock word".
variationType: "background_only"

COMPOSITION C — "Benefit Checklist" (works with: testimonial + authority)
Background: Gradient matching product (purple-to-pink, blue-to-dark, etc.). Single product tub right-centre, medium-large scale.
Layout: Large quote testimonial headline top (2 lines). Left column has 3 benefit items each with coloured checkbox/tick icon + 4-8 word claim. Optional press logo bar at bottom (greyscale media logos). Logo top-left.
Text treatment: Quote marks on headline. Checkboxes match accent colour of flavour. Benefits in bold all-caps.
variationType: "full_remix"
Benefit callouts to render: pick 3 from: "Turns metabolism up to 10", "Crushes cravings and kills bloat", "Like a workout without the workout", "Boosts thermogenesis 24/7", "Zero crash. Zero fillers.", "Clinically dosed — not dusted"

COMPOSITION D — "Dark Drama" (works with: product_hero, testimonial)
Background: Very dark near-black (#01040A to #1a1a2e). Texture overlay — water droplets on glass, or fine grain, or mist. Dramatic single light source from above or behind product creating rim light.
Layout: Single product tub centred, prominent, occupying centre 40% of frame. Bold white headline top (2-3 lines). Bright contrasting CTA button bottom ("SHOP NOW" in brand pink/red on pill-shaped button).
Text treatment: Large all-caps bold white. CTA button is pink/magenta with white text, full-width pill shape.
variationType: "background_only"

COMPOSITION E — "Clean Float with Badge" (works with: claim_led)
Background: Clean neutral — white, off-white, or very light grey. Minimal.
Layout: Multiple product tubs (3-7) scattered or stacked loosely — mix of flavour colourways. Large bold headline mid-frame in dark text. Orange rounded badge/pill directly below headline as a sub-claim. ONEST logo top-centre in brand red.
Text treatment: Bold dark text headline. Orange (#FF6B35) pill badge with white bold text.
variationType: "full_remix"

COMPOSITION F — "Proof Icons" (works with: claim_led, authority)
Background: Clean light — white, cream, or very light grey with faint gradient. Product on a small wooden/marble platform or display surface.
Layout: Logo top-centre. Large mixed-weight headline (regular sentence + BOLD italic KEY WORDS). Below headline: 3 columns of icon + 2-3 line stat (emoji or flat icon above, stat text below). Product trio or single tub at bottom, centred.
Text treatment: Sentence case headline, regular + bold italic emphasis. Icon stats in dark text, small.
variationType: "full_remix"
Benefit callouts to render: pick 3 stats: "Boosts metabolism & ignites fat burn", "9 in 10 report reduced cravings & visible fat loss", "Trusted by fitness coaches & health experts"

COMPOSITION G — "UGC Raw" (works with: ugc_organic)
Background: Real-world setting — kitchen counter, office desk, gym bag, bathroom shelf. Natural lighting, slightly grainy or phone-camera quality.
Layout: Product held in hand or placed naturally on surface. Handwritten-sign text or speech bubble with rounded corners overlaid. Emoji reaction floating near product. No logo.
Text treatment: Handwritten-style or casual rounded font. Personal, real, unpolished. Feels like a screenshot.
variationType: "full_remix"

--- HEADLINE PSYCHOLOGY RULES ---

1. Name the body part. Not "weight loss" — "cortisol belly", "beer belly", "dad flab", "fupa", "muffin top", "meno belly". Specific body parts feel personal.
2. Add the timeframe. "in 30 days", "in just weeks", "in 4-weeks". Time-bound claims create urgency and believability.
3. Use first-person for testimonials. "My...", "I watched...", "I went from..." — reader self-inserts.
4. Disbelief framing. "My friends think I got lipo" works because the disbelief of others validates the result.
5. Contradiction framing. "Like a workout without the workout" — removes the perceived effort barrier.

--- BENEFIT CALLOUT FORMAT RULES ---
- Always 3 callouts when using Compositions C or F
- Max 8 words per callout
- Start with a verb: "Crushes", "Boosts", "Turns", "Kills", "Melts", "Ignites"
- No filler words: "Zero crash", "No fillers", "Real results"

=== END FRAMEWORK ===
`;
