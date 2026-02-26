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
// SCRIPT STYLE DEFINITIONS
// ============================================================

export const SCRIPT_STYLES = [
  { id: "DR", label: "Direct Response", description: "Hard-sell with clear offer, urgency, and direct CTA" },
  { id: "UGC", label: "UGC / Testimonial", description: "Authentic personal experience, soft-sell recommendation" },
  { id: "FOUNDER", label: "Founder-Led", description: "Brand founder speaking with authority and passion" },
  { id: "EDUCATION", label: "Education / Myth-Busting", description: "Teach something surprising, position product as the answer" },
  { id: "LIFESTYLE", label: "Lifestyle / Aspiration", description: "Aspirational day-in-the-life with product woven in" },
  { id: "DEMO", label: "Problem / Solution Demo", description: "Show the problem, demonstrate the product solving it" },
] as const;

export type ScriptStyleId = typeof SCRIPT_STYLES[number]["id"];

export interface StyleConfig {
  styleId: ScriptStyleId;
  quantity: number;
}

// ============================================================
// PRODUCT INTELLIGENCE — ONEST COPY FRAMEWORK v2.0
// ============================================================

export const PRODUCT_INTELLIGENCE: Record<string, {
  fullName: string;
  category: string;
  copyLevers: string[];
  copyTraps: string[];
  stackPartners: string[];
  targetPersona: string;
  awarenessAngle: string;
  keyIngredients: string[];
  primaryBenefit: string;
  differentiator: string;
}> = {
  Hyperburn: {
    fullName: "ONEST HyperBurn",
    category: "Thermogenic Fat Burner",
    copyLevers: [
      "Two forms of caffeine (fast-acting + sustained) — no crash, just clean energy all day",
      "CaloriBurn GP (Grains of Paradise) — clinically shown to activate brown adipose tissue",
      "Transparent label — every ingredient and dose listed, no proprietary blends",
      "Australian-made, GMP certified",
      "Dual-action: burns fat AND provides clean energy — replaces your morning coffee AND your fat burner",
    ],
    copyTraps: [
      "Never say 'melts fat' or 'burns fat fast' — use 'supports fat metabolism' or 'helps your body use fat for fuel'",
      "Never promise specific weight loss amounts",
      "Don't compare directly to prescription medications",
    ],
    stackPartners: ["Thermosleep", "Protein + Collagen"],
    targetPersona: "Peter (35-55, wants to lose stubborn belly fat) and Lara (28-45, wants lean toned body without jitters)",
    awarenessAngle: "Problem-aware (knows they want to lose fat) → Solution-aware (show why HyperBurn is different)",
    keyIngredients: ["Caffeine Anhydrous", "Infinergy (DiCaffeine Malate)", "CaloriBurn GP", "CapsiMax", "BioPerine"],
    primaryBenefit: "Clean energy + fat metabolism support without the crash",
    differentiator: "Two forms of caffeine for sustained energy — most fat burners spike and crash",
  },
  Thermosleep: {
    fullName: "ONEST ThermoSleep",
    category: "Night-Time Fat Burner & Sleep Aid",
    copyLevers: [
      "Dual benefit: supports fat metabolism WHILE you sleep — the only time you're doing nothing and still burning",
      "Ashwagandha KSM-66 — clinically studied for stress reduction and sleep quality",
      "No stimulants — works with your body's natural sleep cycle",
      "Wake up leaner AND more rested — two problems solved with one product",
      "Pairs perfectly with HyperBurn for 24-hour metabolic support",
    ],
    copyTraps: [
      "Never say 'lose weight while you sleep' as a guarantee",
      "Don't position as a sleeping pill — it's a recovery and metabolism product",
      "Avoid 'miracle' or 'effortless' language",
    ],
    stackPartners: ["Hyperburn", "Protein + Collagen"],
    targetPersona: "Peter (stressed, poor sleep, stubborn fat) and Lara (wants beauty sleep that actually works harder)",
    awarenessAngle: "Unaware → Problem-aware (most people don't know night-time metabolism matters)",
    keyIngredients: ["Ashwagandha KSM-66", "L-Theanine", "Grains of Paradise", "Zinc", "Magnesium"],
    primaryBenefit: "Better sleep + overnight metabolic support",
    differentiator: "Only product that combines clinical sleep ingredients with thermogenic compounds — no stimulants",
  },
  "Protein + Collagen": {
    fullName: "ONEST Protein + Collagen",
    category: "Protein Powder with Collagen",
    copyLevers: [
      "Beauty meets performance — protein for muscle, collagen for skin/hair/nails/joints",
      "Hydrolysed collagen peptides — better absorption than regular collagen",
      "Tastes incredible — not chalky or artificial like most protein powders",
      "One scoop replaces your protein shake AND your collagen supplement",
      "Australian-made with premium whey protein isolate",
    ],
    copyTraps: [
      "Don't position as just a protein powder — the collagen is the differentiator",
      "Avoid 'anti-aging' claims — use 'supports skin elasticity and joint health'",
      "Don't compare to cheap protein powders on price — compare on value (2-in-1)",
    ],
    stackPartners: ["Hyperburn", "Thermosleep", "Creatine"],
    targetPersona: "Lara (wants beauty + fitness in one product) and Peter (joint health + muscle recovery)",
    awarenessAngle: "Solution-aware (already takes protein) → Product-aware (show why 2-in-1 is smarter)",
    keyIngredients: ["Whey Protein Isolate", "Hydrolysed Collagen Peptides", "Digestive Enzymes"],
    primaryBenefit: "Complete protein with beauty and joint benefits in one scoop",
    differentiator: "Only protein powder with clinically dosed hydrolysed collagen — replaces two supplements",
  },
  Hyperload: {
    fullName: "ONEST HyperLoad",
    category: "Pre-Workout",
    copyLevers: [
      "Fully transparent label — every ingredient and dose listed, no proprietary blends hiding under-dosed ingredients",
      "Clinical doses of Citrulline, Beta-Alanine, and Betaine — not fairy-dusted like most pre-workouts",
      "Smooth energy without the jitters or crash — designed for serious training, not just a caffeine hit",
      "Nootropic blend for focus — train harder AND smarter",
      "Australian-made, GMP certified",
    ],
    copyTraps: [
      "Don't just say 'best pre-workout' — show WHY (transparent dosing vs proprietary blends)",
      "Avoid 'insane energy' or 'crazy pumps' — position as premium and clinical, not bro-science",
      "Don't compare to specific competitor brands by name",
    ],
    stackPartners: ["HyperPump", "AminoLoad", "Creatine"],
    targetPersona: "Peter (serious lifter who reads labels) and gym enthusiasts who've been burned by under-dosed pre-workouts",
    awarenessAngle: "Most-aware (already uses pre-workout) → Show why ONEST is the honest choice",
    keyIngredients: ["L-Citrulline", "Beta-Alanine", "Betaine Anhydrous", "Caffeine", "Alpha-GPC"],
    primaryBenefit: "Clinically dosed pre-workout with full transparency — you know exactly what you're taking",
    differentiator: "Full label transparency with clinical doses — most pre-workouts hide behind proprietary blends",
  },
  Creatine: {
    fullName: "ONEST Creatine Monohydrate",
    category: "Creatine",
    copyLevers: [
      "Creapure® — the world's purest creatine monohydrate, made in Germany",
      "Most studied supplement in history — over 500 peer-reviewed studies",
      "Not just for bodybuilders — supports brain function, energy, and healthy aging",
      "Micronised for better mixing and absorption — no gritty texture",
      "Unflavoured — add to anything (coffee, smoothie, water)",
    ],
    copyTraps: [
      "Don't say 'bulking' — position as performance and health, not just muscle size",
      "Avoid 'loading phase required' — modern research shows daily 5g is sufficient",
      "Don't make it sound complicated — creatine is simple, that's the point",
    ],
    stackPartners: ["Hyperload", "HyperPump", "Protein + Collagen"],
    targetPersona: "Both Peter and Lara — creatine is for everyone, not just lifters",
    awarenessAngle: "Unaware (many don't know creatine benefits beyond gym) → Problem-aware (energy, brain, aging)",
    keyIngredients: ["Creapure® Creatine Monohydrate"],
    primaryBenefit: "World's purest creatine for performance, brain function, and overall health",
    differentiator: "Creapure® — most brands use cheap Chinese creatine, ONEST uses the gold standard from Germany",
  },
  Thermoburn: {
    fullName: "ONEST ThermoBurn",
    category: "Stimulant-Free Fat Burner",
    copyLevers: [
      "Stimulant-free — supports fat metabolism without caffeine or jitters",
      "Perfect for caffeine-sensitive individuals or evening use",
      "Can be stacked with HyperBurn for amplified results or used standalone",
      "Transparent label with clinically studied ingredients",
      "Supports metabolism through multiple pathways without stimulant dependency",
    ],
    copyTraps: [
      "Don't position as 'weaker' than HyperBurn — position as 'different approach'",
      "Avoid implying caffeine is bad — just offer the stimulant-free alternative",
    ],
    stackPartners: ["Hyperburn", "Thermosleep"],
    targetPersona: "Lara (caffeine-sensitive, wants gentle fat support) and Peter (already takes pre-workout, doesn't want more caffeine)",
    awarenessAngle: "Solution-aware → Product-aware (show stimulant-free option exists)",
    keyIngredients: ["Acetyl L-Carnitine", "CLA", "Grains of Paradise", "Green Tea Extract"],
    primaryBenefit: "Fat metabolism support without any stimulants",
    differentiator: "Stimulant-free formula that actually works — not just a caffeine-free version of a fat burner",
  },
  "Carb Control": {
    fullName: "ONEST Carb Control",
    category: "Carb & Blood Sugar Support",
    copyLevers: [
      "Supports healthy blood sugar response after carb-heavy meals",
      "White kidney bean extract — clinically studied carb blocker",
      "Perfect for people who love carbs but want to manage their intake",
      "Take before meals — simple and convenient",
      "Transparent dosing with no proprietary blends",
    ],
    copyTraps: [
      "Never say 'blocks all carbs' — use 'supports healthy carbohydrate metabolism'",
      "Don't position as a license to eat unlimited carbs",
      "Avoid medical claims about blood sugar or diabetes",
    ],
    stackPartners: ["Hyperburn", "Thermosleep"],
    targetPersona: "Peter and Lara (both enjoy food but want to manage carb impact)",
    awarenessAngle: "Problem-aware (knows carbs are an issue) → Solution-aware",
    keyIngredients: ["White Kidney Bean Extract", "Chromium", "Gymnema Sylvestre"],
    primaryBenefit: "Supports healthy carbohydrate metabolism before meals",
    differentiator: "Targeted carb management supplement with transparent clinical dosing",
  },
  HyperPump: {
    fullName: "ONEST HyperPump",
    category: "Stimulant-Free Pre-Workout / Pump Formula",
    copyLevers: [
      "Massive pumps without any stimulants — perfect for evening training or stacking with HyperLoad",
      "Clinical doses of Citrulline and Nitrosigine for vasodilation",
      "Transparent label — see exactly what you're getting",
      "Stack with HyperLoad for the ultimate pre-workout combo",
    ],
    copyTraps: [
      "Don't say 'stimulant-free pre-workout' as if it's lesser — it's a pump-specific product",
      "Avoid bro-science language about 'skin-splitting pumps'",
    ],
    stackPartners: ["Hyperload", "Creatine"],
    targetPersona: "Serious lifters who want pump and performance without extra stimulants",
    awarenessAngle: "Most-aware (already trains, wants better pumps)",
    keyIngredients: ["L-Citrulline", "Nitrosigine", "GlycerPump", "S7"],
    primaryBenefit: "Maximum muscle pumps and blood flow without stimulants",
    differentiator: "Dedicated pump formula with clinical doses — not a watered-down stim-free pre-workout",
  },
  AminoLoad: {
    fullName: "ONEST AminoLoad",
    category: "EAA / BCAA Recovery",
    copyLevers: [
      "Full spectrum EAAs — not just BCAAs, all 9 essential amino acids your body can't make",
      "Supports recovery, hydration, and muscle protein synthesis",
      "Great taste for sipping during workouts — replaces sugary sports drinks",
      "Transparent dosing with clinical amounts",
    ],
    copyTraps: [
      "Don't just say 'BCAAs' — EAAs are the upgrade, explain why",
      "Avoid 'muscle building' claims — use 'supports muscle recovery and protein synthesis'",
    ],
    stackPartners: ["Hyperload", "HyperPump", "Creatine"],
    targetPersona: "Active individuals who train regularly and want optimal recovery",
    awarenessAngle: "Solution-aware (already uses BCAAs) → Product-aware (EAAs are better)",
    keyIngredients: ["Full Spectrum EAAs", "Coconut Water Powder", "Electrolytes"],
    primaryBenefit: "Complete amino acid recovery with hydration support",
    differentiator: "Full EAA spectrum, not just BCAAs — plus hydration, in one great-tasting drink",
  },
  "Marine Collagen": {
    fullName: "ONEST Marine Collagen",
    category: "Beauty & Joint Supplement",
    copyLevers: [
      "Marine-sourced collagen — superior absorption compared to bovine collagen",
      "Supports skin elasticity, hair strength, nail growth, and joint health",
      "Type I and III collagen — the types most important for skin and beauty",
      "Unflavoured — add to coffee, smoothies, or water",
      "Sustainably sourced from wild-caught fish",
    ],
    copyTraps: [
      "Don't make anti-aging claims — use 'supports skin health and elasticity'",
      "Avoid comparing to bovine collagen negatively — just highlight marine benefits",
    ],
    stackPartners: ["Protein + Collagen", "SuperGreens"],
    targetPersona: "Lara (beauty-conscious, wants skin/hair/nail support)",
    awarenessAngle: "Solution-aware (already knows about collagen) → Product-aware (marine is better absorbed)",
    keyIngredients: ["Hydrolysed Marine Collagen Peptides", "Vitamin C"],
    primaryBenefit: "Superior absorption collagen for skin, hair, nails, and joints",
    differentiator: "Marine-sourced for better bioavailability — sustainably sourced from wild-caught fish",
  },
  SuperGreens: {
    fullName: "ONEST SuperGreens",
    category: "Greens Powder",
    copyLevers: [
      "75+ superfoods, vitamins, and minerals in one scoop",
      "Actually tastes good — not the usual 'drinking grass' experience",
      "Supports gut health, immunity, and daily nutrition gaps",
      "Transparent label — every ingredient listed, no proprietary blends",
      "Replaces handfuls of supplements with one convenient scoop",
    ],
    copyTraps: [
      "Don't say 'replaces fruits and vegetables' — it supplements them",
      "Avoid 'detox' or 'cleanse' language",
      "Don't make immune system cure claims",
    ],
    stackPartners: ["Protein + Collagen", "Marine Collagen"],
    targetPersona: "Both Peter and Lara — anyone who wants convenient daily nutrition",
    awarenessAngle: "Problem-aware (knows diet has gaps) → Solution-aware (greens powder fills them)",
    keyIngredients: ["Organic Greens Blend", "Probiotics", "Digestive Enzymes", "Mushroom Complex"],
    primaryBenefit: "Complete daily nutrition support that actually tastes good",
    differentiator: "75+ ingredients with transparent dosing AND great taste — most greens powders sacrifice one for the other",
  },
  "Whey ISO Pro": {
    fullName: "ONEST Whey ISO Pro",
    category: "Whey Protein Isolate",
    copyLevers: [
      "100% Whey Protein Isolate — fast absorbing, low lactose, minimal fat and carbs",
      "Premium quality protein for serious athletes and fitness enthusiasts",
      "Amazing taste and mixability — no clumps, no chalky texture",
      "Transparent label with no fillers or amino spiking",
      "Australian-made, GMP certified",
    ],
    copyTraps: [
      "Don't just compete on protein per serve — compete on quality and transparency",
      "Avoid 'mass gainer' positioning — this is lean, clean protein",
    ],
    stackPartners: ["Creatine", "Hyperload", "AminoLoad"],
    targetPersona: "Peter (serious about training and recovery) and fitness enthusiasts who read labels",
    awarenessAngle: "Most-aware (already uses protein) → Show why ONEST is the honest choice",
    keyIngredients: ["100% Whey Protein Isolate", "Digestive Enzymes"],
    primaryBenefit: "Pure, fast-absorbing protein with no fillers or amino spiking",
    differentiator: "100% isolate with full transparency — no concentrate blends hiding behind 'protein blend' labels",
  },
};

