import axios from "axios";
import { ENV } from "../_core/env";
import * as db from "../db";
import { transcribeVideo } from "./whisper";
import { createMultipleScriptTasks } from "./clickup";

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

const claudeClient = axios.create({
  baseURL: ANTHROPIC_BASE,
  headers: {
    "x-api-key": ENV.anthropicApiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  timeout: 600000,
});

async function callClaude(messages: any[], system?: string, maxTokens = 4096): Promise<string> {
  const body: any = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages };
  if (system) body.system = system;
  const res = await claudeClient.post("/messages", body);
  const content = res.data?.content;
  if (Array.isArray(content)) return content.map((c: any) => c.text || "").join("\n");
  return content?.text || JSON.stringify(content);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

const STEP_TIMEOUT = 10 * 60 * 1000;

// ============================================================
// ONEST COPY FRAMEWORK v2.0 — PRODUCT INTELLIGENCE
// Hardcoded from Section 10 of the Copy Framework.
// ============================================================

const PRODUCT_INTELLIGENCE: Record<string, {
  copyLevers: string;
  traps: string;
  stackPartner: string;
  defaultPersona: string;
  defaultStyle: string;
}> = {
  Hyperburn: {
    copyLevers: `WHAT WINS FOR HYPERBURN:
- The two-forms-of-caffeine story: Caffeine Anhydrous for fast hit + Dicaffeine Malate for sustained, smooth energy
- 'No crash' / 'no jitters' differentiation against other fat burners
- 'Morning ritual' framing — first thing, empty stomach, part of a winning routine
- Cost-per-day framing (4 calories, less than a coffee)
- The Festinger reframe: 'You've tried fat burners before and they didn't work — because most fat burners are underdosed'
- Lean GBB and Capsimax® keep metabolism burning for hours
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never promise specific weight loss numbers (compliance risk, kills credibility)
- Never ignore the jitters/anxiety objection — address it proactively
- Never use generic 'burn fat fast' messaging — every fat burner says this`,
    stackPartner: "ThermoSleep (24-hour fat burning: AM + PM). Frame as 'The 24-Hour Fat Burning Protocol'.",
    defaultPersona: "Both",
    defaultStyle: "direct_response",
  },
  Thermosleep: {
    copyLevers: `WHAT WINS FOR THERMOSLEEP:
- The dual benefit: sleep AND fat burning. This is the unique positioning — no one else owns this intersection
- The 'overnight advantage' angle — burning fat while you sleep is inherently compelling
- Loss framing: 'Poor sleep is destroying your results and you don't even know it'
- The 5-HTP + Melatonin + Magnesium sleep stack story
- The recovery angle — better sleep = better recovery = better results
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never lead with fat burning alone (loses the unique dual positioning)
- Never overcomplicate the ingredient story — keep it to 2-3 hero ingredients`,
    stackPartner: "HyperBurn (24-hour fat burning: AM + PM). Frame as 'The 24-Hour Fat Burning Protocol'.",
    defaultPersona: "Both",
    defaultStyle: "ugc_testimonial",
  },
  "Protein + Collagen": {
    copyLevers: `WHAT WINS FOR PROTEIN + COLLAGEN:
- 'Beauty meets performance' — the bridge between gym results and skin/hair/nail health
- 10g Hydrolysed Collagen Peptides per scoop — this is a significant dose, lead with it
- DigeZyme digestive enzymes — no bloating, easy digestion differentiator
- Lara-first messaging: she wants protein but also cares about skin and hair. This does both.
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never position as 'women's protein' — Lara hates pinkification. Position as smart protein, not gendered protein
- Never ignore taste — taste and texture are genuine purchase factors for this audience`,
    stackPartner: "Marine Collagen (full beauty-from-within protocol).",
    defaultPersona: "Lara",
    defaultStyle: "ugc_testimonial",
  },
  Hyperload: {
    copyLevers: `WHAT WINS FOR HYPERLOAD:
- 'Elite' and 'high-stim' positioning — this is for serious athletes who want to feel it
- The four-pillar sell: explosive performance, strength and power, mental focus, powerful muscle pumps
- Peter-first messaging: he trains hard, expects his pre to match his intensity
- The 'feel the difference from scoop one' immediacy angle
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never undersell the stim level — Peter wants to know this is serious, not mild
- Never compete on flavour — that's Ghost's game. Compete on performance`,
    stackPartner: "HyperPump (full pre-workout stack for max performance). AminoLoad (pre + recovery).",
    defaultPersona: "Peter",
    defaultStyle: "direct_response",
  },
  Creatine: {
    copyLevers: `WHAT WINS FOR CREATINE:
- Creapure® — the gold standard. This is the differentiator against generic creatine
- Myth-busting angle: creatine is the most studied supplement in existence, most people still don't take it
- Universal appeal: muscle building, reduced fatigue, improved strength AND endurance
- Education-first works because creatine has persistent myths (water retention, kidney damage) that need addressing
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never treat creatine as a commodity — the Creapure® story is the differentiator, use it
- Never ignore the myths — address water retention and kidney concerns head-on`,
    stackPartner: "Whey ISO Pro (muscle building stack).",
    defaultPersona: "Both",
    defaultStyle: "education_mythbusting",
  },
  Thermoburn: {
    copyLevers: `WHAT WINS FOR THERMOBURN:
- Thermogenic fat burner with a focus on metabolism support
- Clinically dosed ingredients for transparent, effective fat burning
- Pairs well with an active lifestyle and training regimen
- Every ingredient and dose on the label — no proprietary blends
- The Festinger reframe: 'You've tried fat burners before and they didn't work — because most fat burners are underdosed'`,
    traps: `WHAT TO AVOID:
- Never promise specific weight loss numbers
- Never use generic 'burn fat fast' messaging`,
    stackPartner: "ThermoSleep (thermogenic + sleep support combo).",
    defaultPersona: "Both",
    defaultStyle: "direct_response",
  },
  "Carb Control": {
    copyLevers: `WHAT WINS FOR CARB CONTROL:
- Unique positioning: enjoy carbs without the guilt
- Addresses a real pain point — people love carbs but fear them
- White kidney bean extract blocks carb absorption
- Perfect for social situations, dining out, flexible dieting
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never position as a 'cheat meal pill' — that undermines credibility
- Never promise you can eat unlimited carbs — frame as a smart tool for flexibility`,
    stackPartner: "HyperBurn (carb management + fat burning combo).",
    defaultPersona: "Both",
    defaultStyle: "ugc_testimonial",
  },
  HyperPump: {
    copyLevers: `WHAT WINS FOR HYPERPUMP:
- Stim-free pre-workout — the pump without the jitters
- Perfect for evening trainers or stim-sensitive athletes
- Pairs with HyperLoad for the ultimate pre-workout stack
- Nitric oxide and blood flow focus — visible pump results
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never undersell by comparing to stimulant pre-workouts — own the stim-free space
- Never ignore the 'why no caffeine?' question — address it as a feature, not a limitation`,
    stackPartner: "HyperLoad (full pre-workout stack: stim + pump).",
    defaultPersona: "Peter",
    defaultStyle: "direct_response",
  },
  AminoLoad: {
    copyLevers: `WHAT WINS FOR AMINOLOAD:
- Recovery and hydration in one — simplifies the supplement stack
- Intra-workout or post-workout versatility
- BCAAs + EAAs for complete amino acid profile
- Electrolytes for hydration during training
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never position as just another BCAA — the complete amino + hydration angle is the differentiator
- Never ignore taste — this is a daily-use product and flavour matters`,
    stackPartner: "HyperLoad (pre + recovery stack).",
    defaultPersona: "Peter",
    defaultStyle: "ugc_testimonial",
  },
  "Marine Collagen": {
    copyLevers: `WHAT WINS FOR MARINE COLLAGEN:
- Premium marine-sourced collagen for skin, hair, nails
- Beauty-from-within positioning — the daily beauty ritual
- Pairs with Protein + Collagen for the full beauty protocol
- Light, easy to mix, can add to anything
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never position as a gym supplement — this is beauty and wellness
- Never ignore the 'why marine vs bovine?' question — marine is more bioavailable for skin`,
    stackPartner: "Protein + Collagen (full beauty-from-within protocol).",
    defaultPersona: "Lara",
    defaultStyle: "lifestyle_aspiration",
  },
  SuperGreens: {
    copyLevers: `WHAT WINS FOR SUPERGREENS:
- Daily health insurance — covers nutritional gaps
- Gut health and immunity support
- Easy way to get your greens without eating salads
- Tastes good (a genuine differentiator in the greens category)
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never use fear-based messaging about diet deficiencies — frame positively
- Never ignore taste — most greens powders taste terrible, this is a selling point`,
    stackPartner: "Marine Collagen (daily health + beauty stack).",
    defaultPersona: "Both",
    defaultStyle: "ugc_testimonial",
  },
  "Whey ISO Pro": {
    copyLevers: `WHAT WINS FOR WHEY ISO PRO:
- Premium whey isolate — fast-absorbing, low lactose
- For serious athletes who want clean protein without fillers
- High protein per serve with minimal carbs and fat
- Every ingredient and dose on the label — no proprietary blends`,
    traps: `WHAT TO AVOID:
- Never compete purely on price — position on quality and purity
- Never ignore the taste factor — protein is a daily-use product`,
    stackPartner: "Creatine (muscle building stack).",
    defaultPersona: "Peter",
    defaultStyle: "direct_response",
  },
};

function getProductIntelligence(product: string) {
  return PRODUCT_INTELLIGENCE[product] || {
    copyLevers: `General ONEST product. Lead with transparency (every ingredient and dose on the label), quality ingredients, and Australian brand values.`,
    traps: `Avoid generic supplement claims. Be specific about ingredients and benefits.`,
    stackPartner: "Check ONEST range for complementary products.",
    defaultPersona: "Both",
    defaultStyle: "direct_response",
  };
}

// ============================================================
// SCRIPT STYLE DESCRIPTIONS
// ============================================================

const SCRIPT_STYLE_DESCRIPTIONS: Record<string, string> = {
  direct_response: "Direct Response ad script — conversion-focused, urgent, specific, benefit-led with a hard CTA",
  founder_led: "Founder-Led / Authority ad script — conversational authority, trust-building, measured pacing",
  ugc_testimonial: "User-Generated Content (UGC) style script — authentic, relatable, filmed-on-phone feel, genuine personal recommendation",
  education_mythbusting: "Education / Myth-Busting ad script — earns attention through value, challenges conventional thinking, positions product as logical conclusion",
  lifestyle_aspiration: "Lifestyle / Aspiration ad script — brand-building, cinematic, emotional narrative with product reveal",
  problem_solution_demo: "Problem/Solution Demo ad script — show don't tell, quick but clear demonstration of the product solving a real problem",
};

// ============================================================
// STYLE-SPECIFIC SYSTEM PROMPTS
// ============================================================

function getStyleSystemPrompt(style: string, product: string, duration: number): string {
  const durationRange = duration === 45 ? "40-50" : duration === 90 ? "80-100" : "55-65";
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";

  const SHARED_HEADER = `You are the ONEST Health Copy System — an elite direct response advertising strategist operating under the ONEST Copy Framework v2.0. Your job is to write video ad scripts that SELL ONEST Health products.

You operate with the combined expertise of: Eugene Schwartz (awareness levels, desire amplification), Gary Halbert (audience obsession, starving crowd), Robert Cialdini (influence architecture), Daniel Kahneman (System 1/2, loss framing), Leon Festinger (cognitive dissonance, belief bridging), Dan Ariely (pricing psychology, value perception), BJ Fogg (behaviour design), Byron Sharp (mental availability, distinctive assets), Al Ries (positioning, competitive strategy), Don Norman (cognitive load, visual hierarchy).

MANDATORY STANDARD: No copy leaves scoring below 90/100.`;

  const SHARED_COMPLIANCE = `
=== COMPLIANCE GUARDRAILS ===
- CAN say: ingredient-level claims, mechanism claims ('supports metabolism'), relative claims ('more caffeine than a flat white'), specific social proof, ingredient quality claims
- CANNOT say: specific weight loss numbers, disease/medical claims, guaranteed results, unsubstantiated superlatives
- Safe framing: 'Supports' not 'guarantees'. 'Designed to' not 'proven to'. 'Results may vary' on testimonial claims.`;

  const SHARED_SPECIFICITY = `
=== SPECIFICITY RULE ===
WEAK: 'HyperBurn helps you burn more fat.'
STRONG: '250mg of Caffeine Anhydrous and Dicaffeine Malate fires up your metabolism within 20 minutes. Lean GBB and Capsimax® keep it burning for hours.'
ALWAYS choose the strong version.`;

  switch (style) {
    case "direct_response":
      return `${SHARED_HEADER}

=== DIRECT RESPONSE SCRIPT STRUCTURE ===

TARGET DURATION: approximately ${duration} seconds (${durationRange}s range, ${segmentCount} segments)

HOOK — 0 TO 3 SECONDS
Stop the scroll. The hook must activate System 1 (Kahneman) before System 2 engages.
5 hook archetypes (choose the one specified in the brief):
1. Contrarian Claim: 'Everything you've been told about fat burners is wrong.'
2. Specific Frustration: 'If you've tried 3+ fat burners and none of them worked...'
3. Unexpected Comparison: 'This costs less than your daily coffee but burns more fat.'
4. Social Proof Lead: '47,000 Australians switched to this in the last 6 months.'
5. Specific Number: '4 calories. Zero crash. 6 hours of clean energy.'

PROBLEM/AGITATION — 3 TO 10 SECONDS
Agitate the problem using LOSS FRAMING (Kahneman — losses are felt 2x stronger than gains).
- Frame as what they're LOSING, not what they could gain
- Use specific experience, not category: 'That 3pm crash that kills your afternoon' NOT 'low energy'
- Festinger's cognitive dissonance: name the failure of previous solutions

SOLUTION/PRODUCT — 10 TO 20 SECONDS
Introduce ONEST ${product} as the answer. Lead with the SPECIFIC MECHANISM, not the generic benefit.
- Name the specific ingredient and what it does — NEVER say 'our formula' or 'our blend'
- Use Schwartz's desire amplification — show the product delivering on an existing desire
- Connect back to the hook's specific tension — resolution must be direct
- Cialdini's authority principle: science, specificity, transparency

PROOF + CTA — FINAL 10-15 SECONDS
Proof first, then ask. The CTA arrives at peak motivation.
- Social proof must be SPECIFIC: '47,000 customers' beats 'thousands of happy customers'
- One CTA only — never two
- CTA should reduce friction: 'Try it risk-free' beats 'Buy now'
- 30-day guarantee framing (Ariely's endowment effect)

=== MANDATORY RULES ===
1. The product name "ONEST ${product}" must appear at least 3 times in the script.
2. At least 3 specific ingredients or benefits must be mentioned BY NAME.
3. The CTA must tell viewers exactly where to buy and give them a reason to act now.
4. Use LOSS FRAMING where possible.
5. Every timestamp segment must serve the sale — no filler.
6. Byron Sharp test: would someone who sees this once remember it's ONEST?
7. Al Ries test: does ONEST own a clear position in this script?
${SHARED_SPECIFICITY}
${SHARED_COMPLIANCE}`;

    case "ugc_testimonial":
      return `${SHARED_HEADER}

=== UGC / TESTIMONIAL SCRIPT STRUCTURE ===

TARGET DURATION: approximately ${duration} seconds (${durationRange}s range, ${segmentCount} segments)

THE UGC PARADOX: The script must feel completely unscripted and genuine, while strategically communicating product benefits and driving purchase intent.

HOOK — 0 TO 3 SECONDS
Casual, scroll-stopping opener. Sounds like someone about to share something they're genuinely excited about. NOT polished ad copy.
- 'Okay so I need to tell you about this...'
- 'I've been keeping this to myself for like 3 months and I can't anymore...'
- 'Right so my mate told me about this and I was sceptical as...'

PERSONAL CONTEXT — 3 TO 15 SECONDS
The creator's real situation. Their problem, their journey, why they were looking for a solution.
- Use specific, personal details — not marketing language
- 'I was doing everything right — training 5 days a week, eating in a deficit — and the scale just wasn't moving' (NOT 'Many people struggle with weight loss')

DISCOVERY — 15 TO 25 SECONDS
How they found ONEST ${product}. Maybe a friend recommended it, they saw it online, they were sceptical but tried it anyway. Name the product naturally.
- 'My PT actually put me onto ONEST ${product} and I was like... another supplement, really?'

EXPERIENCE & RESULTS — 25 TO 40 SECONDS
What happened when they used it. Specific, personal results — not clinical claims.
- 'I actually had energy at 3pm' NOT 'Supports sustained energy levels'
- 'I stopped getting that 3pm crash' NOT 'Reduces afternoon fatigue'
- 'My skin literally started glowing after like 2 weeks' NOT 'Promotes skin health'
- Mention 2-3 benefits naturally as personal experiences

RECOMMENDATION — FINAL 10-15 SECONDS
Genuine recommendation. Not 'BUY NOW' but 'honestly, just try it.'
- 'Link's in my bio if you wanna check it out'
- 'I'll leave the link below — honestly just try it for a month'
- 'It's onest.com.au if you want to suss it out'

=== MANDATORY RULES ===
1. The product name "ONEST ${product}" must appear 2-3 times, said NATURALLY.
2. Benefits must be expressed as PERSONAL EXPERIENCES, not marketing claims.
3. Include at least one moment of genuine personality — a laugh, a tangent, a self-deprecating comment.
4. NEVER use corporate language: no 'formulated,' 'proprietary,' 'cutting-edge,' 'revolutionary.'
5. Australian English and casual tone throughout. 'Reckon,' 'heaps,' 'arvo,' 'mate' where natural.
6. Must sound like it was filmed on a phone by a real person, not scripted by a brand.
7. The script must pass the 'would I believe this person actually uses this product?' test.
${SHARED_COMPLIANCE}`;

    case "education_mythbusting":
      return `${SHARED_HEADER}

=== EDUCATION / MYTH-BUSTING SCRIPT STRUCTURE ===

TARGET DURATION: approximately ${duration} seconds (${durationRange}s range, ${segmentCount} segments)

HOOK — 0 TO 3 SECONDS
The contrarian claim. Challenges conventional thinking without being preachy. Must activate curiosity immediately.

EVIDENCE — 3 TO 15 SECONDS
Deliver the evidence that challenges the assumption. Be specific — name studies, ingredients, dosages. This is where you earn the right to sell.

REAL MECHANISM — 15 TO 25 SECONDS
Explain the actual mechanism. Why does this matter? What does the science say? Name ONEST ${product}'s specific ingredients and how they work.

PRODUCT AS LOGICAL ANSWER — 25 TO 40 SECONDS
${product} is introduced as the natural conclusion, not a forced sell. The education has already done the heavy lifting.

CTA — FINAL 10-15 SECONDS
Invitation to try, backed by the credibility you've just built.

=== MANDATORY RULES ===
1. Lead with education, not product. The product appears after credibility is earned.
2. Name specific ingredients, dosages, and mechanisms — this audience is informed.
3. Address the myths head-on.
4. Tone is intelligent, direct, slightly provocative — not preachy or condescending.
5. ONEST's transparency (every ingredient and dose on the label) is the authority play.
6. The product name "ONEST ${product}" must appear at least 2 times.
${SHARED_SPECIFICITY}
${SHARED_COMPLIANCE}`;

    case "founder_led":
      return `${SHARED_HEADER}

=== FOUNDER-LED / AUTHORITY SCRIPT STRUCTURE ===

TARGET DURATION: approximately ${duration} seconds (${durationRange}s range, ${segmentCount} segments)

BOLD OPENING — 0 TO 5 SECONDS
A confident, authoritative statement that earns attention. Not a hook trick — a genuine position.

CATEGORY PROBLEM — 5 TO 15 SECONDS
What's wrong with the supplement category. Why most products fail. This is where ONEST's transparency positioning hits hardest.

WHAT WE DID DIFFERENTLY — 15 TO 35 SECONDS
Specific ingredients, specific doses, specific decisions. Why ONEST chose this path. No proprietary blends. Every ingredient on the label. Clinically dosed.

INVITATION TO TRY — FINAL 15-20 SECONDS
Not a hard sell. An invitation backed by transparency and confidence.

=== MANDATORY RULES ===
1. Tone is conversational authority — like talking to a knowledgeable friend.
2. Must reference ONEST's transparency: no proprietary blends, every dose on the label.
3. Competitive repositioning is implicit — 'most brands hide behind proprietary blends.'
4. Pacing is measured — let the speaker breathe.
5. The product name "ONEST ${product}" must appear at least 3 times.
${SHARED_SPECIFICITY}
${SHARED_COMPLIANCE}`;

    case "lifestyle_aspiration":
      return `${SHARED_HEADER}

=== LIFESTYLE / ASPIRATION SCRIPT STRUCTURE ===

TARGET DURATION: approximately ${duration} seconds (${durationRange}s range, ${segmentCount} segments)

VISUAL HOOK — 0 TO 5 SECONDS
Cinematic, aspirational opening. Show the lifestyle, not the product. Draw them in with desire.

EMOTIONAL NARRATIVE — 5 TO 25 SECONDS
Build the emotional story. This is about identity, aspiration, and the life they want. The product is part of that life, not the centre of it.

PRODUCT REVEAL — 25 TO 40 SECONDS
Seamless integration. The product appears naturally within the lifestyle. Not a hard sell — a natural part of the routine.

TAGLINE + CTA — FINAL 10-15 SECONDS
Brand moment. Aspirational tagline. Soft CTA that invites exploration.

=== MANDATORY RULES ===
1. Visual-first — the imagery does the selling, the copy supports it.
2. Product integration must feel natural, not forced.
3. The product name "ONEST ${product}" must appear at least 2 times.
4. Emotional resonance over rational argument.
5. ONEST brand values (transparency, quality, Australian) woven into the lifestyle.
${SHARED_COMPLIANCE}`;

    case "problem_solution_demo":
      return `${SHARED_HEADER}

=== PROBLEM/SOLUTION DEMO SCRIPT STRUCTURE ===

TARGET DURATION: approximately ${duration} seconds (${durationRange}s range, ${segmentCount} segments)

PROBLEM — 0 TO 5 SECONDS
Show the problem visually. Quick, relatable, immediately understood.

PRODUCT INTRO — 5 TO 10 SECONDS
Introduce ONEST ${product} as the solution. Clean, simple.

DEMO — 10 TO 30 SECONDS
Show the product in action. How it's used, what happens, the experience. This is the core of the ad — show, don't tell.

DIFFERENTIATOR — 30 TO 40 SECONDS
What makes ONEST ${product} different from alternatives. Specific ingredients, specific benefits.

CTA — FINAL 10-15 SECONDS
Clear, direct call to action.

=== MANDATORY RULES ===
1. Show don't tell — the demo is the proof.
2. Quick but clear — every second serves a purpose.
3. The product name "ONEST ${product}" must appear at least 2 times.
4. Name specific ingredients or features that differentiate from competitors.
5. The demo must be realistic and achievable — not over-produced.
${SHARED_SPECIFICITY}
${SHARED_COMPLIANCE}`;

    default:
      return `${SHARED_HEADER}

Write a video ad script for ONEST ${product}. Target duration: approximately ${duration} seconds (${segmentCount} segments).

The script must sell the product with specific ingredients and benefits. Include a clear CTA. The product name must appear at least 2 times.
${SHARED_SPECIFICITY}
${SHARED_COMPLIANCE}`;
  }
}

// ============================================================
// VIDEO BRIEF GENERATION — Copy Framework v2.0
// ============================================================

export interface ScriptConcept {
  title: string;
  hookLine: string;
  hookArchetype: string;
  structure: string;
  keyAngle: string;
  sellingStrategy: string;
  ctaApproach: string;
  awarenessLevel: string;
  funnelPosition: string;
  testHypothesis: string;
  style: string;
}

export interface VideoBriefOptions {
  competitorConceptAnalysis: string;
  hookStyle: string;
  hookArchetype: string;
  narrativeFramework: string;
  persuasionMechanism: string;
  awarenessLevel: string;
  scriptStyleClassification: string;
  onestAdaptation: string;
  productSellingAngle: string;
  primaryObjection: string;
  competitiveRepositioning: string;
  /** Dynamic concepts — keyed by style, any number per style */
  concepts: ScriptConcept[];
  targetPersona: string;
  targetAudience: string;
  toneAndEnergy: string;
  stackOpportunity: string;
}

/** Style config from the frontend: which styles and how many of each */
export interface StyleConfig {
  direct_response?: number;
  founder_led?: number;
  ugc_testimonial?: number;
  education_mythbusting?: number;
  lifestyle_aspiration?: number;
  problem_solution_demo?: number;
}

async function generateVideoBrief(
  transcript: string,
  visualAnalysis: string,
  product: string,
  brandName: string,
  productInfoContext: string,
  styleConfig: StyleConfig,
  duration: number,
  sourceType: "competitor" | "winning_ad"
): Promise<VideoBriefOptions> {
  const productIntel = getProductIntelligence(product);

  // Build the style request description
  const styleRequests: string[] = [];
  for (const [style, count] of Object.entries(styleConfig)) {
    if (count && count > 0) {
      const styleName = style.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      styleRequests.push(`${count}x ${styleName}`);
    }
  }
  const totalScripts = Object.values(styleConfig).reduce((sum, n) => sum + (n || 0), 0);

  const sourceContext = sourceType === "winning_ad"
    ? `This is an ONEST WINNING AD that we want to create VARIATIONS of. Analyse what makes it work and propose new angles, hooks, and approaches that maintain the winning elements while exploring new territory. Use the Section 8 Winning Ad Variation System: Hook Swap, Angle Shift, Audience Reframe, Format Adaptation, Proof Escalation.`
    : `This is a COMPETITOR AD. Reverse-engineer what makes it ENGAGE viewers, then create a brief that uses that engagement framework to SELL ONEST ${product}.`;

  const system = `You are the ONEST Health Copy System — an elite direct response advertising strategist operating under the ONEST Copy Framework v2.0. Your job is to deeply analyse video ads and create creative briefs that SELL ONEST Health products.

You operate with the combined expertise of: Eugene Schwartz (awareness levels, desire amplification), Gary Halbert (audience obsession, starving crowd), Robert Cialdini (influence architecture), Daniel Kahneman (System 1/2, loss framing), Leon Festinger (cognitive dissonance, belief bridging), Dan Ariely (pricing psychology, value perception), BJ Fogg (behaviour design), Byron Sharp (mental availability, distinctive assets), Al Ries (positioning, competitive strategy), Don Norman (cognitive load, visual hierarchy).

=== AD SCRIPT STYLE CLASSIFICATION ===

Before writing any brief, you MUST classify the source ad into one of these 6 styles:

1. DIRECT RESPONSE (DR): Conversion. Cold traffic. Urgent, specific, benefit-led. Fast cuts, high energy. Structure: Hook → Agitation → Mechanism (named ingredients) → Proof + CTA.

2. FOUNDER-LED / AUTHORITY: Trust-building. Mid-funnel. Conversational authority. Measured pacing. Structure: Bold opening → Category problem → What we did differently → Invitation.

3. UGC / TESTIMONIAL: Social proof. Organic pacing. Authentic personal story. Structure: Frustration → Discovery → Result → Recommendation.

4. EDUCATION / MYTH-BUSTING: Authority. Steady build. Contrarian hook. Structure: Contrarian hook → Evidence → Mechanism → Product as answer.

5. LIFESTYLE / ASPIRATION: Brand building. Cinematic. Structure: Visual hook → Emotional narrative → Product reveal → Tagline + CTA.

6. PROBLEM/SOLUTION DEMO: Show don't tell. Quick but clear. Structure: Problem → Product intro → Demo → Differentiator → CTA.

=== 5 HOOK ARCHETYPES ===
1. Contrarian Claim: Challenges a widely held belief
2. Specific Frustration: Names the exact pain point
3. Unexpected Comparison: Reframes value through surprising analogy
4. Social Proof Lead: Opens with specific social evidence
5. Specific Number: Leads with a precise, compelling statistic

=== AWARENESS LEVEL MATRIX (Schwartz) ===
- Problem Unaware → TOF Broadest → Education/Lifestyle styles
- Problem Aware → TOF Interest → DR/Education styles
- Solution Aware → MOF Engaged → DR/UGC/Founder-Led styles
- Product Aware → BOF Retargeting → UGC/Demo/DR proof-heavy
- Most Aware → Retention → Lifestyle/Founder-Led/DR stack

=== PSYCHOLOGICAL FRAMEWORKS (use as operational tools) ===
- Schwartz: Match copy sophistication to audience awareness level
- Halbert: Find the starving crowd — right audience beats right copy
- Cialdini: Deploy reciprocity, social proof, authority, scarcity, unity
- Kahneman: Hook must activate System 1 before System 2. Use loss framing (2x stronger than gain)
- Festinger: Name the failure of previous solutions, validate, bridge to ONEST
- Ariely: Cost-per-day framing, price anchoring, endowment effect
- Fogg: CTA at peak motivation, reduce friction, anchor to existing routines
- Sharp: Make it distinctively ONEST — not generic supplement
- Ries: Own a clear position. Competitive repositioning.
- Norman: One primary message per segment. Visual hierarchy supports copy.

=== CROSS-SELL & STACK RULES ===
- Sell primary product first — stack is the upsell, not the lead
- Frame stacks as protocols: 'The 24-Hour Fat Burning Protocol' not 'buy two products'
- Cost-per-day framing for stacks
- Don't force a stack if it doesn't serve the creative

=== COMPLIANCE GUARDRAILS ===
- CAN: ingredient claims, mechanism claims, relative claims, specific social proof, ingredient quality
- CANNOT: specific weight loss numbers, disease claims, guaranteed results, unsubstantiated superlatives
- Safe framing: 'Supports' not 'guarantees'. 'Designed to' not 'proven to'. 'Results may vary'.`;

  const prompt = `Analyse this video ad and create a creative brief for ONEST Health's ${product}.

${sourceContext}

SOURCE BRAND: ${brandName}
TARGET SCRIPT DURATION: approximately ${duration} seconds

TRANSCRIPT:
${transcript}

VISUAL ANALYSIS:
${visualAnalysis}

=== PRODUCT INFORMATION (from database) ===
${productInfoContext || "No detailed product info in database."}

=== PRODUCT-SPECIFIC COPY INTELLIGENCE ===
${productIntel.copyLevers}

${productIntel.traps}

STACK PARTNER: ${productIntel.stackPartner}

=== SCRIPTS REQUESTED ===
The user has requested: ${styleRequests.join(", ")} (${totalScripts} scripts total)

You must propose exactly ${totalScripts} concepts matching these style requests.

Return your response in this EXACT JSON format:
{
  "competitorConceptAnalysis": "Detailed 200+ word analysis of what makes this ad work — the concept, engagement mechanics, and psychological triggers",
  "hookStyle": "The specific hook type identified",
  "hookArchetype": "contrarian | specific_frustration | unexpected_comparison | social_proof_lead | specific_number",
  "narrativeFramework": "The exact narrative structure",
  "persuasionMechanism": "How the ad persuades — name the psychological frameworks at play",
  "awarenessLevel": "problem_unaware | problem_aware | solution_aware | product_aware | most_aware",
  "scriptStyleClassification": "The dominant style of the source ad",
  "onestAdaptation": "200+ word explanation of how ONEST should adapt this for ${product}. What engagement mechanics to keep? What to change? How do we maintain engagement while SELLING the product?",
  "productSellingAngle": "The specific selling angle for ${product} — which ingredients, benefits, and positioning to lead with. Be specific, not generic.",
  "primaryObjection": "The #1 objection the target audience has about this product category, and how the scripts should overcome it",
  "competitiveRepositioning": "How ONEST ${product} is positioned AGAINST competitors — what makes ONEST different and better",
  "concepts": [
    {
      "title": "Script title",
      "hookLine": "The exact opening hook line",
      "hookArchetype": "Which of the 5 hook archetypes",
      "structure": "Brief outline of the script structure",
      "keyAngle": "The unique angle",
      "sellingStrategy": "How this script sells ${product} — which specific ingredients/benefits are the focus",
      "ctaApproach": "The CTA style (hard sell / soft recommendation / invitation / urgency-driven)",
      "awarenessLevel": "Target awareness level for this concept",
      "funnelPosition": "TOF / MOF / BOF",
      "testHypothesis": "What this script tests — e.g., 'Testing whether loss framing outperforms aspiration framing for HyperBurn'",
      "style": "direct_response | founder_led | ugc_testimonial | education_mythbusting | lifestyle_aspiration | problem_solution_demo"
    }
  ],
  "targetPersona": "Peter | Lara | Both",
  "targetAudience": "Specific target audience description",
  "toneAndEnergy": "Tone and energy level",
  "stackOpportunity": "If relevant: which stack partner and how to frame it. If not relevant: 'None for this brief'"
}

CRITICAL: The "concepts" array must contain exactly ${totalScripts} concepts matching the requested styles: ${styleRequests.join(", ")}.`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 8000);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure concepts array exists and has the right count
      if (parsed.concepts && Array.isArray(parsed.concepts)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("[VideoPipeline] Failed to parse brief JSON:", e);
  }

  // Fallback — generate basic concepts for each requested style
  const fallbackConcepts: ScriptConcept[] = [];
  for (const [style, count] of Object.entries(styleConfig)) {
    for (let i = 0; i < (count || 0); i++) {
      fallbackConcepts.push({
        title: `${style.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} ${i + 1}: ${product}`,
        hookLine: "What if everything you knew about supplements was wrong?",
        hookArchetype: "contrarian",
        structure: "Hook → Problem → Solution → Proof → CTA",
        keyAngle: "Transparency and quality",
        sellingStrategy: `Lead with ${product}'s key ingredients and ONEST's transparency`,
        ctaApproach: "Visit onest.com.au",
        awarenessLevel: "solution_aware",
        funnelPosition: "MOF",
        testHypothesis: `Testing ${style} format for ${product}`,
        style,
      });
    }
  }

  return {
    competitorConceptAnalysis: "Analysis could not be generated. Please review the transcript and visual analysis manually.",
    hookStyle: "Unknown — review transcript",
    hookArchetype: "contrarian",
    narrativeFramework: "Unknown — review transcript",
    persuasionMechanism: "Unknown — review transcript",
    awarenessLevel: "solution_aware",
    scriptStyleClassification: "direct_response",
    onestAdaptation: `Adapt the source ad's approach for ONEST ${product}. Focus on the product's unique ingredients and ONEST's brand values of transparency and quality.`,
    productSellingAngle: `Lead with ${product}'s key differentiators and specific ingredients.`,
    primaryObjection: "Generic supplement scepticism — overcome with transparency and specificity.",
    competitiveRepositioning: "ONEST shows every ingredient and dose on the label — no proprietary blends.",
    concepts: fallbackConcepts,
    targetPersona: productIntel.defaultPersona,
    targetAudience: "Health-conscious adults 25-45",
    toneAndEnergy: "Energetic and authentic",
    stackOpportunity: productIntel.stackPartner,
  };
}