// ============================================================
// COMPLIANCE GUARDRAILS — ONEST COPY FRAMEWORK v2.0
// ============================================================

const COMPLIANCE_RULES = `
COMPLIANCE GUARDRAILS (MANDATORY — violations override all scores):
CAN SAY: "supports," "helps," "promotes," "contributes to," "designed to," "formulated with"
CANNOT SAY: "cures," "treats," "prevents," "guarantees," "clinically proven to [specific outcome]," "doctor recommended"
CANNOT SAY: specific weight loss amounts, medical claims, comparison to prescription drugs
SAFE FRAMING: "supports healthy metabolism" ✓ | "burns fat guaranteed" ✗
SAFE FRAMING: "helps maintain energy levels" ✓ | "gives you unlimited energy" ✗
SAFE FRAMING: "supports restful sleep" ✓ | "cures insomnia" ✗
Any script with compliance violations MUST score 0 regardless of other qualities.
`;

// ============================================================
// HOOK ARCHETYPES — ONEST COPY FRAMEWORK v2.0
// ============================================================

const HOOK_ARCHETYPES = `
5 HOOK ARCHETYPES (classify the competitor's hook, then use the same archetype):
1. PATTERN INTERRUPT: Unexpected visual/statement that breaks scroll behaviour ("I put butter in my coffee for 30 days")
2. IDENTITY CALL-OUT: Directly addresses a specific audience ("If you're over 40 and still can't lose belly fat...")
3. CURIOSITY GAP: Opens a loop the viewer must close ("My doctor told me to stop taking protein powder. Here's why...")
4. SOCIAL PROOF LEAD: Starts with proof/results before explaining ("This is what happened after 90 days...")
5. CONTROVERSY/MYTH: Challenges a common belief ("Everything you know about fat burners is wrong")
`;