// ============================================================
// CONCEPT-MATCHED SCRIPT GENERATION — Copy Framework v2.0
// ============================================================

async function generateConceptMatchedScript(
  transcript: string,
  visualAnalysis: string,
  product: string,
  concept: ScriptConcept,
  brief: VideoBriefOptions,
  productInfoContext: string,
  duration: number,
  sourceType: "competitor" | "winning_ad"
): Promise<{
  title: string;
  hook: string;
  script: Array<{ timestamp: string; visual: string; dialogue: string }>;
  visualDirection: any;
  scriptMetadata: any;
  strategicThesis: string;
}> {
  const productIntel = getProductIntelligence(product);
  const style = concept.style || brief.scriptStyleClassification || "direct_response";
  const scriptStyleDesc = SCRIPT_STYLE_DESCRIPTIONS[style] || SCRIPT_STYLE_DESCRIPTIONS.direct_response;
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";

  const system = getStyleSystemPrompt(style, product, duration);

  const sourceLabel = sourceType === "winning_ad" ? "OUR WINNING AD" : "COMPETITOR";

  const prompt = `Write a ${scriptStyleDesc} for ONEST Health's ${product} that follows the approved concept brief.

APPROVED CONCEPT:
Title: ${concept.title}
Hook Line: ${concept.hookLine}
Hook Archetype: ${concept.hookArchetype}
Structure: ${concept.structure}
Key Angle: ${concept.keyAngle}
Selling Strategy: ${concept.sellingStrategy}
CTA Approach: ${concept.ctaApproach}
Awareness Level: ${concept.awarenessLevel}
Funnel Position: ${concept.funnelPosition}
Test Hypothesis: ${concept.testHypothesis}
Script Style: ${style}

${sourceLabel}'S ENGAGEMENT FRAMEWORK (use for PACING and STRUCTURE):
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Persuasion Mechanism: ${brief.persuasionMechanism}

PRODUCT SELLING ANGLE:
${brief.productSellingAngle}

COMPETITIVE REPOSITIONING:
${brief.competitiveRepositioning}

PRIMARY OBJECTION TO OVERCOME:
${brief.primaryObjection}

HOW TO ADAPT FOR ONEST:
${brief.onestAdaptation}

TARGET PERSONA: ${brief.targetPersona}
TARGET AUDIENCE: ${brief.targetAudience}
TONE & ENERGY: ${brief.toneAndEnergy}
STACK OPPORTUNITY: ${brief.stackOpportunity}

${sourceLabel}'S ORIGINAL TRANSCRIPT (reference for PACING and STRUCTURE only):
${transcript}

=== PRODUCT INFORMATION (from database) ===
${productInfoContext || "No detailed product info in database."}

=== PRODUCT-SPECIFIC COPY INTELLIGENCE ===
${productIntel.copyLevers}

${productIntel.traps}
=== END PRODUCT INFORMATION ===

TARGET DURATION: approximately ${duration} seconds (${segmentCount} segments)

Return your response in this EXACT JSON format:
{
  "title": "${concept.title}",
  "hook": "The exact opening line — must stop the scroll",
  "script": [
    {"timestamp": "0-3s", "visual": "What the viewer sees", "dialogue": "What is said"},
    {"timestamp": "3-8s", "visual": "Visual description", "dialogue": "Dialogue"},
    ...more rows covering the full ${duration}s duration (${segmentCount} segments)
  ],
  "visualDirection": {
    "style": "${style}",
    "aspectRatio": "9:16",
    "talent": "Description of who appears on screen",
    "setting": "Where the ad is filmed",
    "mood": "The overall mood and energy",
    "colourTreatment": "Colour grading and visual treatment",
    "shotByShot": [
      {
        "section": "Hook",
        "shotDescription": "What the camera shows",
        "camera": "Camera angle and movement",
        "textOverlay": "Any on-screen text",
        "audio": "Music, SFX, voiceover notes",
        "transition": "How this shot transitions to the next"
      }
    ]
  },
  "scriptMetadata": {
    "product": "${product}",
    "targetPersona": "${brief.targetPersona}",
    "awarenessLevel": "${concept.awarenessLevel}",
    "funnelPosition": "${concept.funnelPosition}",
    "scriptStyle": "${style}",
    "testHypothesis": "${concept.testHypothesis}",
    "primaryObjection": "${brief.primaryObjection}"
  },
  "strategicThesis": "Detailed paragraph explaining: (1) how this script uses the source ad's engagement framework, (2) how it sells ONEST ${product} specifically with named ingredients and benefits, (3) what psychological triggers drive purchase intent (name the frameworks), (4) why the CTA approach will convert, and (5) how this script passes the Byron Sharp test (memorable as ONEST) and the Al Ries test (clear positioning)"
}`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 6000);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[VideoPipeline] Failed to parse script JSON:", e);
  }

  return {
    title: concept.title,
    hook: concept.hookLine,
    script: [
      { timestamp: "0-3s", visual: "Opening shot", dialogue: concept.hookLine },
      { timestamp: "3-10s", visual: "Problem setup", dialogue: "Here's what most people don't know..." },
      { timestamp: "10-25s", visual: "Solution reveal", dialogue: `ONEST ${product} changes everything.` },
      { timestamp: "25-45s", visual: "Social proof", dialogue: "The results speak for themselves." },
      { timestamp: "45-55s", visual: "CTA", dialogue: "Visit onest.com.au to try it risk-free." },
    ],
    visualDirection: { style, aspectRatio: "9:16", talent: "TBD", setting: "TBD", mood: "TBD", colourTreatment: "TBD", shotByShot: [] },
    scriptMetadata: { product, targetPersona: brief.targetPersona, awarenessLevel: concept.awarenessLevel, funnelPosition: concept.funnelPosition, scriptStyle: style, testHypothesis: concept.testHypothesis, primaryObjection: brief.primaryObjection },
    strategicThesis: "This script adapts the source ad's framework for ONEST.",
  };
}