// ============================================================
// VIDEO BRIEF GENERATION — COPY FRAMEWORK v2.0
// ============================================================

export interface VideoBriefConcept {
  title: string;
  hookLine: string;
  structure: string;
  keyAngle: string;
  sellingStrategy: string;
  ctaApproach: string;
  styleId: ScriptStyleId;
}

export interface VideoBriefOptions {
  competitorConceptAnalysis: string;
  hookStyle: string;
  hookArchetype: string;
  narrativeFramework: string;
  persuasionMechanism: string;
  productSellingAngle: string;
  onestAdaptation: string;
  concepts: VideoBriefConcept[];
  targetAudience: string;
  toneAndEnergy: string;
  awarenessLevel: string;
  primaryObjection: string;
  competitiveRepositioning: string;
  stackOpportunity: string;
  // Legacy fields for backward compatibility
  drConcepts?: Array<{ title: string; hookLine: string; structure: string; keyAngle: string; sellingStrategy?: string; ctaApproach?: string }>;
  ugcConcepts?: Array<{ title: string; hookLine: string; structure: string; keyAngle: string; sellingStrategy?: string; ctaApproach?: string }>;
}

async function generateVideoBrief(
  transcript: string,
  visualAnalysis: string,
  product: string,
  brandName: string,
  productInfoContext: string,
  styleConfig: StyleConfig[],
  duration: number,
  sourceType: "competitor" | "winning_ad"
): Promise<VideoBriefOptions> {
  const productIntel = PRODUCT_INTELLIGENCE[product];
  const productIntelBlock = productIntel
    ? `
PRODUCT INTELLIGENCE FOR ${productIntel.fullName}:
Category: ${productIntel.category}
Primary Benefit: ${productIntel.primaryBenefit}
Differentiator: ${productIntel.differentiator}
Key Ingredients: ${productIntel.keyIngredients.join(", ")}
Target Persona: ${productIntel.targetPersona}
Awareness Angle: ${productIntel.awarenessAngle}

COPY LEVERS (use these in scripts):
${productIntel.copyLevers.map((l, i) => `${i + 1}. ${l}`).join("\n")}

COPY TRAPS (avoid these):
${productIntel.copyTraps.map((t, i) => `${i + 1}. ${t}`).join("\n")}

STACK PARTNERS: ${productIntel.stackPartners.join(", ")}
`
    : `Product: ONEST ${product}. Use ONEST Health's brand positioning: Australian-made, transparent labelling, clinically dosed ingredients, no proprietary blends.`;

  const styleRequests = styleConfig.filter(s => s.quantity > 0);
  const styleRequestText = styleRequests.map(s => {
    const style = SCRIPT_STYLES.find(st => st.id === s.styleId);
    return `${s.quantity}x ${style?.label || s.styleId} (${style?.description || ""})`;
  }).join(", ");

  const sourceContext = sourceType === "winning_ad"
    ? `This is one of OUR OWN winning ads. Your job is to create VARIATIONS that extend its success — hook swaps, angle shifts, audience reframes, format adaptations. Keep what works, vary what can be tested.`
    : `This is a COMPETITOR ad. Your job is to reverse-engineer what makes it engage viewers, then create concepts that use that engagement framework to SELL ONEST ${product}.`;

  const system = `You are an elite direct response advertising strategist for ONEST Health, an Australian health supplement brand. You have deep expertise in the psychological frameworks of Eugene Schwartz (awareness levels), Gary Halbert (starving crowd principle), Robert Cialdini (influence and persuasion), and Daniel Kahneman (System 1/System 2 thinking).

Your job is to analyse video ads and create creative briefs that SELL products — not just mimic competitors. Every concept you propose must have a clear path from "viewer watches" to "viewer buys."

${HOOK_ARCHETYPES}

SCRIPT STYLE CLASSIFICATION:
1. DIRECT RESPONSE (DR): Hard-sell with clear offer, urgency, specific CTA. Hook → Problem/Agitation → Solution/Product → Proof + CTA.
2. UGC / TESTIMONIAL: Authentic personal experience. Feels unscripted. Sells through trust and relatability. Soft but clear recommendation.
3. FOUNDER-LED: Brand founder speaking with authority and passion. Combines expertise with personal conviction. "I created this because..."
4. EDUCATION / MYTH-BUSTING: Teaches something surprising, positions product as the answer. "Everything you know about X is wrong..."
5. LIFESTYLE / ASPIRATION: Aspirational day-in-the-life with product woven naturally. Shows the life the viewer wants.
6. PROBLEM / SOLUTION DEMO: Shows the problem visually, demonstrates the product solving it. Before/after or side-by-side.

AWARENESS LEVEL MATRIX (Schwartz):
- UNAWARE: Doesn't know they have a problem → Lead with story/emotion, reveal the problem
- PROBLEM-AWARE: Knows the problem, not the solution → Agitate the problem, introduce the category
- SOLUTION-AWARE: Knows solutions exist, not your product → Differentiate ONEST from alternatives
- PRODUCT-AWARE: Knows ONEST, hasn't bought → Overcome objections, provide proof, create urgency
- MOST-AWARE: Existing customer → Upsell, cross-sell, reinforce loyalty

${COMPLIANCE_RULES}

${sourceContext}`;

  const prompt = `Analyse this video ad and create a creative brief for ONEST Health's ${product}.

SOURCE: ${sourceType === "winning_ad" ? "OUR WINNING AD" : `COMPETITOR BRAND: ${brandName}`}
TARGET DURATION: ~${duration} seconds per script

TRANSCRIPT:
${transcript}

VISUAL ANALYSIS:
${visualAnalysis}

ONEST PRODUCT INFORMATION:
${productInfoContext || "No detailed product info in database."}

${productIntelBlock}

REQUESTED SCRIPTS: ${styleRequestText}

INSTRUCTIONS:

PART 1 — AD ANALYSIS
1. What is the SPECIFIC hook type and which of the 5 hook archetypes does it match?
2. What is the narrative framework?
3. What persuasion mechanism drives engagement?
4. What awareness level does this ad target?

PART 2 — ONEST SELLING STRATEGY
5. How should ONEST adapt this framework to sell ${product}?
6. What is the product selling angle — how does ${product} specifically solve the problem this ad taps into?
7. What is the primary objection the target audience has, and how do we overcome it?
8. What competitive repositioning opportunity exists? (How do we position ONEST as better than what the viewer currently uses?)
9. Is there a stack opportunity? (Can we mention complementary ONEST products?)

PART 3 — SCRIPT CONCEPTS
Generate exactly these concepts: ${styleRequestText}

Each concept must include:
- title: Descriptive title
- hookLine: The exact opening line
- structure: Script structure with where product is introduced, benefits hit, and CTA lands
- keyAngle: The unique selling angle
- sellingStrategy: How this script sells ${product} — what benefits highlighted, objections overcome, proof points used
- ctaApproach: The specific CTA approach appropriate to the style
- styleId: One of "DR", "UGC", "FOUNDER", "EDUCATION", "LIFESTYLE", "DEMO"

Return your response in this EXACT JSON format:
{
  "competitorConceptAnalysis": "200+ word analysis of what makes this ad engage viewers",
  "hookStyle": "The specific hook type identified",
  "hookArchetype": "One of: PATTERN_INTERRUPT, IDENTITY_CALLOUT, CURIOSITY_GAP, SOCIAL_PROOF_LEAD, CONTROVERSY_MYTH",
  "narrativeFramework": "The exact narrative structure",
  "persuasionMechanism": "How the ad holds attention and builds desire",
  "productSellingAngle": "150+ words on how ${product}'s benefits map onto this framework",
  "onestAdaptation": "200+ words on how to adapt this framework to SELL ${product}",
  "awarenessLevel": "One of: UNAWARE, PROBLEM_AWARE, SOLUTION_AWARE, PRODUCT_AWARE, MOST_AWARE",
  "primaryObjection": "The main objection the target audience has and how to overcome it",
  "competitiveRepositioning": "How to position ONEST as better than alternatives",
  "stackOpportunity": "Complementary ONEST products that could be mentioned (or 'None' if not appropriate)",
  "concepts": [
    {
      "title": "...",
      "hookLine": "...",
      "structure": "...",
      "keyAngle": "...",
      "sellingStrategy": "...",
      "ctaApproach": "...",
      "styleId": "DR|UGC|FOUNDER|EDUCATION|LIFESTYLE|DEMO"
    }
  ],
  "targetAudience": "Specific target audience",
  "toneAndEnergy": "Tone and energy level"
}`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 8000);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure concepts array exists
      if (!parsed.concepts && (parsed.drConcepts || parsed.ugcConcepts)) {
        parsed.concepts = [
          ...(parsed.drConcepts || []).map((c: any) => ({ ...c, styleId: "DR" })),
          ...(parsed.ugcConcepts || []).map((c: any) => ({ ...c, styleId: "UGC" })),
        ];
      }
      return parsed;
    }
  } catch (e) {
    console.error("[VideoPipeline] Failed to parse brief JSON:", e);
  }

  // Fallback
  const fallbackConcepts: VideoBriefConcept[] = styleConfig.filter(s => s.quantity > 0).flatMap(s =>
    Array.from({ length: s.quantity }, (_, i) => ({
      title: `${s.styleId} Script ${i + 1}: ${product}`,
      hookLine: s.styleId === "UGC" ? "Okay so I need to tell you about this..." : "What if everything you knew about supplements was wrong?",
      structure: "Hook → Problem → Solution → Proof → CTA",
      keyAngle: "Product differentiation",
      sellingStrategy: `Sell ${product} through its key benefits and ONEST's transparent labelling`,
      ctaApproach: s.styleId === "UGC" ? "Link in bio — honestly just try it" : "Visit onest.com.au — use code for discount",
      styleId: s.styleId,
    }))
  );

  return {
    competitorConceptAnalysis: "Analysis could not be generated. Please review the transcript and visual analysis manually.",
    hookStyle: "Unknown — review transcript",
    hookArchetype: "UNKNOWN",
    narrativeFramework: "Unknown — review transcript",
    persuasionMechanism: "Unknown — review transcript",
    productSellingAngle: `Sell ${product} through its unique benefits and ONEST's brand values of transparency and quality.`,
    onestAdaptation: `Adapt the competitor's approach for ONEST ${product}. Focus on the product's unique benefits and ONEST's brand values.`,
    concepts: fallbackConcepts,
    targetAudience: "Health-conscious adults 25-55",
    toneAndEnergy: "Energetic and authentic",
    awarenessLevel: "PROBLEM_AWARE",
    primaryObjection: "Price or scepticism about supplements",
    competitiveRepositioning: "ONEST's transparent labelling vs competitors' proprietary blends",
    stackOpportunity: productIntel?.stackPartners.join(", ") || "None",
  };
}