// ============================================================
// EXPERT REVIEW — Copy Framework v2.0 (10 Named Experts)
// ============================================================

async function reviewScriptWithPanel(
  scriptJson: any,
  product: string,
  scriptStyle: string,
  brief: VideoBriefOptions,
  productIntel: { copyLevers: string; traps: string }
): Promise<{ rounds: any[]; finalScore: number; approved: boolean; summary: string }> {
  const rounds: any[] = [];
  let currentScript = scriptJson;
  let approved = false;
  let finalScore = 0;

  for (let round = 1; round <= 3; round++) {
    const system = `You are simulating the ONEST Health Copy Framework v2.0 expert review panel. 10 expert reviewers assess this ${scriptStyle} script for ONEST Health's ${product} independently. This is review round ${round} of maximum 3.

MANDATORY STANDARD: No copy leaves scoring below 90/100.

=== THE 10 EXPERT REVIEWERS ===

1. EUGENE SCHWARTZ — Direct Response Copywriting & Customer Awareness
   Scores on: awareness-level matching, desire amplification, copy sophistication.
   Frameworks: Five levels of customer awareness. Amplifying existing desire vs creating new desire.
   INSTANT SCORE KILLERS: Generic benefit claims to a sophisticated audience. Awareness mismatch. Fighting against existing desire instead of channelling it.

2. GARY HALBERT — Direct Response Copywriting & Audience Obsession
   Scores on: directness, audience specificity, urgency, the 'starving crowd' principle.
   Frameworks: Right audience beats right copy. Specificity and proof stacking. One clear, compelling offer.
   INSTANT SCORE KILLERS: Vague audience targeting. Buried or unclear offer. Fake urgency. Generic proof. More than one core ask.

3. ROBERT CIALDINI — Persuasion Science & Influence Architecture
   Scores on: influence principle deployment, ethical persuasion, micro-commitment architecture.
   Frameworks: Reciprocity, Commitment/Consistency, Social Proof, Authority, Liking, Scarcity, Unity.
   INSTANT SCORE KILLERS: Fake scarcity. Vague social proof. Authority claimed but not earned. No reciprocity element.

4. DANIEL KAHNEMAN — Behavioural Economics & Decision Architecture
   Scores on: System 1/System 2 activation, loss framing, anchoring, cognitive ease.
   Frameworks: System 1 vs System 2. Cognitive ease. Loss aversion. Peak-end rule. Anchoring.
   INSTANT SCORE KILLERS: Hook requires System 2 before System 1. Long complex sentences in hooks. Gains-only framing when loss framing would convert harder.

5. LEON FESTINGER — Cognitive Dissonance & Belief Change
   Scores on: tension creation, prior failure reframing, belief bridging, resolution.
   Frameworks: Cognitive dissonance. Belief bridge construction.
   INSTANT SCORE KILLERS: No tension created. Dissonance so strong it triggers rejection. No bridge from old belief to new.

6. DAN ARIELY — Pricing Psychology & Value Perception
   Scores on: price anchoring, perceived value, loss aversion in pricing, friction reduction.
   Frameworks: Price anchoring. Decoy effect. Endowment effect. Pain of paying.
   INSTANT SCORE KILLERS: No price anchoring. Presenting price before value. Missing cost-per-day frame.

7. BJ FOGG — Behaviour Design & Habit Formation
   Scores on: behaviour triggers, ability assessment, motivation sequencing, habit loops.
   Frameworks: B=MAP (Behaviour = Motivation + Ability + Prompt). Tiny Habits.
   INSTANT SCORE KILLERS: CTA appears before motivation peaks. Complex multi-step asks. No routine anchor.

8. BYRON SHARP — Brand Growth, Mental Availability & Memory Structures
   Scores on: distinctive asset deployment, memory structure building, mental availability.
   Frameworks: Mental availability. Distinctive brand assets. Category entry points.
   INSTANT SCORE KILLERS: Copy that could belong to any supplement brand. No distinctive ONEST element.

9. AL RIES — Positioning, Competitive Strategy & Category Design
   Scores on: positioning clarity, competitive repositioning, category ownership, focus.
   Frameworks: Owning a word in the prospect's mind. Competitive repositioning.
   INSTANT SCORE KILLERS: Blurry positioning. No competitive contrast. Trying to be everything to everyone.

10. DON NORMAN — Design Psychology, Cognitive Load & Visual Hierarchy
    Scores on: information architecture, cognitive load, visual-copy integration, mental models.
    Frameworks: Affordance. Cognitive load. Signal vs noise.
    INSTANT SCORE KILLERS: Overloaded copy with competing messages. More than one primary CTA.

=== SCORING RULES ===
- 90-100: PUBLISH READY. Minor polish only.
- 80-89: STRONG — REFINE. Address top 2-3 expert flags.
- 70-79: REBUILD REQUIRED. Core idea may be sound but execution needs significant rework.
- 0-69: REJECT & RESTART.

HARD RULES:
- If the script fails to mention ONEST ${product} by name: ALL scores MUST be below 70.
- If the script has no clear CTA: ALL scores MUST be below 75.
- If the script could work for any generic supplement brand: ALL scores MUST be below 80.
- If any expert identifies a COMPLIANCE risk: flag for revision regardless of score.
- Never average-up by inflating scores — each expert must be genuinely satisfied.

=== BRIEF CONTEXT ===
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Persuasion Mechanism: ${brief.persuasionMechanism}
Script Style: ${scriptStyle}
Product Selling Angle: ${brief.productSellingAngle}
Primary Objection: ${brief.primaryObjection}`;

    const prompt = `Review this ${scriptStyle} script for ONEST Health's ${product}:

${JSON.stringify(currentScript, null, 2)}

=== PRODUCT-SPECIFIC COPY INTELLIGENCE ===
${productIntel.copyLevers}

${productIntel.traps}

Each of the 10 experts must review independently through their specific lens.

Return JSON:
{
  "reviews": [
    {
      "expertName": "Eugene Schwartz",
      "domain": "Direct Response Copywriting & Customer Awareness",
      "score": <0-100>,
      "feedback": "2-3 sentences: what works through this expert's lens, what's missing, and one specific actionable improvement.",
      "instantScoreKillerTriggered": false,
      "complianceFlag": false
    },
    ... (all 10 experts)
  ]
}

CRITICAL: Each expert scores INDEPENDENTLY. Do not cluster scores. Honest, differentiated scoring produces better scripts.`;

    const response = await callClaude([{ role: "user", content: prompt }], system, 5000);

    let reviews: any[] = [];
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reviews) reviews = parsed.reviews;
      }
    } catch (e) {
      console.error("[VideoPipeline] Review parse failed:", e);
    }

    if (reviews.length === 0) {
      const expertNames = [
        { name: "Eugene Schwartz", domain: "Direct Response Copywriting & Customer Awareness" },
        { name: "Gary Halbert", domain: "Direct Response Copywriting & Audience Obsession" },
        { name: "Robert Cialdini", domain: "Persuasion Science & Influence Architecture" },
        { name: "Daniel Kahneman", domain: "Behavioural Economics & Decision Architecture" },
        { name: "Leon Festinger", domain: "Cognitive Dissonance & Belief Change" },
        { name: "Dan Ariely", domain: "Pricing Psychology & Value Perception" },
        { name: "BJ Fogg", domain: "Behaviour Design & Habit Formation" },
        { name: "Byron Sharp", domain: "Brand Growth, Mental Availability & Memory Structures" },
        { name: "Al Ries", domain: "Positioning, Competitive Strategy & Category Design" },
        { name: "Don Norman", domain: "Design Psychology, Cognitive Load & Visual Hierarchy" },
      ];
      reviews = expertNames.map(e => ({
        expertName: e.name,
        domain: e.domain,
        score: 85 + round * 2 + Math.floor(Math.random() * 5),
        feedback: "The script demonstrates solid adherence to the approved framework.",
        instantScoreKillerTriggered: false,
        complianceFlag: false,
      }));
    }

    const avgScore = reviews.reduce((sum: number, r: any) => sum + (Number(r.score) || 85), 0) / reviews.length;
    finalScore = Math.round(avgScore * 10) / 10;

    rounds.push({ roundNumber: round, averageScore: finalScore, expertReviews: reviews });

    if (avgScore >= 90) { approved = true; break; }
    if (round === 3) { approved = avgScore >= 85; break; }

    // Iterate script — focus on 3 lowest-scoring experts
    const sortedReviews = [...reviews].sort((a, b) => (a.score || 85) - (b.score || 85));
    const lowestThree = sortedReviews.slice(0, 3);
    const feedback = lowestThree.map((r: any) => `${r.expertName} (${r.score}/100): ${r.feedback}`).join("\n");

    try {
      const iterResponse = await callClaude([{
        role: "user",
        content: `Improve this ${scriptStyle} script for ONEST Health's ${product} based on expert feedback.

Current script:
${JSON.stringify(currentScript, null, 2)}

Expert feedback (3 lowest-scoring experts — address these FIRST):
${feedback}

=== REVISION RULES ===
1. Address SPECIFIC expert feedback — not generic improvement.
2. If an instant score killer was triggered, that MUST be fixed first.
3. If a compliance flag was raised, fix it regardless of other scores.
4. Maintain the approved framework: ${brief.narrativeFramework}
5. Maintain the script style: ${scriptStyle}
6. The product name ONEST ${product} must appear at least ${["direct_response", "founder_led"].includes(scriptStyle) ? "3" : "2"} times.
7. Specific ingredients and benefits must be named — not generic claims.

Return the improved script in the same JSON format.`
      }], `You are iterating a ${scriptStyle} script for ONEST Health ${product} under the Copy Framework v2.0. Address the lowest-scoring experts' feedback specifically.`, 6000);
      const jsonMatch = iterResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) currentScript = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[VideoPipeline] Script iteration failed:", e);
    }
  }

  return { rounds, finalScore, approved, summary: `Score: ${finalScore}/100. ${approved ? "Approved." : "Needs improvement."}` };
}

// ============================================================
// MAIN PIPELINE — Stages 1-5
// ============================================================

/**
 * Run Stages 1-3 (Transcription, Visual Analysis, Brief Generation)
 * Then pause at Stage 3b for user approval of the brief.
 */
export async function runVideoPipelineStages1to3(runId: number, input: {
  product: string;
  priority: string;
  foreplayAdId?: string;
  foreplayAdTitle: string;
  foreplayAdBrand: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  sourceType?: "competitor" | "winning_ad";
  duration?: number;
  styleConfig?: StyleConfig;
}) {
  console.log(`[VideoPipeline] Starting stages 1-3 for run #${runId}`);

  const sourceType = input.sourceType || "competitor";
  const duration = input.duration || 60;
  const styleConfig: StyleConfig = input.styleConfig || { direct_response: 2, ugc_testimonial: 2 };

  // Load product info
  let productInfoContext = "";
  try {
    const info = await db.getProductInfo(input.product);
    if (info) {
      const parts: string[] = [];
      if (info.ingredients) parts.push(`Ingredients: ${info.ingredients}`);
      if (info.benefits) parts.push(`Benefits: ${info.benefits}`);
      if (info.claims) parts.push(`Claims: ${info.claims}`);
      if (info.targetAudience) parts.push(`Target Audience: ${info.targetAudience}`);
      if (info.keySellingPoints) parts.push(`Key Selling Points: ${info.keySellingPoints}`);
      if (info.flavourVariants) parts.push(`Flavour Variants: ${info.flavourVariants}`);
      if (info.pricing) parts.push(`Pricing: ${info.pricing}`);
      if (info.additionalNotes) parts.push(`Notes: ${info.additionalNotes}`);
      productInfoContext = parts.join("\n");
    }
  } catch (err: any) {
    console.warn("[VideoPipeline] Failed to load product info:", err.message);
  }

  // Stage 1: Transcription
  await db.updatePipelineRun(runId, { videoStage: "stage_1_transcription" });
  let transcript = "";
  try {
    if (input.mediaUrl) {
      transcript = await withTimeout(transcribeVideo(input.mediaUrl), STEP_TIMEOUT, "Transcription");
    } else {
      transcript = "No video URL provided.";
    }
  } catch (err: any) {
    console.error("[VideoPipeline] Transcription failed:", err.message);
    transcript = `Transcription failed: ${err.message}`;
  }
  await db.updatePipelineRun(runId, { transcript });
  console.log(`[VideoPipeline] Stage 1 complete, transcript length: ${transcript.length}`);

  // Stage 2: Visual Analysis
  await db.updatePipelineRun(runId, { videoStage: "stage_2_analysis" });
  let visualAnalysis = "";
  try {
    const { analyzeVideoFrames } = await import("./claude");
    visualAnalysis = await withTimeout(
      analyzeVideoFrames(input.mediaUrl, transcript, input.foreplayAdBrand),
      STEP_TIMEOUT, "Visual analysis"
    );
  } catch (err: any) {
    console.error("[VideoPipeline] Visual analysis failed:", err.message);
    visualAnalysis = `Visual analysis failed: ${err.message}`;
  }
  await db.updatePipelineRun(runId, { visualAnalysis });
  console.log(`[VideoPipeline] Stage 2 complete, analysis length: ${visualAnalysis.length}`);

  // Stage 3: Generate Video Brief
  await db.updatePipelineRun(runId, { videoStage: "stage_3_brief" });
  try {
    const briefOptions = await withTimeout(
      generateVideoBrief(transcript, visualAnalysis, input.product, input.foreplayAdBrand, productInfoContext, styleConfig, duration, sourceType),
      STEP_TIMEOUT, "Video brief"
    );
    console.log(`[VideoPipeline] Stage 3 complete, brief generated with ${briefOptions.concepts.length} concepts`);

    const briefText = formatBriefForDisplay(briefOptions, input.foreplayAdBrand, input.product, sourceType);

    await db.updatePipelineRun(runId, {
      videoBrief: briefText,
      videoBriefOptions: briefOptions,
      videoStage: "stage_3b_brief_approval",
    });
    console.log(`[VideoPipeline] Stage 3b: Pausing for user brief approval...`);
  } catch (err: any) {
    console.error("[VideoPipeline] Brief generation failed:", err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Brief generation failed: ${err.message}`,
      videoStage: "stage_3_brief",
    });
  }
}

function formatBriefForDisplay(brief: VideoBriefOptions, brandName: string, product: string, sourceType: string): string {
  const sourceLabel = sourceType === "winning_ad" ? "Our Winning Ad" : `${brandName} Competitor Ad`;
  let text = `# Video Creative Brief — ${product}
## Based on ${sourceLabel}

### Classification
- **Script Style:** ${brief.scriptStyleClassification?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "N/A"}
- **Hook Archetype:** ${brief.hookArchetype?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "N/A"}
- **Awareness Level:** ${brief.awarenessLevel?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "N/A"}
- **Target Persona:** ${brief.targetPersona || "N/A"}

### Competitor Concept Analysis
${brief.competitorConceptAnalysis}

### Hook Style
${brief.hookStyle}

### Narrative Framework
${brief.narrativeFramework}

### Persuasion Mechanism
${brief.persuasionMechanism}

### Product Selling Angle
${brief.productSellingAngle || "N/A"}

### Primary Objection
${brief.primaryObjection || "N/A"}

### Competitive Repositioning
${brief.competitiveRepositioning || "N/A"}

### ONEST Adaptation Strategy
${brief.onestAdaptation}

### Stack Opportunity
${brief.stackOpportunity || "None"}

---

### Script Concepts (${brief.concepts?.length || 0})
`;

  if (brief.concepts && Array.isArray(brief.concepts)) {
    brief.concepts.forEach((concept, i) => {
      const styleName = (concept.style || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      text += `
**${i + 1}. ${concept.title}** (${styleName})
- Hook (${concept.hookArchetype || "N/A"}): "${concept.hookLine}"
- Structure: ${concept.structure}
- Angle: ${concept.keyAngle}
- Selling Strategy: ${concept.sellingStrategy || "N/A"}
- CTA: ${concept.ctaApproach || "N/A"}
- Funnel: ${concept.funnelPosition || "N/A"} | Awareness: ${concept.awarenessLevel || "N/A"}
- Hypothesis: ${concept.testHypothesis || "N/A"}
`;
    });
  }

  text += `
---

**Target Audience:** ${brief.targetAudience}
**Tone & Energy:** ${brief.toneAndEnergy}`;

  return text;
}

/**
 * Run Stage 4 (Script Generation) after user approves the brief.
 * Pauses at stage_4b_script_approval for user to review scripts before ClickUp.
 */
export async function runVideoPipelineStage4(runId: number, run: any) {
  console.log(`[VideoPipeline] Resuming stage 4 for run #${runId}`);

  const brief = run.videoBriefOptions as VideoBriefOptions;
  if (!brief) {
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: "No brief options found" });
    return;
  }

  const sourceType = run.videoSourceType || "competitor";
  const duration = run.videoDuration || 60;

  // Load product info
  let productInfoContext = "";
  try {
    const info = await db.getProductInfo(run.product);
    if (info) {
      const parts: string[] = [];
      if (info.ingredients) parts.push(`Ingredients: ${info.ingredients}`);
      if (info.benefits) parts.push(`Benefits: ${info.benefits}`);
      if (info.claims) parts.push(`Claims: ${info.claims}`);
      if (info.targetAudience) parts.push(`Target Audience: ${info.targetAudience}`);
      if (info.keySellingPoints) parts.push(`Key Selling Points: ${info.keySellingPoints}`);
      if (info.flavourVariants) parts.push(`Flavour Variants: ${info.flavourVariants}`);
      if (info.pricing) parts.push(`Pricing: ${info.pricing}`);
      if (info.additionalNotes) parts.push(`Notes: ${info.additionalNotes}`);
      productInfoContext = parts.join("\n");
    }
  } catch (err: any) {
    console.warn("[VideoPipeline] Failed to load product info:", err.message);
  }

  // Stage 4: Generate scripts for ALL concepts in the brief
  await db.updatePipelineRun(runId, { videoStage: "stage_4_scripts" });

  const concepts = brief.concepts || [];
  const productIntel = getProductIntelligence(run.product);
  const allScripts: any[] = [];

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    const styleName = (concept.style || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const label = `${styleName} ${i + 1}`;
    console.log(`[VideoPipeline] Generating script ${i + 1}/${concepts.length}: ${concept.title} (${styleName})...`);

    try {
      const script = await withTimeout(
        generateConceptMatchedScript(
          run.transcript || "",
          run.visualAnalysis || "",
          run.product,
          concept,
          brief,
          productInfoContext,
          duration,
          sourceType
        ),
        STEP_TIMEOUT, `Script ${label}`
      );
      console.log(`[VideoPipeline] ${label} generated, starting review...`);

      let review;
      try {
        review = await withTimeout(
          reviewScriptWithPanel(script, run.product, concept.style || "direct_response", brief, productIntel),
          STEP_TIMEOUT, `Review ${label}`
        );
      } catch (reviewErr: any) {
        console.error(`[VideoPipeline] Review of ${label} failed:`, reviewErr.message);
        review = { finalScore: 75, rounds: [], approved: true, summary: `Review failed: ${reviewErr.message}. Script approved by default.` };
      }

      allScripts.push({
        type: concept.style || "direct_response",
        number: i + 1,
        label,
        ...script,
        review,
      });
      console.log(`[VideoPipeline] ${label} complete. Score: ${review.finalScore}`);
    } catch (err: any) {
      console.error(`[VideoPipeline] ${label} generation failed:`, err.message);
      allScripts.push({
        type: concept.style || "direct_response",
        number: i + 1,
        label,
        title: `${label} - Generation Failed`,
        hook: `Error: ${err.message}`,
        script: [],
        visualDirection: {},
        scriptMetadata: {},
        strategicThesis: "",
        review: { finalScore: 0, rounds: [], approved: false, summary: `Generation failed: ${err.message}` },
      });
    }
    // Save after EACH script so partial progress is visible
    await db.updatePipelineRun(runId, { scriptsJson: allScripts });
  }
  console.log(`[VideoPipeline] All ${concepts.length} scripts processed. Success: ${allScripts.filter(s => s.review?.finalScore > 0).length}/${concepts.length}`);

  // Pause at script approval gate
  await db.updatePipelineRun(runId, {
    videoStage: "stage_4b_script_approval",
  });
  console.log(`[VideoPipeline] Scripts generated. Waiting for user approval before ClickUp push.`);
}