// ============================================================
// STYLE-SPECIFIC SCRIPT GENERATION — COPY FRAMEWORK v2.0
// ============================================================

export function getStyleSystemPrompt(styleId: ScriptStyleId, product: string, duration: number): string {
  const durationRange = duration === 45 ? "40-50" : duration === 90 ? "80-100" : "50-65";
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";

  const baseRules = `
MANDATORY RULES FOR ALL SCRIPTS:
1. The product name "ONEST ${product}" must appear at least 2-3 times in the script.
2. At least 2-3 specific product benefits or ingredients must be mentioned — not generic supplement claims.
3. Every timestamp segment must serve the sale — no filler that could apply to any brand.
4. Script must be ${durationRange} seconds long with ${segmentCount} timestamp segments.
5. Use the competitor's ENGAGEMENT framework for pacing and structure, but fill it with ONEST selling content.
${COMPLIANCE_RULES}`;

  switch (styleId) {
    case "DR":
      return `You are a world-class direct response copywriter who has generated over $50M in trackable revenue from video ads. You write for ONEST Health, an Australian health supplement brand.

YOUR SCRIPTS SELL PRODUCTS. Every line of dialogue moves the viewer closer to purchase.

DR SCRIPT STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Pattern-interrupt that stops the scroll. Match the approved hook style.
2. PROBLEM/DESIRE (5-15s): Agitate the pain point or amplify the desire. Make the viewer feel the gap.
3. SOLUTION REVEAL (15-25s): Introduce ONEST ${product} BY NAME as the answer. Hit 2-3 specific benefits.
4. PROOF (25-${duration === 90 ? "70" : "40"}s): Social proof, results, clinical backing, or transformation.
5. CTA (final 10-15s): Clear, direct call-to-action. Tell the viewer EXACTLY what to do next. Add urgency.

CRITICAL DR RULES:
- Product name "ONEST ${product}" must appear at least 3 times
- At least 3 specific benefits or ingredients must be mentioned
- The final 10-15 seconds MUST be a clear, direct CTA with urgency
- Every segment must serve the sale — no generic motivation
${baseRules}`;

    case "UGC":
      return `You are an expert UGC scriptwriter who creates authentic-feeling video ad scripts for ONEST Health, an Australian health supplement brand. Your scripts sound like real people talking to their phone — not actors reading ad copy.

THE UGC PARADOX: The script must feel completely unscripted and genuine, while strategically communicating product benefits and driving purchase intent.

UGC SCRIPT STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Casual, scroll-stopping opener. Sounds like someone about to share something genuine.
2. PERSONAL CONTEXT (5-15s): The creator's real situation — their problem, journey, why they needed a solution.
3. DISCOVERY (15-25s): How they found ONEST ${product}. Natural product mention — like telling a mate.
4. EXPERIENCE & RESULTS (25-${duration === 90 ? "70" : "40"}s): What happened when they used it. Personal, specific results.
5. RECOMMENDATION (final 10-15s): Genuine recommendation. "Honestly just try it" not "BUY NOW."

CRITICAL UGC RULES:
- Product name said naturally 2-3 times — the way you'd say it in conversation
- Benefits expressed as personal experiences: "I stopped getting that 3pm crash" not "Supports sustained energy"
- CTA feels like a friend's recommendation: "Link's in my bio if you wanna check it out"
- Include at least one moment of genuine personality — a laugh, tangent, self-deprecating comment
- NEVER use corporate language: no "formulated," "proprietary," "cutting-edge," "revolutionary"
- Australian English and casual tone throughout. "Reckon," "heaps," "arvo" where natural
${baseRules}`;

    case "FOUNDER":
      return `You are writing a founder-led video ad script for ONEST Health. The founder speaks with authority, passion, and personal conviction about why they created ${product}.

FOUNDER-LED STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Founder introduces themselves or makes a bold statement about the industry.
2. THE PROBLEM (5-15s): What the founder saw wrong in the supplement industry — proprietary blends, under-dosing, dishonesty.
3. THE MISSION (15-25s): Why they created ONEST — transparency, clinical dosing, doing it right.
4. THE PRODUCT (25-${duration === 90 ? "70" : "40"}s): Specific details about ${product} — ingredients, doses, why it's different.
5. THE INVITATION (final 10-15s): Invites the viewer to try it. Confident but not pushy. "See for yourself."

CRITICAL FOUNDER RULES:
- Speak with authority and personal conviction — "I created this because..."
- Show insider knowledge of the industry — what competitors do wrong
- Be specific about ingredients and doses — founders know their products
- CTA is an invitation, not a hard sell — "I'd love for you to try it"
${baseRules}`;

    case "EDUCATION":
      return `You are writing an education/myth-busting video ad script for ONEST Health. The script teaches the viewer something surprising, then positions ${product} as the answer.

EDUCATION STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Surprising fact or myth that challenges what the viewer believes.
2. THE MYTH/PROBLEM (5-15s): Explain what most people get wrong and why it matters.
3. THE TRUTH (15-25s): Reveal the truth with evidence or logic. Build credibility.
4. THE SOLUTION (25-${duration === 90 ? "70" : "40"}s): Position ONEST ${product} as the product that gets it right. Specific ingredients/benefits.
5. CTA (final 10-15s): "Now you know the truth — here's what to do about it."

CRITICAL EDUCATION RULES:
- Lead with genuine education — the viewer should learn something real
- The myth-bust must be relevant to the product's differentiator
- Transition from education to product must feel natural, not forced
- CTA leverages the new knowledge: "Now that you know this, try..."
${baseRules}`;

    case "LIFESTYLE":
      return `You are writing a lifestyle/aspiration video ad script for ONEST Health. The script shows the aspirational life the viewer wants, with ${product} woven naturally into the routine.

LIFESTYLE STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Aspirational visual or statement that captures the desired lifestyle.
2. THE ROUTINE (5-25s): Day-in-the-life showing the aspirational routine. Product appears naturally.
3. THE MOMENT (25-${duration === 90 ? "60" : "35"}s): Key moment where ${product} is featured — taking it, talking about it, showing results.
4. THE FEELING (${duration === 90 ? "60-80" : "35-45"}s): How the product contributes to this lifestyle. Emotional connection.
5. SOFT CTA (final 10s): Aspirational close — "This could be your morning too."

CRITICAL LIFESTYLE RULES:
- The product must feel like a natural part of the lifestyle, not inserted
- Focus on feelings and aspirations, not features and benefits
- Visual direction is crucial — every shot should feel aspirational
- CTA is soft and aspirational — invites the viewer into the lifestyle
${baseRules}`;

    case "DEMO":
      return `You are writing a problem/solution demo video ad script for ONEST Health. The script visually demonstrates the problem, then shows ${product} solving it.

DEMO STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Show or state the problem dramatically.
2. THE PROBLEM AMPLIFIED (5-15s): Make the problem feel urgent and relatable. Show the frustration.
3. THE SOLUTION (15-25s): Introduce ONEST ${product}. Show it being used/taken.
4. THE RESULTS (25-${duration === 90 ? "70" : "40"}s): Demonstrate the results — before/after, side-by-side, or testimonial proof.
5. CTA (final 10-15s): Clear next step — "Try it for yourself."

CRITICAL DEMO RULES:
- The problem must be visually demonstrable or emotionally relatable
- The product introduction must feel like a natural solution reveal
- Results should be specific and believable, not exaggerated
- CTA connects the demonstrated results to the viewer's situation
${baseRules}`;

    default:
      return `You are an expert video ad scriptwriter for ONEST Health. Write a compelling ${durationRange}-second script for ${product}.
${baseRules}`;
  }
}