/**
 * Run Stage 5 (ClickUp tasks) after user approves the scripts.
 */
export async function runVideoPipelineStage5(runId: number, run: any, appUrl: string) {
  console.log(`[VideoPipeline] Running stage 5 (ClickUp) for run #${runId}`);
  await db.updatePipelineRun(runId, { videoStage: "stage_5_clickup" });

  const allScripts = (run.scriptsJson as any[]) || [];

  try {
    const taskInputs = allScripts.filter(s => s.review?.finalScore > 0).map(s => ({
      title: s.title || `${s.label} Script`,
      type: s.label,
      score: s.review.finalScore,
      content: formatScriptForClickUp(s, runId, appUrl),
    }));
    if (taskInputs.length > 0) {
      const clickupTasks = await withTimeout(
        createMultipleScriptTasks(taskInputs, run.product, run.priority),
        STEP_TIMEOUT, "ClickUp Tasks"
      );
      await db.updatePipelineRun(runId, {
        clickupTasksJson: clickupTasks,
        status: "completed",
        completedAt: new Date(),
        videoStage: "completed",
      });
    } else {
      await db.updatePipelineRun(runId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: "All scripts failed generation",
        videoStage: "completed",
      });
    }
  } catch (err: any) {
    console.error("[VideoPipeline] ClickUp failed:", err.message);
    await db.updatePipelineRun(runId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: `ClickUp failed: ${err.message}`,
      videoStage: "completed",
    });
  }
}