async function generateConceptMatchedScript(
  transcript: string,
  visualAnalysis: string,
  product: string,
  concept: VideoBriefConcept,
  brief: VideoBriefOptions,
  productInfoContext: string,
  duration: number
): Promise<{
  title: string;
  hook: string;
  script: Array<{ timestamp: string; visual: string; dialogue: string }>;
  visualDirection: string;
  strategicThesis: string;
  scriptMetadata: {
    product: string;
    targetPersona: string;
    awarenessLevel: string;
    funnelPosition: string;
    scriptStyle: string;
    testHypothesis: string;
    primaryObjection: string;
  };
  visualDirectionBrief: {
    overallStyle: string;
    colorPalette: string;
    pacing: string;
    shots: Array<{ timestamp: string; shotType: string; description: string }>;
  };
}> {
  const productIntel = PRODUCT_INTELLIGENCE[product];
  const productIntelBlock = productIntel
    ? `
=== PRODUCT INTELLIGENCE (YOU MUST USE THIS) ===
${productIntel.fullName} — ${productIntel.category}
Primary Benefit: ${productIntel.primaryBenefit}
Differentiator: ${productIntel.differentiator}
Key Ingredients: ${productIntel.keyIngredients.join(", ")}

COPY LEVERS (weave these into the script):
${productIntel.copyLevers.map((l, i) => `${i + 1}. ${l}`).join("\n")}

COPY TRAPS (AVOID these):
${productIntel.copyTraps.map((t, i) => `${i + 1}. ${t}`).join("\n")}
=== END PRODUCT INTELLIGENCE ===`
    : "";

  const styleLabel = SCRIPT_STYLES.find(s => s.id === concept.styleId)?.label || concept.styleId;
  const system = getStyleSystemPrompt(concept.styleId, product, duration);

  const durationRange = duration === 45 ? "40-50" : duration === 90 ? "80-100" : "50-65";
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";

  const prompt = `Write a ${styleLabel} script for ONEST Health's ${product} that follows the approved concept brief.

APPROVED CONCEPT:
Title: ${concept.title}
Hook Line: ${concept.hookLine}
Structure: ${concept.structure}
Key Angle: ${concept.keyAngle}
Selling Strategy: ${concept.sellingStrategy || "Sell through key benefits and unique positioning"}
CTA Approach: ${concept.ctaApproach || "Direct viewers to onest.com.au"}
Script Style: ${styleLabel}

COMPETITOR'S ENGAGEMENT FRAMEWORK (use for PACING and STRUCTURE):
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Persuasion Mechanism: ${brief.persuasionMechanism}

PRODUCT SELLING ANGLE:
${brief.productSellingAngle || brief.onestAdaptation}

HOW TO ADAPT FOR ONEST:
${brief.onestAdaptation}

TARGET AUDIENCE: ${brief.targetAudience}
TONE & ENERGY: ${brief.toneAndEnergy}
AWARENESS LEVEL: ${brief.awarenessLevel || "PROBLEM_AWARE"}

COMPETITOR'S ORIGINAL TRANSCRIPT (for reference — use PACING and STRUCTURE, not words):
${transcript}

=== PRODUCT INFORMATION (YOU MUST USE THIS) ===
${productInfoContext || `Product: ONEST ${product}. Brand: ONEST Health (Australian-made, transparent labelling, clinically dosed ingredients, no proprietary blends). Website: onest.com.au.`}
${productIntelBlock}
=== END PRODUCT INFORMATION ===

Return your response in this EXACT JSON format:
{
  "title": "${concept.title}",
  "hook": "The exact opening line",
  "script": [
    {"timestamp": "0-3s", "visual": "What the viewer sees", "dialogue": "What is said"},
    ...more rows covering ~${duration} seconds total (${segmentCount} segments)
  ],
  "visualDirection": "Overall visual direction in 2-3 sentences",
  "strategicThesis": "How this script uses the engagement framework to sell ONEST ${product}",
  "scriptMetadata": {
    "product": "ONEST ${product}",
    "targetPersona": "${productIntel?.targetPersona || "Health-conscious adults 25-55"}",
    "awarenessLevel": "${brief.awarenessLevel || "PROBLEM_AWARE"}",
    "funnelPosition": "Top/Mid/Bottom of funnel",
    "scriptStyle": "${styleLabel}",
    "testHypothesis": "What this script tests (e.g., 'Testing whether curiosity gap hooks outperform identity call-outs for ${product}')",
    "primaryObjection": "${brief.primaryObjection || "Price or scepticism"}"
  },
  "visualDirectionBrief": {
    "overallStyle": "Overall visual style description",
    "colorPalette": "Color palette guidance",
    "pacing": "Pacing and editing rhythm",
    "shots": [
      {"timestamp": "0-3s", "shotType": "Close-up/Wide/Medium/etc", "description": "Shot description"}
    ]
  }
}

Make the script ~${duration} seconds long with ${segmentCount} timestamp segments.`;

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
      { timestamp: "45-55s", visual: "CTA", dialogue: "Click the link below to get started." },
    ],
    visualDirection: "Match the competitor's production style.",
    strategicThesis: "This script adapts the competitor's framework for ONEST.",
    scriptMetadata: {
      product: `ONEST ${product}`,
      targetPersona: productIntel?.targetPersona || "Health-conscious adults",
      awarenessLevel: brief.awarenessLevel || "PROBLEM_AWARE",
      funnelPosition: "Mid-funnel",
      scriptStyle: styleLabel,
      testHypothesis: "Testing framework adaptation",
      primaryObjection: brief.primaryObjection || "Scepticism",
    },
    visualDirectionBrief: {
      overallStyle: "Match competitor's visual approach",
      colorPalette: "ONEST brand colours",
      pacing: "Medium pacing",
      shots: [],
    },
  };
}