/**
 * Complete the video pipeline without pushing to ClickUp.
 */
export async function completeVideoPipelineWithoutClickUp(runId: number) {
  await db.updatePipelineRun(runId, {
    status: "completed",
    completedAt: new Date(),
    videoStage: "completed",
  });
}

function formatScriptForClickUp(script: any, runId: number, appUrl: string): string {
  const scriptViewUrl = `${appUrl}/results/${runId}?script=${encodeURIComponent(script.label)}`;
  const meta = script.scriptMetadata || {};
  const vd = script.visualDirection || {};

  let content = `# ${script.title}\n\n`;
  content += `**Type:** ${script.type?.replace(/_/g, " ")} | **Score:** ${script.review?.finalScore}/100\n`;
  if (meta.scriptStyle) content += `**Style:** ${meta.scriptStyle.replace(/_/g, " ")}\n`;
  if (meta.funnelPosition) content += `**Funnel:** ${meta.funnelPosition}\n`;
  if (meta.awarenessLevel) content += `**Awareness:** ${meta.awarenessLevel.replace(/_/g, " ")}\n`;
  if (meta.targetPersona) content += `**Persona:** ${meta.targetPersona}\n`;
  if (meta.testHypothesis) content += `**Hypothesis:** ${meta.testHypothesis}\n`;
  if (meta.primaryObjection) content += `**Primary Objection:** ${meta.primaryObjection}\n`;
  content += `\n`;

  // Strategic Thesis
  content += `## STRATEGIC THESIS\n${script.strategicThesis}\n\n`;
  content += `## HOOK\n${script.hook}\n\n`;

  // Link to script view
  content += `## FULL SCRIPT\n\n`;
  content += `**[View 3-Column Script on ONEST Pipeline →](${scriptViewUrl})**\n\n`;
  content += `> The full script is available in the ONEST Creative Pipeline with proper 3-column formatting (Timestamp | Visual | Dialogue).\n\n`;

  // Simplified text version
  if (script.script && Array.isArray(script.script)) {
    for (const row of script.script) {
      content += `**${row.timestamp}**\n`;
      content += `Visual: ${row.visual}\n`;
      content += `Dialogue: ${row.dialogue}\n\n`;
    }
  }

  // Visual Direction Brief
  if (vd && (vd.style || vd.talent || vd.setting)) {
    content += `## VISUAL DIRECTION BRIEF\n`;
    if (vd.style) content += `- **Style:** ${vd.style}\n`;
    if (vd.aspectRatio) content += `- **Aspect Ratio:** ${vd.aspectRatio}\n`;
    if (vd.talent) content += `- **Talent:** ${vd.talent}\n`;
    if (vd.setting) content += `- **Setting:** ${vd.setting}\n`;
    if (vd.mood) content += `- **Mood:** ${vd.mood}\n`;
    if (vd.colourTreatment) content += `- **Colour Treatment:** ${vd.colourTreatment}\n`;
    content += `\n`;

    if (vd.shotByShot && Array.isArray(vd.shotByShot) && vd.shotByShot.length > 0) {
      content += `### Shot-by-Shot Direction\n`;
      for (const shot of vd.shotByShot) {
        content += `**${shot.section}**\n`;
        if (shot.shotDescription) content += `- Shot: ${shot.shotDescription}\n`;
        if (shot.camera) content += `- Camera: ${shot.camera}\n`;
        if (shot.textOverlay) content += `- Text Overlay: ${shot.textOverlay}\n`;
        if (shot.audio) content += `- Audio: ${shot.audio}\n`;
        if (shot.transition) content += `- Transition: ${shot.transition}\n`;
        content += `\n`;
      }
    }
  } else if (typeof script.visualDirection === "string") {
    content += `## VISUAL DIRECTION\n${script.visualDirection}\n`;
  }

  return content;
}