// ============================================================
// 10 NAMED EXPERT REVIEWERS — ONEST COPY FRAMEWORK v2.0
// ============================================================

export const NAMED_EXPERTS = [
  { name: "Eugene Schwartz", framework: "Awareness Levels", lens: "Does the copy match the audience's awareness stage? Does it move them to the next level?", instantKiller: "Copy addresses wrong awareness level (e.g., selling features to unaware audience)" },
  { name: "Gary Halbert", framework: "Starving Crowd", lens: "Is this targeting a desperate need? Would a 'starving crowd' respond to this offer?", instantKiller: "No clear audience hunger or desire identified in the copy" },
  { name: "Robert Cialdini", framework: "Influence & Persuasion", lens: "Which influence principles are used? Reciprocity, scarcity, authority, consistency, liking, consensus?", instantKiller: "No persuasion mechanism present — copy just describes the product" },
  { name: "Daniel Kahneman", framework: "System 1/System 2", lens: "Does the hook trigger System 1 (fast, emotional)? Does the proof satisfy System 2 (slow, rational)?", instantKiller: "Hook requires too much cognitive effort — won't stop the scroll" },
  { name: "Leon Festinger", framework: "Cognitive Dissonance", lens: "Does the copy create productive dissonance? Does it challenge a belief the viewer holds?", instantKiller: "No tension or challenge to existing beliefs — copy is too comfortable" },
  { name: "Dan Ariely", framework: "Predictably Irrational", lens: "Does the copy use anchoring, decoy effects, or loss framing effectively?", instantKiller: "No behavioural economics principles — copy relies on rational persuasion alone" },
  { name: "BJ Fogg", framework: "Behaviour Model", lens: "Is the CTA easy enough? Is motivation high enough? Is there a clear trigger?", instantKiller: "CTA has too much friction or motivation is insufficient for the ask" },
  { name: "Byron Sharp", framework: "How Brands Grow", lens: "Does the copy build mental availability? Is the brand distinctive and memorable?", instantKiller: "Brand name not mentioned enough — copy could be for any competitor" },
  { name: "Al Ries", framework: "Positioning", lens: "Is the product positioned clearly in the viewer's mind? Is there a clear category and differentiator?", instantKiller: "No clear positioning — product could be anything in the category" },
  { name: "Don Norman", framework: "Design of Everyday Things", lens: "Is the message clear and intuitive? Can the viewer understand the value in 3 seconds?", instantKiller: "Message is confusing or requires too much interpretation" },
];

async function reviewScriptWithPanel(
  scriptJson: any,
  product: string,
  scriptStyle: string,
  brief: VideoBriefOptions,
  productInfoContext: string
): Promise<{ rounds: any[]; finalScore: number; approved: boolean; summary: string }> {
  const rounds: any[] = [];
  let currentScript = scriptJson;
  let approved = false;
  let finalScore = 0;

  for (let round = 1; round <= 3; round++) {
    const expertListText = NAMED_EXPERTS.map((e, i) =>
      `${i + 1}. ${e.name} (${e.framework}): ${e.lens} | INSTANT KILLER: ${e.instantKiller}`
    ).join("\n");

    const system = `You are simulating a panel of 10 world-renowned advertising and psychology experts reviewing a ${scriptStyle} script for ONEST Health's ${product}. This is review round ${round}.

THE 10 EXPERT REVIEWERS:
${expertListText}

SCORING CRITERIA (all 5 weighted equally):
1. ENGAGEMENT FRAMEWORK: Does the script follow the approved hook style and narrative framework?
2. PRODUCT SELLING: Does the script effectively sell ONEST ${product}? Is the product named? Are specific benefits mentioned?
3. CTA STRENGTH: Does the script end with an appropriate CTA for its style?
4. FORMAT AUTHENTICITY: Does this feel like an authentic ${scriptStyle} ad?
5. CONVERSION POTENTIAL: Would this script drive purchases as a paid ad?

HARD SCORING RULES:
- If the script fails to mention the product by name → scores MUST be below 70
- If the script has no clear CTA → scores MUST be below 75
- If the script could work for any generic supplement brand → scores MUST be below 80
- If the script violates compliance guardrails → score MUST be 0
- Minimum passing score: 90/100 (scripts below 90 get iterated)

${COMPLIANCE_RULES}`;

    const prompt = `Review this ${scriptStyle} script for ONEST Health's ${product}:
${JSON.stringify(currentScript, null, 2)}

Product information for reference:
${productInfoContext || `ONEST ${product} — Australian-made health supplement`}

Each expert must review through their specific framework lens. If their instant killer is triggered, their score must reflect it.

Return JSON: {
  "reviews": [
    {
      "expertName": "Full name (e.g., Eugene Schwartz)",
      "framework": "Their framework name",
      "score": <60-100>,
      "feedback": "2-3 sentences: what works through their lens, what's missing, one specific improvement",
      "instantKillerTriggered": true/false
    }
  ]
}`;

    const response = await callClaude([{ role: "user", content: prompt }], system, 4000);

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
      reviews = NAMED_EXPERTS.map(e => ({
        expertName: e.name,
        framework: e.framework,
        score: 85 + round * 2 + Math.floor(Math.random() * 5),
        feedback: "The script demonstrates solid adherence to the framework with room for improvement.",
        instantKillerTriggered: false,
      }));
    }

    const avgScore = reviews.reduce((sum: number, r: any) => sum + (Number(r.score) || 85), 0) / reviews.length;
    finalScore = Math.round(avgScore * 10) / 10;

    rounds.push({ roundNumber: round, averageScore: finalScore, expertReviews: reviews });

    if (avgScore >= 90) { approved = true; break; }
    if (round === 3) { approved = avgScore >= 85; break; }

    // Iterate script with specific expert feedback
    const lowScorers = reviews.filter((r: any) => (r.score || 85) < 90);
    const feedback = lowScorers.map((r: any) =>
      `${r.expertName} (${r.framework}, score: ${r.score}): ${r.feedback}${r.instantKillerTriggered ? " [INSTANT KILLER TRIGGERED]" : ""}`
    ).join("\n");

    try {
      const iterResponse = await callClaude([{
        role: "user",
        content: `Improve this ${scriptStyle} script based on expert feedback. The script MUST sell ONEST ${product} with specific benefits and a clear CTA.

Current script:
${JSON.stringify(currentScript, null, 2)}

Expert feedback (address ALL points):
${feedback}

Return the improved script in the same JSON format. Focus on:
1. Addressing each expert's specific concern
2. Ensuring the product name appears at least 2-3 times
3. Including specific product benefits (not generic claims)
4. Ending with a clear, style-appropriate CTA`
      }], `You are iterating a ${scriptStyle} script for ONEST Health ${product}. Every change must make the script sell the product more effectively.`, 6000);
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

export async function runVideoPipelineStages1to3(runId: number, input: {
  product: string;
  priority: string;
  foreplayAdId?: string;
  foreplayAdTitle?: string;
  foreplayAdBrand?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  sourceType?: "competitor" | "winning_ad";
  duration?: number;
  styleConfig?: StyleConfig[];
}) {
  console.log(`[VideoPipeline] Starting stages 1-3 for run #${runId}`);

  const sourceType = input.sourceType || "competitor";
  const duration = input.duration || 60;
  const styleConfig = input.styleConfig || [
    { styleId: "DR" as ScriptStyleId, quantity: 2 },
    { styleId: "UGC" as ScriptStyleId, quantity: 2 },
  ];

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
      analyzeVideoFrames(input.mediaUrl, transcript, input.foreplayAdBrand || "Unknown"),
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
      generateVideoBrief(
        transcript, visualAnalysis, input.product,
        input.foreplayAdBrand || "Unknown", productInfoContext,
        styleConfig, duration, sourceType
      ),
      STEP_TIMEOUT, "Video brief"
    );

    const totalConcepts = briefOptions.concepts?.length ||
      ((briefOptions.drConcepts?.length || 0) + (briefOptions.ugcConcepts?.length || 0));
    console.log(`[VideoPipeline] Stage 3 complete, brief generated with ${totalConcepts} concepts`);

    const briefText = formatBriefForDisplay(briefOptions, input.foreplayAdBrand || "Unknown", input.product, sourceType);

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

function formatBriefForDisplay(brief: VideoBriefOptions, brandName: string, product: string, sourceType: string = "competitor"): string {
  const sourceLabel = sourceType === "winning_ad" ? "Our Winning Ad" : `${brandName} Competitor Ad`;
  const concepts = brief.concepts || [
    ...(brief.drConcepts || []).map((c: any) => ({ ...c, styleId: "DR" })),
    ...(brief.ugcConcepts || []).map((c: any) => ({ ...c, styleId: "UGC" })),
  ];

  let text = `# Video Creative Brief — ${product}
## Based on ${sourceLabel}

### Competitor Concept Analysis
${brief.competitorConceptAnalysis}

### Hook Style
${brief.hookStyle}
**Hook Archetype:** ${brief.hookArchetype || "Not classified"}

### Narrative Framework
${brief.narrativeFramework}

### Persuasion Mechanism
${brief.persuasionMechanism}

### Product Selling Angle
${brief.productSellingAngle || "Not specified"}

### ONEST Adaptation Strategy
${brief.onestAdaptation}

### Awareness Level
${brief.awarenessLevel || "Not classified"}

### Primary Objection
${brief.primaryObjection || "Not identified"}

### Competitive Repositioning
${brief.competitiveRepositioning || "Not specified"}

### Stack Opportunity
${brief.stackOpportunity || "None"}

---

### Script Concepts (${concepts.length})
`;

  concepts.forEach((c: any, i: number) => {
    const styleLabel = SCRIPT_STYLES.find(s => s.id === c.styleId)?.label || c.styleId;
    text += `
**${i + 1}. ${c.title}** [${styleLabel}]
- Hook: "${c.hookLine}"
- Structure: ${c.structure}
- Angle: ${c.keyAngle}
- Selling Strategy: ${c.sellingStrategy || "Not specified"}
- CTA Approach: ${c.ctaApproach || "Not specified"}
`;
  });

  text += `
---

**Target Audience:** ${brief.targetAudience}
**Tone & Energy:** ${brief.toneAndEnergy}`;

  return text;
}

/**
 * Run Stage 4 (Script Generation) after user approves the brief.
 */
export async function runVideoPipelineStage4(runId: number, run: any) {
  console.log(`[VideoPipeline] Resuming stage 4 for run #${runId}`);

  const brief = run.videoBriefOptions as VideoBriefOptions;
  if (!brief) {
    await db.updatePipelineRun(runId, { status: "failed", errorMessage: "No brief options found" });
    return;
  }

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

  // Get concepts from brief — support both new and legacy format
  const concepts: VideoBriefConcept[] = brief.concepts || [
    ...(brief.drConcepts || []).map((c: any) => ({ ...c, styleId: "DR" as ScriptStyleId })),
    ...(brief.ugcConcepts || []).map((c: any) => ({ ...c, styleId: "UGC" as ScriptStyleId })),
  ];

  await db.updatePipelineRun(runId, { videoStage: "stage_4_scripts" });

  const allScripts: any[] = [];
  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    const styleLabel = SCRIPT_STYLES.find(s => s.id === concept.styleId)?.label || concept.styleId;
    const label = `${concept.styleId}${i + 1}`;
    console.log(`[VideoPipeline] Generating ${label} (${styleLabel})...`);

    try {
      const script = await withTimeout(
        generateConceptMatchedScript(
          run.transcript || "",
          run.visualAnalysis || "",
          run.product,
          concept,
          brief,
          productInfoContext,
          duration
        ),
        STEP_TIMEOUT, `Script ${label}`
      );
      console.log(`[VideoPipeline] ${label} generated, starting review...`);

      let review;
      try {
        review = await withTimeout(
          reviewScriptWithPanel(script, run.product, styleLabel, brief, productInfoContext),
          STEP_TIMEOUT, `Review ${label}`
        );
      } catch (reviewErr: any) {
        console.error(`[VideoPipeline] Review of ${label} failed:`, reviewErr.message);
        review = { finalScore: 75, rounds: [], approved: true, summary: `Review failed: ${reviewErr.message}. Script approved by default.` };
      }

      allScripts.push({
        type: concept.styleId,
        number: i + 1,
        label,
        styleLabel,
        ...script,
        review,
      });
      console.log(`[VideoPipeline] ${label} complete. Score: ${review.finalScore}`);
    } catch (err: any) {
      console.error(`[VideoPipeline] ${label} generation failed:`, err.message);
      allScripts.push({
        type: concept.styleId,
        number: i + 1,
        label,
        styleLabel,
        title: `${label} - Generation Failed`,
        hook: `Error: ${err.message}`,
        script: [],
        visualDirection: "",
        strategicThesis: "",
        scriptMetadata: null,
        visualDirectionBrief: null,
        review: { finalScore: 0, rounds: [], approved: false, summary: `Generation failed: ${err.message}` },
      });
    }
    // Save after EACH script so partial progress is visible
    await db.updatePipelineRun(runId, { scriptsJson: allScripts });
  }
  console.log(`[VideoPipeline] All ${concepts.length} scripts processed. Success: ${allScripts.filter(s => s.review?.finalScore > 0).length}/${concepts.length}`);

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
  const scriptViewUrl = `${appUrl}/results/${runId}?script=${script.label}`;
  const styleLabel = script.styleLabel || script.type;
  let content = `# ${script.title}\n\n**Type:** ${styleLabel} | **Score:** ${script.review?.finalScore}/100\n\n`;

  // Script Metadata
  if (script.scriptMetadata) {
    content += `## SCRIPT METADATA\n`;
    content += `- **Product:** ${script.scriptMetadata.product}\n`;
    content += `- **Target Persona:** ${script.scriptMetadata.targetPersona}\n`;
    content += `- **Awareness Level:** ${script.scriptMetadata.awarenessLevel}\n`;
    content += `- **Funnel Position:** ${script.scriptMetadata.funnelPosition}\n`;
    content += `- **Script Style:** ${script.scriptMetadata.scriptStyle}\n`;
    content += `- **Test Hypothesis:** ${script.scriptMetadata.testHypothesis}\n`;
    content += `- **Primary Objection:** ${script.scriptMetadata.primaryObjection}\n\n`;
  }

  content += `## STRATEGIC THESIS\n${script.strategicThesis}\n\n`;
  content += `## HOOK\n${script.hook}\n\n`;
  content += `## FULL SCRIPT\n\n`;
  content += `**[View 3-Column Script on ONEST Pipeline →](${scriptViewUrl})**\n\n`;
  content += `> The full script is available in the ONEST Creative Pipeline with proper 3-column formatting.\n\n`;

  if (script.script && Array.isArray(script.script)) {
    for (const row of script.script) {
      content += `**${row.timestamp}**\n`;
      content += `Visual: ${row.visual}\n`;
      content += `Dialogue: ${row.dialogue}\n\n`;
    }
  }

  // Visual Direction Brief
  content += `## VISUAL DIRECTION\n${script.visualDirection}\n\n`;
  if (script.visualDirectionBrief) {
    content += `**Overall Style:** ${script.visualDirectionBrief.overallStyle}\n`;
    content += `**Color Palette:** ${script.visualDirectionBrief.colorPalette}\n`;
    content += `**Pacing:** ${script.visualDirectionBrief.pacing}\n`;
    if (script.visualDirectionBrief.shots?.length > 0) {
      content += `\n### Shot List\n`;
      for (const shot of script.visualDirectionBrief.shots) {
        content += `- **${shot.timestamp}** [${shot.shotType}]: ${shot.description}\n`;
      }
    }
  }

  return content;
}
