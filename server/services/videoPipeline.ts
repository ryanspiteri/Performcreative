import * as db from "../db";
import { transcribeVideo } from "./whisper";
import { createMultipleScriptTasks } from "./clickup";
import { withTimeout, callClaude, STEP_TIMEOUT, STAGE_4_TIMEOUT, buildProductInfoContext } from "./_shared";

// ============================================================
// SCRIPT STYLE DEFINITIONS — COPY FRAMEWORK v3.0
// ============================================================

export const SCRIPT_STYLES = [
  { id: "DR", label: "Direct Response", description: "Hard-sell with clear offer, urgency, and direct CTA" },
  { id: "UGC", label: "UGC / Testimonial", description: "Authentic personal experience, soft-sell recommendation" },
  { id: "FOUNDER", label: "Founder-Led", description: "Brand founder speaking with authority and passion" },
  { id: "BRAND", label: "Brand / Equity", description: "Belief-led content — asks for belief, not a sale" },
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
// FUNNEL STAGE TYPES & RULES — v3.0
// ============================================================

export type FunnelStage = "cold" | "warm" | "retargeting" | "retention";

export const FUNNEL_STAGE_RULES: Record<FunnelStage, string> = {
  cold: `COLD — NON-NEGOTIABLE RULES:
- Product name does NOT appear in the hook under any circumstances
- Hook leads with the problem, the enemy, or a contrarian statement about the category
- Product introduced as the logical conclusion of the problem — not the opening premise
- Proof section kept brief — viewer is not yet invested enough for detailed evidence
- CTA: "link below" / "check it out" / "see for yourself" — NEVER "buy now"`,

  warm: `WARM — NON-NEGOTIABLE RULES:
- ONEST can be named after the hook section is complete
- Lead with what makes ONEST different — transparency, ingredient specificity, Australian-made
- Assume they have seen competitor products — differentiation is the primary job
- CTA can be more direct: "try ONEST" / "visit onest.com.au"`,

  retargeting: `RETARGETING — NON-NEGOTIABLE RULES:
- Can open with product name — they already know it
- Lead immediately with social proof or a specific result
- Address the most likely objection for the product
- CTA is the strongest of any stage — "try it risk-free" / "30-day guarantee" / "order now"`,

  retention: `RETENTION — NON-NEGOTIABLE RULES:
- Never re-explain what the product does to someone who already uses it
- Lead with loyalty, community, or new product announcement
- Stack-sell opportunity: reference complementary products they do not own yet
- CTA is relationship-oriented, not transaction-oriented`,
};

// ============================================================
// 19 SCRIPT SUB-STRUCTURES — v3.0 MASTER REFERENCE
// ============================================================

export interface ScriptSubStructure {
  id: string;
  name: string;
  category: "DR" | "UGC" | "FOUNDER" | "BRAND";
  funnelStages: FunnelStage[];
  awarenessLevel: string;
  platform: string;
  length: string;
  stages: Array<{ stage: string; function: string }>;
  whyItConverts: string;
  psychologicalLever: string;
}

export const SCRIPT_SUB_STRUCTURES: ScriptSubStructure[] = [
  // === DIRECT RESPONSE (7) ===
  {
    id: "DR-1", name: "Problem → Agitate → Solve (PAS)", category: "DR",
    funnelStages: ["cold"], awarenessLevel: "Problem Aware",
    platform: "Meta primary, TikTok", length: "15–30 seconds",
    stages: [
      { stage: "Hook (0–3s)", function: "Name the problem in a way that feels uncomfortably personal" },
      { stage: "Problem", function: "Validate and expand the pain — make them nod" },
      { stage: "Agitate", function: "Make the consequence of inaction feel real and immediate" },
      { stage: "Solve", function: "Introduce ONEST as the logical answer — lead with mechanism not name" },
      { stage: "Proof", function: "One specific, credible result or credential" },
      { stage: "CTA", function: "Single low-friction action" },
    ],
    whyItConverts: "Intercepts Peter and Lara at their emotion before asking them to care about a product. PAS meets them where they already are.",
    psychologicalLever: "Loss aversion. The agitation phase makes inaction feel more costly than the purchase.",
  },
  {
    id: "DR-2", name: "Before → After → Bridge (BAB)", category: "DR",
    funnelStages: ["warm"], awarenessLevel: "Solution Aware",
    platform: "Meta retargeting, TikTok, email", length: "20–45 seconds",
    stages: [
      { stage: "Hook", function: "Paint the 'before' state vividly — name the specific struggle" },
      { stage: "Before", function: "Expand. Make the before state feel lived-in and real" },
      { stage: "After", function: "The contrast. Specific, believable, not exaggerated" },
      { stage: "Bridge", function: "ONEST is the mechanism that moves you from one state to the other" },
      { stage: "CTA", function: "Anchor the CTA to the 'after' state — they are buying the destination" },
    ],
    whyItConverts: "The brain visualises the 'after' automatically. Lara is motivated by the clearest possible vision of her best self.",
    psychologicalLever: "Desire amplification. Channelling existing desire toward a specific outcome.",
  },
  {
    id: "DR-3", name: "Hook → Mechanism → Proof → CTA", category: "DR",
    funnelStages: ["warm", "retargeting"], awarenessLevel: "Solution Aware → Product Aware",
    platform: "Meta feed, YouTube pre-roll, longer TikTok", length: "30–60 seconds",
    stages: [
      { stage: "Hook", function: "Bold claim or contrarian statement — earn attention before explaining" },
      { stage: "Mechanism", function: "Why this works — name the specific ingredient, explain the process simply" },
      { stage: "Proof", function: "Validate with numbers, named results, or science" },
      { stage: "CTA", function: "'See the full label' / 'Try it risk-free' — low friction" },
    ],
    whyItConverts: "Directly answers 'does it actually work?' Named ingredients are the sale — transparency is the differentiator.",
    psychologicalLever: "Authority + Commitment. Education creates a micro-yes ladder.",
  },
  {
    id: "DR-4", name: "Enemy Framing → Reveal → Solution", category: "DR",
    funnelStages: ["cold", "warm"], awarenessLevel: "Solution Aware",
    platform: "Meta cold, TikTok", length: "20–45 seconds",
    stages: [
      { stage: "Hook", function: "Name the enemy — a lie, an industry practice, a bad ingredient" },
      { stage: "Expose", function: "Explain exactly how the enemy is causing the problem" },
      { stage: "Reveal", function: "ONEST as the brand that operates differently — show the evidence" },
      { stage: "Proof", function: "Transparency as the differentiator — label shown, dose stated" },
      { stage: "CTA", function: "'Judge for yourself' framing — invites rather than demands" },
    ],
    whyItConverts: "Peter and Lara are already cynical about the supplement industry. This validates that cynicism and positions ONEST as the honest exception.",
    psychologicalLever: "Unity + Liking. Shared enemy creates tribal alignment.",
  },
  {
    id: "DR-5", name: "Contrarian Statement → Proof → Reframe → CTA", category: "DR",
    funnelStages: ["cold"], awarenessLevel: "Problem Aware → Solution Aware",
    platform: "Meta Reels, TikTok, high-frequency placements", length: "15–30 seconds",
    stages: [
      { stage: "Hook", function: "Say the opposite of what they expect — let the tension sit 2–3 seconds" },
      { stage: "Proof", function: "Back the contrarian claim immediately with evidence" },
      { stage: "Reframe", function: "Show them the world differently as a result" },
      { stage: "CTA", function: "'See for yourself' — curiosity-led" },
    ],
    whyItConverts: "A genuinely contrarian hook creates neurological pattern interruption — the brain must resolve the tension.",
    psychologicalLever: "Cognitive dissonance. The viewer's existing belief is challenged; resolving it requires engaging with the content.",
  },
  {
    id: "DR-6", name: "Social Proof Lead → Identification → Product → CTA", category: "DR",
    funnelStages: ["retargeting"], awarenessLevel: "Product Aware → Most Aware",
    platform: "Meta retargeting, email, SMS", length: "15–30 seconds",
    stages: [
      { stage: "Hook", function: "Open with a specific customer result — number, timeframe, outcome" },
      { stage: "Identification", function: "'If you're anything like [name]…' — create mirror recognition" },
      { stage: "Problem connect", function: "Briefly confirm the shared pain — 1–2 sentences" },
      { stage: "Product", function: "As the mechanism behind the result — not the hero, the enabler" },
      { stage: "CTA", function: "Risk-reversal framing — 'try it' not 'buy it'" },
    ],
    whyItConverts: "Social proof as the opener short-circuits scepticism before it activates.",
    psychologicalLever: "Social proof + Endowment effect. Risk-reversal framing makes the viewer feel they already own the outcome.",
  },
  {
    id: "DR-7", name: "Story → Lesson → Product", category: "DR",
    funnelStages: ["cold", "warm"], awarenessLevel: "Problem Unaware → Problem Aware",
    platform: "TikTok primary, Meta longer-form, YouTube", length: "45–90 seconds",
    stages: [
      { stage: "Hook", function: "Open mid-story — in media res, something already happening" },
      { stage: "Story", function: "Personal experience, relatable struggle — no polish, no performance" },
      { stage: "Lesson", function: "What changed, what they learned, what they now know" },
      { stage: "Product", function: "Part of the solution, not the whole story — mentioned naturally" },
      { stage: "CTA", function: "Soft — 'this is what I use now' / 'link below if you want to try'" },
    ],
    whyItConverts: "Bypasses the sales defence mechanism entirely. The viewer is invested in the story before they realise there is a product.",
    psychologicalLever: "Narrative transportation. People in a story state are significantly more persuadable.",
  },

  // === UGC (6) ===
  {
    id: "UGC-1", name: "Talking Head Review", category: "UGC",
    funnelStages: ["cold", "warm"], awarenessLevel: "Problem Aware → Solution Aware",
    platform: "Meta Reels, TikTok, Stories", length: "30–60 seconds",
    stages: [
      { stage: "Hook (0–3s)", function: "Mid-thought, unexpected, specific — never 'hey guys'" },
      { stage: "Credibility", function: "Who they are in one sentence — context, not a bio" },
      { stage: "The before", function: "Their specific situation — one clear pain point only" },
      { stage: "The discovery", function: "How they found ONEST — casual, slightly accidental feeling" },
      { stage: "The result", function: "One specific, believable result — not a list" },
      { stage: "The endorsement", function: "Natural peer recommendation — 'I just tell everyone now'" },
      { stage: "CTA", function: "Soft — 'link in bio' / 'they've got something on at the moment'" },
    ],
    whyItConverts: "The brain processes peer-to-camera content as advice, not advertising.",
    psychologicalLever: "Social proof through perceived authenticity.",
  },
  {
    id: "UGC-2", name: "Objection Crusher", category: "UGC",
    funnelStages: ["warm", "retargeting"], awarenessLevel: "Solution Aware → Product Aware",
    platform: "Meta retargeting, TikTok cold traffic for high-scepticism audiences", length: "30–45 seconds",
    stages: [
      { stage: "Hook", function: "Creator voices the objection directly — 'I thought fat burners were all marketing'" },
      { stage: "Validate", function: "Agree with the scepticism — this is disarming and trust-building" },
      { stage: "The turning point", function: "What made them try anyway — specific, not vague" },
      { stage: "What surprised them", function: "One unexpected result they did not anticipate" },
      { stage: "The reframe", function: "'I was wrong about this one specifically'" },
      { stage: "CTA", function: "'Worth trying if you've been sitting on the fence'" },
    ],
    whyItConverts: "Festinger's cognitive dissonance in action — you name the exact objection in the viewer's head, validate it, then resolve it.",
    psychologicalLever: "Credibility through honesty. Admitting prior scepticism makes the eventual endorsement exponentially more believable.",
  },
  {
    id: "UGC-3", name: "Day in the Life", category: "UGC",
    funnelStages: ["cold"], awarenessLevel: "Problem Unaware → Problem Aware",
    platform: "TikTok primary, Instagram Reels organic, Meta upper funnel", length: "45–90 seconds",
    stages: [
      { stage: "Hook", function: "Open at a real moment — waking up, pre-gym, morning routine mid-action" },
      { stage: "Context", function: "Show the routine, not just the product — the product lives inside a life" },
      { stage: "Natural integration", function: "Product appears as part of the routine, not the centrepiece" },
      { stage: "The feeling", function: "What it actually feels like — energy, focus, no crash — sensory and specific" },
      { stage: "The outcome", function: "Training harder, more productive, present — the life benefit" },
      { stage: "Sign-off", function: "'This is just what I do now' — normalisation, not endorsement" },
    ],
    whyItConverts: "Lara is not buying a supplement — she is buying into a version of her life where she is consistent, energised, and performing.",
    psychologicalLever: "Aspirational identity. The product is the prop, not the plot.",
  },
  {
    id: "UGC-4", name: "Myth Bust / Hot Take", category: "UGC",
    funnelStages: ["cold", "warm"], awarenessLevel: "Solution Aware",
    platform: "TikTok primary, Instagram Reels, Meta interest targeting", length: "30–60 seconds",
    stages: [
      { stage: "Hook", function: "Bold, slightly controversial opener — 'You don't need a pre-workout'" },
      { stage: "Hold tension", function: "Do not resolve it — let 3–5 seconds of setup build" },
      { stage: "The nuance", function: "'…unless you're doing it right. Here's what most brands get wrong'" },
      { stage: "The standard", function: "What good actually looks like — specific ingredients, real doses" },
      { stage: "The product", function: "ONEST as the example that meets the standard — never forced" },
      { stage: "CTA", function: "'Judge for yourself — the label's on the website'" },
    ],
    whyItConverts: "Peter trusts people who seem willing to tell him what not to buy. When you then show him what to buy, the credibility transfer is complete.",
    psychologicalLever: "Authority through honesty. Transparency framing is ONEST's core DNA.",
  },
  {
    id: "UGC-5", name: "Results Reveal", category: "UGC",
    funnelStages: ["retargeting"], awarenessLevel: "Product Aware",
    platform: "Meta retargeting, warm TikTok audiences, Stories", length: "20–40 seconds",
    stages: [
      { stage: "Hook", function: "The result first — 'I've lost 6kg in 8 weeks and I'm not in a huge deficit'" },
      { stage: "Pre-empt the sceptic", function: "'I know how that sounds — I thought the same thing'" },
      { stage: "What changed", function: "Minimal — the product carried the weight" },
      { stage: "The product's role", function: "Specific benefit — energy, cravings, metabolism — one only" },
      { stage: "The proof", function: "Photo, weight, performance metric — something tangible" },
      { stage: "CTA", function: "'Link's below'" },
    ],
    whyItConverts: "Leads with the destination. The viewer's first question is 'how?' — which means they are leaning in before you have explained anything.",
    psychologicalLever: "Curiosity through proof. Result-first hooks create immediate engagement.",
  },
  {
    id: "UGC-6", name: "Product Demo / Ingredient Education", category: "UGC",
    funnelStages: ["warm", "retargeting"], awarenessLevel: "Product Aware",
    platform: "Meta feed, TikTok, YouTube pre-roll", length: "45–75 seconds",
    stages: [
      { stage: "Hook", function: "A specific ingredient claim — 'Most fat burners use one form of caffeine. HyperBurn uses two. Here's why that matters'" },
      { stage: "Education", function: "Explain the mechanism simply — human language, no jargon" },
      { stage: "The comparison", function: "Category standard vs. what ONEST actually does" },
      { stage: "Visual demo", function: "Scooping, mixing, label shown — tactile and real" },
      { stage: "The feel", function: "What the difference actually feels like in the body" },
      { stage: "CTA", function: "'Full ingredient breakdown's on the website — link below'" },
    ],
    whyItConverts: "Converts the analytical buyer who reads every label. Transparency is the sale — this structure makes it literal and visible.",
    psychologicalLever: "Authority through education. Knowledge transfer builds trust.",
  },

  // === FOUNDER-LED (3) ===
  {
    id: "FL-1", name: "The Origin Story", category: "FOUNDER",
    funnelStages: ["cold", "warm"], awarenessLevel: "Problem Unaware → Solution Aware",
    platform: "TikTok, Meta, YouTube, organic social", length: "60–90 seconds",
    stages: [
      { stage: "Hook", function: "Open at the moment of frustration — not the beginning, the breaking point" },
      { stage: "The problem they lived", function: "What was wrong with the industry before ONEST existed — personal and specific" },
      { stage: "The decision", function: "Why they chose to build instead of just complain" },
      { stage: "The standard they set", function: "What ONEST committed to that others would not — transparency, doses, ingredients" },
      { stage: "What that looks like now", function: "Brief product reference — earned through the story, not inserted" },
      { stage: "The invitation", function: "'That's why we built this. That's who it's for.' — tribe identity, not a hard sell" },
    ],
    whyItConverts: "Answers 'why should I trust you?' before the question is asked.",
    psychologicalLever: "Narrative authority. The founder's story IS the proof of concept.",
  },
  {
    id: "FL-2", name: "The Industry Call-Out", category: "FOUNDER",
    funnelStages: ["cold", "warm"], awarenessLevel: "Solution Aware",
    platform: "TikTok primary, Meta, organic social", length: "45–75 seconds",
    stages: [
      { stage: "Hook", function: "Founder addresses the industry directly — 'I need to talk about what's in most supplements'" },
      { stage: "The problem named", function: "Specific practice being called out — proprietary blends, underdosing, artificial fillers" },
      { stage: "The evidence", function: "How to spot it — educate the viewer to protect themselves" },
      { stage: "The standard", function: "What ONEST does differently — label shown, doses stated" },
      { stage: "The challenge", function: "'Compare our label to anything else on the shelf'" },
      { stage: "CTA", function: "'Link in bio — everything's on there'" },
    ],
    whyItConverts: "Validates every suspicion Peter and Lara already had. Positions ONEST as the honest disruptor.",
    psychologicalLever: "Unity + Authority. Shared enemy creates tribal alignment.",
  },
  {
    id: "FL-3", name: "The Standard-Setter", category: "FOUNDER",
    funnelStages: ["retargeting"], awarenessLevel: "Product Aware",
    platform: "Meta retargeting, TikTok, email", length: "30–60 seconds",
    stages: [
      { stage: "Hook", function: "Founder makes a specific product claim with total confidence" },
      { stage: "The why", function: "Why this standard was non-negotiable — personal conviction, not marketing" },
      { stage: "The what", function: "The specific ingredient, dose, or manufacturing decision — tangible" },
      { stage: "The comparison", function: "What the alternative looks like — educational, not aggressive" },
      { stage: "The ask", function: "'This is what we made. Try it and judge for yourself.'" },
    ],
    whyItConverts: "Converts the final-stage sceptic who needs to believe in the people behind the product.",
    psychologicalLever: "Personal conviction as proof. The founder's confidence IS the closing argument.",
  },

  // === BRAND / EQUITY (3) ===
  {
    id: "BR-1", name: "The Belief Film", category: "BRAND",
    funnelStages: ["cold"], awarenessLevel: "Problem Unaware",
    platform: "Meta, TikTok, YouTube, organic social", length: "60–120 seconds",
    stages: [
      { stage: "Opening visual", function: "Athlete in action — no product, no logo, no copy yet" },
      { stage: "The truth", function: "A belief statement about what serious performance actually requires" },
      { stage: "The audience named", function: "Not 'people who take supplements' — 'the ones who don't settle'" },
      { stage: "The tension", function: "What separates the ones who get there from the ones who don't" },
      { stage: "The conviction", function: "ONEST's position in that world — not what we sell, what we believe" },
      { stage: "The product reveal", function: "Product appears as the conclusion of the argument, not the start" },
      { stage: "Sign-off", function: "Brand line: MADE OF GREATNESS" },
    ],
    whyItConverts: "Asks for belief, not a sale. Measured by watch time, shares, saves, and downstream conversion lift.",
    psychologicalLever: "Identity alignment. The viewer sees themselves in the belief before seeing the product.",
  },
  {
    id: "BR-2", name: "The Community Proof", category: "BRAND",
    funnelStages: ["warm"], awarenessLevel: "Solution Aware",
    platform: "Meta, TikTok, Instagram Reels, organic social", length: "45–90 seconds",
    stages: [
      { stage: "Hook", function: "Multiple faces, multiple results — not one story, a movement" },
      { stage: "The common thread", function: "What all these people share — the standard they hold themselves to" },
      { stage: "The results", function: "Varied, specific, believable — different people, same quality of outcome" },
      { stage: "The brand's role", function: "Understated — 'this is what we make for people like this'" },
      { stage: "The identity statement", function: "'ONEST is for people who take this seriously'" },
      { stage: "CTA", function: "Light — 'find your community' / 'link in bio'" },
    ],
    whyItConverts: "Peter does not just want results — he wants to be seen as someone who belongs to the right tribe.",
    psychologicalLever: "Tribal identity. ONEST becomes the badge of belonging.",
  },
  {
    id: "BR-3", name: "The Values Declaration", category: "BRAND",
    funnelStages: ["cold", "warm", "retargeting", "retention"], awarenessLevel: "All levels",
    platform: "Any — most powerful as a pinned piece across all channels", length: "30–60 seconds",
    stages: [
      { stage: "Hook", function: "A single, bold, unambiguous statement of what ONEST stands for" },
      { stage: "What that means in practice", function: "Specific — 'it means our label shows every ingredient and every dose'" },
      { stage: "What it costs", function: "Honesty about the trade-off — 'it means we're more expensive than shortcuts'" },
      { stage: "Who it's for", function: "Name them — 'it's for the people who care enough to read the label'" },
      { stage: "The invitation", function: "'If that's you — welcome.'" },
    ],
    whyItConverts: "In a category defined by noise, clarity is a differentiator.",
    psychologicalLever: "Self-selection. Attracts the right customers and pre-selects out the wrong ones.",
  },
];

// ============================================================
// UGC ARCHETYPE VOICE PROFILES — v3.0
// ============================================================

export type ActorArchetype = "FitnessEnthusiast" | "BusyMum" | "Athlete" | "Biohacker" | "WellnessAdvocate";

export const ARCHETYPE_PROFILES: Record<ActorArchetype, {
  label: string;
  lifeContext: string;
  languageRegister: string;
  preProductObjection: string;
}> = {
  FitnessEnthusiast: {
    label: "Fitness Enthusiast",
    lifeContext: "Trains 4-6 days a week. Tracks macros. Has tried multiple supplements. Goes to an F45 or commercial gym. Influenced by what people in their gym circle are using. Cares about performance metrics — PRs, body composition, recovery times.",
    languageRegister: "Comfortable with supplement terminology but still casual. Says 'reps', 'gains', 'recovery'. Drops gym-specific references naturally. Not performatively bro — genuinely gym-oriented. Australian colloquialisms where they fit naturally.",
    preProductObjection: "\"I've already tried most things in this category. I'm cynical because I've wasted money on products that underdosed or overpromised.\" The turning point was a specific training metric that changed, or a specific ingredient they finally understood.",
  },
  BusyMum: {
    label: "Busy Mum",
    lifeContext: "Juggling kids, work, and personal goals simultaneously. Fitness is important but time is the constraint. Values simplicity and products that fit into an already-full morning. Has had inconsistent supplement habits because routines get disrupted.",
    languageRegister: "Warm and direct. References real moments: school drop-off, 5:30am gym session before the house wakes up, 3pm energy slump. Relatable specificity is the authenticity signal. Not fitness-speak heavy — talks about how she feels, not performance metrics.",
    preProductObjection: "\"Is this safe? What's actually in it? I don't want to be taking something I can't understand.\" The turning point was the transparent label — seeing exactly what is in it and being able to verify it.",
  },
  Athlete: {
    label: "Athlete",
    lifeContext: "Competes in something — Hyrox, CrossFit, team sports, powerlifting. Training has a structure and a goal. Supplements are tools for performance, not lifestyle accessories. Talks about training blocks, competition prep, recovery protocols.",
    languageRegister: "Precise and performance-focused. References specific metrics and outcomes. Comfortable with clinical dosing language — knows what Creapure means, knows what Dicaffeine Malate is. Respects specificity as a signal of quality.",
    preProductObjection: "\"I can't afford to put something in my body that isn't clinically dosed. I've seen athletes take products that don't contain what the label claims.\" The turning point was full ingredient transparency — every dose listed, nothing hidden in a blend.",
  },
  Biohacker: {
    label: "Biohacker",
    lifeContext: "Optimises everything. Tracks sleep, HRV, bloodwork. Reads PubMed. Treats their body as a system to be engineered. Talks about N=1 experimentation and personal results.",
    languageRegister: "Analytical and curious. References self-tracking: 'I noticed on my Oura ring', 'my recovery scores went up', 'I've been testing this for six weeks.' Wants to understand why something works, not just that it works.",
    preProductObjection: "\"Most supplements have proprietary blends so I can't verify the doses I'm actually getting. I need to see every ingredient and every dose.\" The turning point was full label transparency combined with the specific mechanism of a key ingredient.",
  },
  WellnessAdvocate: {
    label: "Wellness Advocate",
    lifeContext: "Health-conscious but not gym-obsessed. Cares about what goes into their body. Worried about 'bad chemicals'. Holistic view of health — sleep, stress, nutrition, movement together. May have been burned by overpromised or artificially-filled supplements.",
    languageRegister: "Warm, considered, slightly cautious. References how things make her feel rather than performance metrics. 'I felt better in the mornings', 'my skin actually changed', 'I stopped feeling so flat by 2pm.' Responds to 'no artificial colours, no fillers' as a strong positive signal.",
    preProductObjection: "\"I don't want to take something full of stimulants or artificial ingredients I don't recognise.\" The turning point was the no artificial colours / no fillers / no proprietary blends positioning — plus Australian-made GMP certification as a quality guarantee.",
  },
};

// ============================================================
// EMOTION-TO-STRUCTURE MAP — v3.0 Logic 1
// ============================================================

export const EMOTION_STRUCTURE_MAP: Record<string, string[]> = {
  "Frustrated": ["DR-1", "UGC-2", "FL-2"],
  "Aspirational": ["DR-2", "UGC-3", "BR-1"],
  "Sceptical": ["DR-3", "DR-4", "UGC-4", "FL-1"],
  "Curious": ["DR-5", "DR-7", "UGC-1"],
  "Ready but hesitant": ["DR-6", "UGC-5", "FL-3"],
};

// ============================================================
// MODULAR HOOK/BODY/CTA BANK — v3.0 Logic 2
// ============================================================

const HOOK_BANK = `
HOOK BANK — five archetypes (classify the competitor's hook, then use the same archetype):
| Archetype | Example |
|---|---|
| Contrarian | "The reason you're not losing fat has nothing to do with your diet." |
| Specific frustration | "Six months in a calorie deficit and the scale hasn't moved." |
| Social proof lead | "47,000 Aussies have switched to this in the last 12 months." |
| Named enemy | "Most fat burners don't tell you what's actually in them. Here's why." |
| Bold claim + number | "250mg of two forms of caffeine. Here's what that actually does to your metabolism." |
`;

const CTA_BANK = `
CTA BANK — matched to funnel stage:
| Stage | CTA approach |
|---|---|
| Cold | "See the full ingredient breakdown — link below" |
| Warm | "Try it and judge for yourself — link below" |
| Retargeting | "30-day guarantee — order now at onest.com.au" |
`;

// ============================================================
// TRANSITION LOGIC — v3.0 Logic 3
// ============================================================

const TRANSITION_LOGIC = `
TRANSITION LOGIC — The viewer should never feel the structure change. Each transition should feel like the most natural next sentence, not the next section of a brief.

The four critical transitions:
| Transition | Wrong version | Correct version |
|---|---|---|
| Problem → Solution | "That's why we created HyperBurn." | "The only way to fix a dormant metabolism is to give it a reason to fire back up." |
| Story → Product | "Anyway, I started using HyperBurn and…" | "The thing that actually changed it was understanding what my body was missing — specifically one thing." |
| Education → CTA | "So if you want to try it, click the link." | "That's literally everything that's in it — no blends, no fillers. If you want to read the full breakdown yourself, it's all on the site." |
| Proof → CTA | "Don't miss out — buy now." | "There's a 30-day guarantee, so there's actually no reason not to try it." |
`;

// ============================================================
// SCRIPT AUDIT CHECKLIST — v3.0 Logic 4
// ============================================================

const SCRIPT_AUDIT_CHECKLIST = `
SCRIPT AUDIT CHECKLIST — run every completed script through these 10 checks:
1. Awareness match — Does the script assume the right level of audience knowledge for the funnel stage?
2. Hook independence — Does the hook work as a complete idea in under 3 seconds with no context?
3. Banned phrases — Zero instances of "unlock your potential", "fuel your journey", "transform your body", "achieve your goals"
4. Specificity test — At least one named ingredient, specific number, or concrete timeframe
5. One job — Single primary message, obvious in one sentence
6. Transition logic — All major transitions feel inevitable rather than engineered
7. Single CTA — One and only one action asked for at the end
8. Brand voice — Could this script appear on a competitor's product without modification? If yes — rewrite
9. Emotional logic — Script takes the viewer from one clear emotional state to a different one logically
10. Peter / Lara test — Read it aloud imagining you are Peter or Lara hearing it for the first time
`;

// ============================================================
// COMPLIANCE GUARDRAILS
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
// PRODUCT INTELLIGENCE — ONEST COPY FRAMEWORK v3.0
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
    category: "Capsule Thermogenic",
    copyLevers: [
      "Two forms of caffeine for sustained energy without jitters",
      "Green Tea Extract, Bitter Orange Extract, Grains of Paradise — multi-pathway thermogenesis",
      "Theobromine and Lion's Mane for mood and cognitive support",
      "Capsule format — taste-free, convenient, take anywhere",
      "Transparent label with clinically studied ingredients",
    ],
    copyTraps: [
      "Don't position capsules as 'weaker' than powder — position as 'convenient and effective'",
      "Avoid implying it replaces HyperBurn — different format for different preferences",
    ],
    stackPartners: ["Hyperburn", "Thermosleep"],
    targetPersona: "Busy professionals, both genders, convenience-focused buyers who want fat support without mixing powders",
    awarenessAngle: "Solution-aware → Product-aware (show capsule thermogenic option exists)",
    keyIngredients: ["Two forms of caffeine", "Green Tea Extract", "Bitter Orange Extract", "Grains of Paradise", "Theobromine", "Lion's Mane", "Theacrine"],
    primaryBenefit: "Sustained energy, mood support, and healthy weight management in a convenient capsule",
    differentiator: "Multi-pathway thermogenic in capsule format — not just caffeine pills",
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
// PRODUCT FALLBACK BRIEFS — v3.0 Section 11
// ============================================================

const PRODUCT_FALLBACK_BRIEFS: Record<string, string> = {
  Hyperburn: `Product: ONEST HyperBurn | Category: Elite Thermogenic Fat Burner (powder)
Key ingredients: 250mg caffeine total — Caffeine Anhydrous (fast-acting) + Dicaffeine Malate (sustained release, reduces crash). Capsimax® (patented capsaicin for thermogenesis). GBBGO® (converts to L-Carnitine, amplifies fat transport). L-Carnitine. Huperzia Serrata (cognitive focus).
Primary benefits: Accelerates fat burning and thermogenesis. Smooth, sustained energy — no crash, no jitter. Eliminates hunger cravings. Improves mood and mental focus.
Usage: Taken first thing in the morning on an empty stomach.
Primary objection: "I've tried fat burners and they didn't work." Secondary: "Will it make me jittery?"
Brand differentiator: Full ingredient transparency — every dose listed. No proprietary blend. Australian-made, GMP certified. No artificial colours or fillers.`,

  Thermosleep: `Product: ONEST ThermoSleep | Category: Night-time Fat Burner + Sleep Aid
Key ingredients: 5-HTP (serotonin precursor, mood and sleep). Raspberry Ketones. Melatonin (sleep onset). Magnesium (deep sleep quality). EGCG (Green Tea Extract, metabolic support).
Primary benefits: Fall asleep faster. Deeper, more restorative sleep. Wake up energised — not groggy. Supports fat burning overnight without stimulants.
Primary objection: "I'm sceptical anything can burn fat while I sleep." Secondary: "Will it leave me groggy?"
Primary audience: Lara. Also anyone targeting fat loss and sleep quality simultaneously.`,

  Hyperload: `Product: ONEST HyperLoad | Category: Elite High-Stim Pre-Workout
Primary benefits: Explosive training performance. Significant strength and power output increase. Sharp mental focus and clarity. Powerful muscle pumps.
Primary audience: Peter. Serious gym-goers. High-stim seekers. Competitive athletes.
Primary objection: "High-stim pre-workouts make me crash." Secondary: "Is this just a massive caffeine hit?"
Brand differentiator: Full ingredient transparency. Clinically dosed — not under-dosed to hit a price point. Stackable with HyperPump.`,

  Thermoburn: `Product: ONEST ThermoBurn | Category: Capsule Thermogenic
Key ingredients: Two forms of caffeine. Green Tea Extract. Bitter Orange Extract. Grains of Paradise. Theobromine. Lion's Mane. Theacrine.
Primary benefits: Sustained energy without jitters. Mood support. Healthy weight management. Convenience — capsule format, taste-free.
Primary objection: "Capsules feel less effective than powder."
Audience: Busy professionals, both genders, convenience-focused buyers.`,

  "HyperBurn Caffeine Free": `Product: ONEST HyperBurn Caffeine Free | Category: Stimulant-Free Thermogenic
Key ingredients: L-Carnitine. Acetyl-L-Carnitine. Capsimax®. GBBGO®. Huperzia Serrata. Zero caffeine.
Primary benefits: Same fat-burning mechanism as HyperBurn — without stimulants. Ideal for caffeine-sensitive individuals, shift workers, afternoon or evening use. Vegan and keto-friendly.
Primary audience: Lara (primary). Caffeine-sensitive buyers. Shift workers.
Primary objection: "If it has no caffeine, how does it actually work?"
Resolution: Explain non-stimulant fat-burning mechanisms — Capsimax® thermogenesis, GBBGO® carnitine amplification — these work independently of caffeine.`,
};

// ============================================================
// BRIEF GENERATION — COPY FRAMEWORK v3.0 (Stage 1)
// ============================================================

export interface VideoBriefConcept {
  title: string;
  hookLine: string;
  structure: string;
  keyAngle: string;
  sellingStrategy: string;
  ctaApproach: string;
  styleId: ScriptStyleId;
  subStructureId?: string;
}

export interface VideoBriefOptions {
  funnelStage: FunnelStage;
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

function getSubStructureReference(styleConfig: StyleConfig[], funnelStage: FunnelStage): string {
  const relevantStructures = SCRIPT_SUB_STRUCTURES.filter(s => {
    const styleMatch = styleConfig.some(sc => {
      if (sc.quantity <= 0) return false;
      if (sc.styleId === "DR") return s.category === "DR";
      if (sc.styleId === "UGC") return s.category === "UGC";
      if (sc.styleId === "FOUNDER") return s.category === "FOUNDER";
      if (sc.styleId === "BRAND") return s.category === "BRAND";
      return false;
    });
    const funnelMatch = s.funnelStages.includes(funnelStage);
    return styleMatch && funnelMatch;
  });

  if (relevantStructures.length === 0) {
    // Fall back to all structures for the requested styles
    const allForStyle = SCRIPT_SUB_STRUCTURES.filter(s =>
      styleConfig.some(sc => {
        if (sc.quantity <= 0) return false;
        if (sc.styleId === "DR") return s.category === "DR";
        if (sc.styleId === "UGC") return s.category === "UGC";
        if (sc.styleId === "FOUNDER") return s.category === "FOUNDER";
        if (sc.styleId === "BRAND") return s.category === "BRAND";
        return false;
      })
    );
    return allForStyle.map(s =>
      `${s.id} — ${s.name}\nFunnel: ${s.funnelStages.join(", ")} | Awareness: ${s.awarenessLevel}\nStages: ${s.stages.map(st => `${st.stage}: ${st.function}`).join(" → ")}\nWhy it converts: ${s.whyItConverts}`
    ).join("\n\n");
  }

  return relevantStructures.map(s =>
    `${s.id} — ${s.name}\nFunnel: ${s.funnelStages.join(", ")} | Awareness: ${s.awarenessLevel}\nStages: ${s.stages.map(st => `${st.stage}: ${st.function}`).join(" → ")}\nWhy it converts: ${s.whyItConverts}`
  ).join("\n\n");
}

async function generateVideoBrief(
  transcript: string,
  visualAnalysis: string,
  product: string,
  brandName: string,
  productInfoContext: string,
  styleConfig: StyleConfig[],
  duration: number,
  sourceType: "competitor" | "winning_ad",
  funnelStage: FunnelStage
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

  const fallbackBrief = PRODUCT_FALLBACK_BRIEFS[product] || "";
  const fullProductInfo = productInfoContext || fallbackBrief || `Product: ONEST ${product}. Brand: ONEST Health. Website: onest.com.au.`;

  const styleRequests = styleConfig.filter(s => s.quantity > 0);
  const styleRequestText = styleRequests.map(s => {
    const style = SCRIPT_STYLES.find(st => st.id === s.styleId);
    return `${s.quantity}x ${style?.label || s.styleId} (${style?.description || ""})`;
  }).join(", ");

  const subStructureRef = getSubStructureReference(styleConfig, funnelStage);

  const sourceContext = sourceType === "winning_ad"
    ? `This is one of OUR OWN winning ads. Your job is to create VARIATIONS that extend its success — hook swaps, angle shifts, audience reframes, format adaptations. Keep what works, vary what can be tested.`
    : `This is a COMPETITOR ad. Your job is to reverse-engineer what makes it engage viewers, then create concepts that use that engagement framework to SELL ONEST ${product}.`;

  // v3.0 Stage 1 System Prompt
  const system = `You are an elite direct response advertising strategist for ONEST Health, an Australian health supplement brand. You have 15+ years of experience creating video ads that generate measurable sales — not just views.

Your job is to deeply analyse competitor video ads, reverse-engineer what makes them ENGAGE viewers (hook, narrative framework, persuasion mechanism), and then create a creative brief that uses that same engagement framework to SELL an ONEST Health product.

CRITICAL DISTINCTION:
- The competitor's ad structure tells us HOW to hold attention. That is the framework.
- YOUR brief must specify how to use that attention to SELL the ONEST product.
- Every concept you propose must have a clear path from "viewer watches" to "viewer buys."

You understand the difference between:
- DR (Direct Response): Hard-sell. Clear offer. Specific CTA. The viewer must know exactly what the product is, why they need it, and how to buy it now.
- UGC (User-Generated Content): Soft-sell. Authentic personal experience. The viewer should feel like a real person genuinely loves this product — but the product name, benefits, and where to get it are still clearly communicated. UGC sells through trust and relatability, not pressure.
- FOUNDER-LED: Highest-trust format. The founder speaks with authority and personal conviction. Authenticity is the entire mechanism.
- BRAND / EQUITY: Does not ask for a sale. Asks for belief. Measured by watch time, shares, saves, and downstream conversion lift.

You do NOT create generic scripts. You reverse-engineer what makes the competitor ad engage viewers, then build a brief that channels that engagement into product sales.

${COMPLIANCE_RULES}`;

  // v3.0 Stage 1 User Prompt
  const prompt = `Analyse this competitor video ad and create a video creative brief for ONEST Health's ${product}.

${sourceContext}

FUNNEL STAGE: ${funnelStage}
Apply the rules for this funnel stage to all concept development:
- cold: problem-led, product named only after hook establishes tension
- warm: differentiation-led, ONEST named after hook
- retargeting: proof-led, product can be named in hook
- retention: loyalty/stack-led, never re-explain what the product does

${FUNNEL_STAGE_RULES[funnelStage]}

COMPETITOR BRAND: ${brandName}

COMPETITOR TRANSCRIPT:
${transcript}

VISUAL ANALYSIS:
${visualAnalysis}

ONEST PRODUCT INFORMATION:
${fullProductInfo}
${productIntelBlock}

AVAILABLE SCRIPT SUB-STRUCTURES FOR THIS FUNNEL STAGE:
${subStructureRef}

${HOOK_BANK}

INSTRUCTIONS:

PART 1 — COMPETITOR ANALYSIS (What makes their ad ENGAGE viewers?)
1. What is the SPECIFIC hook type?
2. What is the narrative framework?
3. What persuasion mechanism drives engagement?

PART 2 — ONEST SELLING STRATEGY (How do we use that engagement to SELL ${product}?)
4. How should ONEST adapt this framework to sell ${product}? Specify:
   - Which product benefits map to the competitor's key claims
   - How to weave ${product}'s ingredients/results into the narrative naturally
   - What makes ${product} the obvious solution within this framework
5. What is the product selling angle?

PART 3 — SCRIPT CONCEPTS (${styleRequestText})
Generate exactly these concepts: ${styleRequestText}
Each concept MUST specify a subStructureId from the available structures above.

Return your response in this EXACT JSON format:
{
  "funnelStage": "${funnelStage}",
  "competitorConceptAnalysis": "200+ word analysis",
  "hookStyle": "specific hook type identified",
  "hookArchetype": "One of: contrarian, specificFrustration, socialProofLead, namedEnemy, boldClaim",
  "narrativeFramework": "exact narrative structure",
  "persuasionMechanism": "how the ad holds attention and builds desire",
  "productSellingAngle": "150+ words on how ${product}'s benefits map onto the framework",
  "onestAdaptation": "200+ word explanation of how ONEST adapts this to sell ${product}",
  "awarenessLevel": "One of: UNAWARE, PROBLEM_AWARE, SOLUTION_AWARE, PRODUCT_AWARE, MOST_AWARE",
  "primaryObjection": "The main objection and how to overcome it",
  "competitiveRepositioning": "How to position ONEST as better than alternatives",
  "stackOpportunity": "Complementary ONEST products or 'None'",
  "concepts": [
    {
      "title": "...",
      "hookLine": "exact opening hook line",
      "structure": "outline with product/benefit/CTA placement",
      "keyAngle": "unique selling angle",
      "sellingStrategy": "how this script sells ${product}",
      "ctaApproach": "specific CTA approach — no discount codes or offer amounts",
      "styleId": "DR|UGC|FOUNDER|BRAND|EDUCATION|LIFESTYLE|DEMO",
      "subStructureId": "e.g. DR-1, UGC-3, FL-2, BR-1"
    }
  ],
  "targetAudience": "specific target audience",
  "toneAndEnergy": "tone and energy level description"
}`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 8000);

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`[VideoPipeline] Claude returned no JSON object in brief response. Raw: ${response.substring(0, 500)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`[VideoPipeline] Failed to parse brief JSON: ${(e as Error).message}. Raw: ${jsonMatch[0].substring(0, 500)}`);
  }

  // Ensure concepts array exists (handle legacy field names)
  if (!parsed.concepts && (parsed.drConcepts || parsed.ugcConcepts)) {
    parsed.concepts = [
      ...(parsed.drConcepts || []).map((c: any) => ({ ...c, styleId: "DR" })),
      ...(parsed.ugcConcepts || []).map((c: any) => ({ ...c, styleId: "UGC" })),
    ];
  }
  // Ensure funnelStage is set
  if (!parsed.funnelStage) parsed.funnelStage = funnelStage;
  return parsed;
}

// ============================================================
// STYLE-SPECIFIC SCRIPT GENERATION — v3.0 (Stage 2)
// ============================================================

function getSubStructurePromptBlock(subStructureId?: string): string {
  if (!subStructureId) return "";
  const sub = SCRIPT_SUB_STRUCTURES.find(s => s.id === subStructureId);
  if (!sub) return "";
  return `
ASSIGNED SUB-STRUCTURE: ${sub.id} — ${sub.name}
Category: ${sub.category} | Funnel: ${sub.funnelStages.join(", ")} | Awareness: ${sub.awarenessLevel}
Stages:
${sub.stages.map(st => `- ${st.stage}: ${st.function}`).join("\n")}
Why it converts: ${sub.whyItConverts}
Psychological lever: ${sub.psychologicalLever}

Follow this sub-structure's stage progression exactly. Each stage maps to timestamp segments in the script.
`;
}

function getArchetypePromptBlock(archetype?: ActorArchetype): string {
  if (!archetype) return "";
  const profile = ARCHETYPE_PROFILES[archetype];
  if (!profile) return "";
  return `
ACTOR ARCHETYPE: ${profile.label}
Life context: ${profile.lifeContext}
Language register: ${profile.languageRegister}
Pre-product objection: ${profile.preProductObjection}

Apply this voice profile throughout the script. The character's life context, language register, and pre-product objection must be woven into the dialogue naturally.
`;
}

export function getStyleSystemPrompt(styleId: ScriptStyleId, product: string, duration: number, funnelStage: FunnelStage): string {
  const durationRange = duration === 45 ? "40-50" : duration === 90 ? "80-100" : "50-65";
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";
  const funnelRules = FUNNEL_STAGE_RULES[funnelStage];

  const baseRules = `
MANDATORY RULES FOR ALL SCRIPTS:
1. The product name "ONEST ${product}" must appear at least 2-3 times in the script.
2. At least 2-3 specific product benefits or ingredients must be mentioned — not generic supplement claims.
3. Every timestamp segment must include a transitionLine — a single sentence that closes the current segment and opens the next. This makes structural shifts feel inevitable, not engineered. Required in every segment except the final CTA.
4. Every segment must serve the sale — no filler that could apply to any brand.
5. The script must build sequentially — each segment must increase purchase intent before the next begins.
6. Script must be ${durationRange} seconds long with ${segmentCount} timestamp segments.

FUNNEL STAGE: ${funnelStage}
${funnelRules}

${TRANSITION_LOGIC}

${SCRIPT_AUDIT_CHECKLIST}

${COMPLIANCE_RULES}`;

  switch (styleId) {
    case "DR":
      return `You are a world-class direct response copywriter who has generated over $50M in trackable revenue from video ads. You write for ONEST Health, an Australian health supplement brand.

YOUR SCRIPTS SELL PRODUCTS. Every line of dialogue exists to move the viewer closer to purchase. You understand the proven DR framework:

1. HOOK (0-5s): Pattern-interrupt that stops the scroll. Match the approved hook style. For cold traffic: never name the product in the hook.
2. PROBLEM/DESIRE (5-15s): Agitate the pain point or amplify the desire. Make the viewer feel the gap between where they are and where they want to be.
3. SOLUTION REVEAL (15-25s): Introduce ONEST ${product} BY NAME as the answer. Hit 2-3 specific benefits backed by real named ingredients or claims. Timing of first product mention is governed by funnelStage.
4. PROOF (25-40s): Social proof, results, clinical backing, or transformation. Make the viewer believe this product delivers.
5. CTA (40-55s): Clear, direct call-to-action. Tell the viewer exactly what to do next. CTA intensity is governed by funnelStage.

CRITICAL DR RULES:
1. The product name "ONEST ${product}" must appear at least 3 times.
2. At least 3 specific product benefits or named ingredients must be mentioned.
3. The CTA must tell viewers exactly where to go. No discount codes or offer amounts in the script.
4. Every timestamp segment must include a transitionLine — required in every segment except the final CTA.
5. Every segment must serve the sale — no filler, no generic motivation that could apply to any brand.
6. The script must build sequentially — each segment must increase purchase intent before the next begins.
${baseRules}`;

    case "UGC":
      return `You are an expert UGC scriptwriter who creates authentic-feeling video ad scripts for ONEST Health, an Australian health supplement brand. Your scripts sound like real people talking to their phone — not actors reading ad copy.

THE UGC PARADOX: The script must feel completely unscripted and genuine, while strategically communicating product benefits and driving purchase intent.

YOUR UGC FRAMEWORK:
1. HOOK (0-5s): Casual, scroll-stopping opener. Sounds like someone about to share something genuinely exciting. Match the approved hook style. For cold traffic: does not open with the product name.
2. PERSONAL CONTEXT (5-15s): The creator's real situation — their problem, journey, why they were looking for a solution. Builds relatability.
3. DISCOVERY (15-25s): How they found ONEST ${product}. Name the product naturally — the way you'd tell a mate about something you found.
4. EXPERIENCE & RESULTS (25-40s): Specific, personal results — not clinical claims. "I actually had energy at 3pm" not "clinically proven to boost energy." Mention 2-3 benefits naturally.
5. RECOMMENDATION (40-55s): Genuine recommendation. Not "BUY NOW" — "honestly, just try it" or "I'll leave the link below." Feels like a friend's recommendation.

CRITICAL UGC RULES:
1. Product name appears 2-3 times naturally — never in the hook for cold traffic.
2. Benefits expressed as personal experiences, not marketing claims.
3. Every timestamp segment must include a transitionLine — makes each structural shift feel like natural conversation, not a script section change.
4. Apply the voice profile for the selected actor archetype.
5. Include at least one moment of genuine personality — a laugh, a tangent, a self-deprecating comment. Real people are not perfectly polished.
6. BANNED: "formulated", "proprietary", "cutting-edge", "revolutionary", "unlock your potential", "fuel your journey", "transform your body", "achieve your goals". Instant inauthenticity signals.
7. Australian English throughout. Casual AU colloquialisms where they fit naturally — do not force them.
${baseRules}`;

    case "FOUNDER":
      return `You are writing a founder-led video ad script for ONEST Health. The founder speaks with authority, passion, and personal conviction about why they created ${product}.

CRITICAL RULE: The founder must be on camera. This does not work with actors or proxies. Authenticity is the entire mechanism.

FOUNDER-LED FRAMEWORK:
1. HOOK (0-5s): Founder introduces themselves or makes a bold statement about the industry.
2. THE PROBLEM (5-15s): What the founder saw wrong in the supplement industry — proprietary blends, under-dosing, dishonesty.
3. THE MISSION (15-25s): Why they created ONEST — transparency, clinical dosing, doing it right.
4. THE PRODUCT (25-${duration === 90 ? "70" : "40"}s): Specific details about ${product} — ingredients, doses, why it's different.
5. THE INVITATION (final 10-15s): Invites the viewer to try it. Confident but not pushy. "See for yourself."

CRITICAL FOUNDER RULES:
1. Speak with authority and personal conviction — "I created this because..."
2. Show insider knowledge of the industry — what competitors do wrong
3. Be specific about ingredients and doses — founders know their products
4. CTA is an invitation, not a hard sell — "I'd love for you to try it"
5. Every timestamp segment must include a transitionLine.
${baseRules}`;

    case "BRAND":
      return `You are writing a brand/equity video script for ONEST Health. This script does NOT ask for a sale — it asks for BELIEF.

BRAND CONTENT RULES:
- These are measured by watch time, shares, saves, and downstream conversion lift — never by direct ROAS
- Do not evaluate brand content on the same metrics as DR content
- The product appears as the conclusion of the argument, not the start
- Focus on identity, belief, and community — not features and benefits

BRAND FRAMEWORK:
1. OPENING: Aspirational visual or bold belief statement — no product, no logo yet
2. THE TRUTH: What serious performance/health actually requires
3. THE AUDIENCE: Name them — not "supplement users" but "the ones who don't settle"
4. THE CONVICTION: ONEST's position — not what we sell, what we believe
5. THE REVEAL: Product appears as the natural conclusion
6. SIGN-OFF: Brand line — MADE OF GREATNESS

CRITICAL BRAND RULES:
1. Product appears late — earned through the narrative, not inserted
2. No hard sell, no urgency, no "buy now"
3. Every timestamp segment must include a transitionLine.
4. Focus on emotional resonance and identity alignment
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
- Every timestamp segment must include a transitionLine.
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
- Every timestamp segment must include a transitionLine.
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
- Every timestamp segment must include a transitionLine.
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
  duration: number,
  funnelStage: FunnelStage,
  archetype?: ActorArchetype
): Promise<{
  title: string;
  hook: string;
  script: Array<{ timestamp: string; visual: string; dialogue: string; transitionLine?: string }>;
  visualDirection: string;
  strategicThesis: string;
  subStructureId: string;
  scriptMetadata: {
    product: string;
    targetPersona: string;
    awarenessLevel: string;
    funnelStage: string;
    scriptStyle: string;
    subStructure: string;
    hookArchetype: string;
    testHypothesis: string;
    primaryObjection: string;
    actorArchetype?: string;
  };
  visualDirectionBrief: {
    overallStyle: string;
    colorPalette: string;
    pacing: string;
    shots: Array<{ timestamp: string; shotType: string; description: string }>;
  };
}> {
  const productIntel = PRODUCT_INTELLIGENCE[product];
  const fallbackBrief = PRODUCT_FALLBACK_BRIEFS[product] || "";
  const fullProductInfo = productInfoContext || fallbackBrief || `Product: ONEST ${product}. Brand: ONEST Health. Website: onest.com.au.`;

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
  const system = getStyleSystemPrompt(concept.styleId, product, duration, funnelStage);

  const durationRange = duration === 45 ? "40-50" : duration === 90 ? "80-100" : "50-65";
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";

  const subStructureBlock = getSubStructurePromptBlock(concept.subStructureId);
  const archetypeBlock = (concept.styleId === "UGC" && archetype) ? getArchetypePromptBlock(archetype) : "";

  const scriptTypeDesc = concept.styleId === "DR" ? "direct response script"
    : concept.styleId === "UGC" ? "UGC (user-generated content) script"
    : concept.styleId === "FOUNDER" ? "founder-led script"
    : concept.styleId === "BRAND" ? "brand/equity script"
    : `${styleLabel} script`;

  const prompt = `Write a ${scriptTypeDesc} for ONEST Health's ${product} that follows the approved concept brief.

APPROVED CONCEPT:
Title: ${concept.title}
Hook Line: ${concept.hookLine}
Structure: ${concept.structure}
Key Angle: ${concept.keyAngle}
Selling Strategy: ${concept.sellingStrategy || "Sell through key benefits and unique positioning"}
CTA Approach: ${concept.ctaApproach || "Direct viewers to onest.com.au"}
Script Style: ${styleLabel}

${subStructureBlock}

FUNNEL STAGE: ${funnelStage}
Apply funnel stage rules to product naming timing, CTA intensity, and proof placement.

${archetypeBlock}

COMPETITOR'S ENGAGEMENT FRAMEWORK (use for PACING and STRUCTURE, not content):
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Persuasion Mechanism: ${brief.persuasionMechanism}

PRODUCT SELLING ANGLE:
${brief.productSellingAngle || brief.onestAdaptation}

HOW TO ADAPT FOR ONEST:
${brief.onestAdaptation}

TARGET AUDIENCE: ${brief.targetAudience}
TONE & ENERGY: ${brief.toneAndEnergy}

COMPETITOR'S ORIGINAL TRANSCRIPT (for reference — use PACING and STRUCTURE, not words):
${transcript}

=== PRODUCT INFORMATION (YOU MUST USE THIS) ===
${fullProductInfo}
${productIntelBlock}
=== END PRODUCT INFORMATION ===

Return your response in this EXACT JSON format:
{
  "title": "${concept.title}",
  "hook": "exact opening line — stops the scroll as a complete idea in under 3 seconds",
  "script": [
    {
      "timestamp": "0-3s",
      "visual": "what the viewer sees",
      "dialogue": "what is said — every line serves the sale",
      "transitionLine": "single sentence closing this segment and opening the next"
    },
    ...more rows covering ${durationRange} seconds total (${segmentCount} segments)
  ],
  "visualDirection": "2-3 sentences. DR: polished direct response energy. UGC: phone-filmed, natural lighting, real environment.",
  "strategicThesis": "Paragraph: (1) how this uses the competitor's engagement framework, (2) how it sells ONEST ${product} specifically, (3) what psychological triggers drive purchase intent, (4) why the CTA approach will convert"
}

CRITICAL: Every script segment MUST include a transitionLine field (except the final CTA segment). The transitionLine is a single sentence that closes the current segment and opens the next, making the structural shift feel inevitable rather than engineered.

Make the script ~${duration} seconds long with ${segmentCount} timestamp segments.`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 6000);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Attach metadata
      parsed.subStructureId = concept.subStructureId || "";
      parsed.scriptMetadata = {
        product: `ONEST ${product}`,
        targetPersona: productIntel?.targetPersona || brief.targetAudience || "Health-conscious adults",
        awarenessLevel: brief.awarenessLevel || "PROBLEM_AWARE",
        funnelStage,
        scriptStyle: styleLabel,
        subStructure: concept.subStructureId || "custom",
        hookArchetype: brief.hookArchetype || "UNKNOWN",
        testHypothesis: `Testing ${concept.subStructureId || styleLabel} structure with ${brief.hookArchetype || "mixed"} hook archetype for ${product} at ${funnelStage} funnel stage`,
        primaryObjection: brief.primaryObjection || "Scepticism",
        ...(archetype ? { actorArchetype: archetype } : {}),
      };
      if (!parsed.visualDirectionBrief) {
        parsed.visualDirectionBrief = {
          overallStyle: concept.styleId === "UGC" ? "Phone-filmed, natural lighting, real environment" : "Polished direct response energy",
          colorPalette: "ONEST brand colours",
          pacing: duration === 45 ? "Fast-paced, punchy" : duration === 90 ? "Measured, story-driven" : "Medium pacing",
          shots: [],
        };
      }
      return parsed;
    }
  } catch (e) {
    console.error("[VideoPipeline] Failed to parse script JSON:", e);
  }

  // Fallback
  return {
    title: concept.title,
    hook: concept.hookLine,
    script: [
      { timestamp: "0-3s", visual: "Opening shot", dialogue: concept.hookLine, transitionLine: "But here's what most people don't realise..." },
      { timestamp: "3-10s", visual: "Problem setup", dialogue: "Here's what most people don't know...", transitionLine: "And that's exactly why this matters." },
      { timestamp: "10-25s", visual: "Solution reveal", dialogue: `ONEST ${product} changes everything.`, transitionLine: "The results speak for themselves." },
      { timestamp: "25-45s", visual: "Social proof", dialogue: "The results speak for themselves.", transitionLine: "So here's what you can do right now." },
      { timestamp: "45-55s", visual: "CTA", dialogue: "Click the link below to get started." },
    ],
    visualDirection: "Match the competitor's production style.",
    strategicThesis: "This script adapts the competitor's framework for ONEST.",
    subStructureId: concept.subStructureId || "",
    scriptMetadata: {
      product: `ONEST ${product}`,
      targetPersona: productIntel?.targetPersona || "Health-conscious adults",
      awarenessLevel: brief.awarenessLevel || "PROBLEM_AWARE",
      funnelStage,
      scriptStyle: styleLabel,
      subStructure: concept.subStructureId || "custom",
      hookArchetype: brief.hookArchetype || "UNKNOWN",
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
// EXPERT REVIEW PANEL — v3.0 (6 CRITERIA, 5 ROUNDS)
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
  productInfoContext: string,
  funnelStage: FunnelStage
): Promise<{ rounds: any[]; finalScore: number; approved: boolean; summary: string }> {
  const rounds: any[] = [];
  let currentScript = scriptJson;
  let approved = false;
  let finalScore = 0;
  const MAX_ROUNDS = 5;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // v3.0 Stage 3 Review System Prompt — 6 criteria of equal weight
    const system = `You are simulating a panel of 10 advertising experts reviewing a ${scriptStyle} script for ONEST Health's ${product}. This is review round ${round}.

Score based on SIX criteria of equal weight:

1. ENGAGEMENT FRAMEWORK: Does the script follow the approved hook style and narrative framework? Does it use the competitor's engagement structure correctly?

2. PRODUCT SELLING: Does the script effectively sell ONEST ${product}? Is the product named? Are specific benefits and named ingredients mentioned? Would a viewer know what the product is and why they should want it?

3. CTA STRENGTH:
   DR: Does the script end with a clear, direct CTA? Does the viewer know exactly where to go?
   UGC: Does the script end with a genuine, friend-like recommendation? Would a viewer feel motivated to check out the product?

4. FORMAT AUTHENTICITY:
   DR: Does this feel like a polished direct response ad that drives action?
   UGC: Does this feel like authentic UGC — a real person sharing a genuine experience? Or does it sound like scripted ad copy?

5. PERSUASION ARCHITECTURE: Does the script build sequentially — does each segment increase purchase intent before the next begins? Is the CTA arriving at peak motivation, after proof has landed? Does each transitionLine make the structural shift feel inevitable, not engineered? Is there a tension established in the hook that gets resolved in the solution section?

6. CONVERSION POTENTIAL: Overall — would this script drive purchases? Would you approve this to run as a paid ad for ONEST ${product}?

SCORE FLOOR RULES — strictly enforced:
- Script fails to mention product by name: score MUST be below 70
- Script has no clear CTA (DR) or no recommendation (UGC): score MUST be below 75
- Script could belong to any generic supplement brand: score MUST be below 80
- Product introduced before problem is established (cold/warm): score MUST be below 80
- Any transitionLine missing from the JSON output: score MUST be below 85
- Script contains banned phrases ("unlock your potential", "fuel your journey", "transform your body", "achieve your goals"): score MUST be below 75

FUNNEL STAGE: ${funnelStage}
Verify the script follows the non-negotiable rules for this funnel stage.

${COMPLIANCE_RULES}

Score range guidance:
- 90-100: Approved. Effective product sell, strong CTA, authentic format, sequential persuasion architecture, complete transitionLine coverage.
- 80-89: Good but missing specific product benefits, CTA could be stronger, or one transition feels engineered.
- 70-79: Framework correct but script does not sell the product effectively. Structural issue.
- Below 70: Could be for any brand. Fundamental commercial failure. Requires structural rewrite.

Return JSON:
{
  "reviews": [
    {
      "expertName": "Full name",
      "domain": "Their domain/framework",
      "score": 60 to 100,
      "feedback": "2-3 sentences: what works, what is missing for selling the product, one specific improvement"
    }
  ]
}

Score range guidance:
- 90-100: Approved. Effective product sell, strong CTA, authentic format.
- 80-89: Good but missing specific product benefits or CTA could be stronger.
- 70-79: Framework correct but script does not sell the product effectively.
- Below 70: Could be for any brand. Fundamental commercial failure.`;

    const reviewPrompt = `Review this ${scriptStyle} script for ONEST Health's ${product}.

SCRIPT:
${JSON.stringify(currentScript, null, 2)}

PRODUCT INFORMATION:
${productInfoContext || PRODUCT_FALLBACK_BRIEFS[product] || `ONEST ${product}`}

BRIEF CONTEXT:
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Target Audience: ${brief.targetAudience}
Funnel Stage: ${funnelStage}

${round >= 4 ? 'ROUND 4+ INSTRUCTION: If the script has not cleared 90 after 3 rounds, the issue is STRUCTURAL. Polishing sentences will not solve a structural problem. Instruct a rebuild from the hook down — new hook approach, new narrative arc, new proof sequencing.' : ''}

Provide your expert panel review as JSON.`;

    const reviewResponse = await callClaude([{ role: "user", content: reviewPrompt }], system, 4000);

    let reviewData: any;
    try {
      const jsonMatch = reviewResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error(`[VideoPipeline] Failed to parse review round ${round}:`, e);
    }

    if (!reviewData?.reviews) {
      reviewData = {
        reviews: NAMED_EXPERTS.slice(0, 10).map(exp => ({
          expertName: exp.name,
          domain: exp.framework,
          score: 75,
          feedback: "Could not generate review. Manual review recommended.",
        })),
      };
    }

    const avgScore = Math.round(
      reviewData.reviews.reduce((sum: number, r: any) => sum + (r.score || 75), 0) / reviewData.reviews.length
    );

    rounds.push({
      round,
      reviews: reviewData.reviews,
      averageScore: avgScore,
      timestamp: new Date().toISOString(),
    });

    if (avgScore >= 90) {
      approved = true;
      finalScore = avgScore;
      break;
    }

    finalScore = avgScore;

    // If not the last round, revise the script
    if (round < MAX_ROUNDS) {
      const lowestCriteria = reviewData.reviews
        .sort((a: any, b: any) => (a.score || 75) - (b.score || 75))
        .slice(0, 3)
        .map((r: any) => `${r.expertName} (${r.domain}): ${r.feedback}`)
        .join("\n");

      const revisionInstruction = round >= 4
        ? `STRUCTURAL REWRITE REQUIRED. The script has failed to clear 90 after ${round - 1} rounds. The issue is structural, not copy polish. Rebuild from the hook down — new hook approach, new narrative arc, new proof sequencing. Keep the same product and concept angle but completely restructure the delivery.`
        : `Revise the script to address the 3 lowest-scoring criteria. Focus on specific improvements, not general polish.`;

      const revisionPrompt = `${revisionInstruction}

LOWEST-SCORING FEEDBACK:
${lowestCriteria}

CURRENT SCRIPT:
${JSON.stringify(currentScript, null, 2)}

Return the COMPLETE revised script in the same JSON format (title, hook, script array with timestamp/visual/dialogue/transitionLine, visualDirection, strategicThesis).`;

      const revisionSystem = getStyleSystemPrompt(currentScript.scriptMetadata?.scriptStyle === 'UGC' ? 'UGC' : currentScript.scriptMetadata?.scriptStyle === 'Founder-Led' ? 'FOUNDER' : currentScript.scriptMetadata?.scriptStyle === 'Brand / Equity' ? 'BRAND' : 'DR', product, 60, funnelStage);

      const revisionResponse = await callClaude([{ role: "user", content: revisionPrompt }], revisionSystem, 6000);

      try {
        const jsonMatch = revisionResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const revisedScript = JSON.parse(jsonMatch[0]);
          // Preserve metadata from original
          revisedScript.subStructureId = currentScript.subStructureId;
          revisedScript.scriptMetadata = currentScript.scriptMetadata;
          revisedScript.visualDirectionBrief = revisedScript.visualDirectionBrief || currentScript.visualDirectionBrief;
          currentScript = revisedScript;
        }
      } catch (e) {
        console.error(`[VideoPipeline] Failed to parse revision round ${round}:`, e);
      }
    }
  }

  const summary = approved
    ? `Script approved in round ${rounds.length} with average score ${finalScore}/100.`
    : `Script completed ${rounds.length} review rounds. Final score: ${finalScore}/100. ${finalScore < 90 ? 'Flagged for human review.' : ''}`;

  return { rounds, finalScore, approved, summary };
}

// ============================================================
// COST ESTIMATION — v3.0
// ============================================================

export function estimatePipelineCost(styleConfig: StyleConfig[], duration: number): {
  totalScripts: number;
  estimatedTokens: number;
  estimatedCostUSD: number;
  breakdown: Array<{ style: string; quantity: number; tokensPerScript: number }>;
} {
  const breakdown = styleConfig.filter(s => s.quantity > 0).map(s => {
    const style = SCRIPT_STYLES.find(st => st.id === s.styleId);
    const baseTokens = duration === 45 ? 8000 : duration === 90 ? 14000 : 10000;
    const reviewTokens = 12000; // ~3 review rounds average
    const tokensPerScript = baseTokens + reviewTokens;
    return {
      style: style?.label || s.styleId,
      quantity: s.quantity,
      tokensPerScript,
    };
  });

  const totalScripts = breakdown.reduce((sum, b) => sum + b.quantity, 0);
  const estimatedTokens = breakdown.reduce((sum, b) => sum + (b.quantity * b.tokensPerScript), 0);
  // Brief generation tokens
  const briefTokens = 12000;
  const totalTokens = estimatedTokens + briefTokens;
  // Approximate cost at $3/1M input + $15/1M output tokens (Claude Sonnet)
  const estimatedCostUSD = Math.round((totalTokens * 0.000015) * 100) / 100;

  return { totalScripts, estimatedTokens: totalTokens, estimatedCostUSD, breakdown };
}

// ============================================================
// STAGED PIPELINE FUNCTIONS — v3.0 (matches routers.ts interface)
// ============================================================

// Helper to load product info context
// loadProductInfoContext — now imported from _shared.ts as buildProductInfoContext
const loadProductInfoContext = buildProductInfoContext;

function getProductIntelligence(product: string) {
  return PRODUCT_INTELLIGENCE[product] || {
    fullName: `ONEST ${product}`,
    category: "Health Supplement",
    copyLevers: ["Full ingredient transparency", "Australian-made, GMP certified", "No proprietary blends"],
    copyTraps: ["Avoid generic supplement claims"],
    stackPartners: [],
    targetPersona: "Health-conscious adults 25-55",
    awarenessAngle: "Problem-aware",
    keyIngredients: [],
    primaryBenefit: "Premium quality health supplement",
    differentiator: "Full label transparency",
  };
}

function formatBriefForDisplay(brief: VideoBriefOptions, brandName: string, product: string, sourceType: string): string {
  const sourceLabel = sourceType === "winning_ad" ? "Our Winning Ad" : `${brandName} Competitor Ad`;
  let text = `# Video Creative Brief — ${product}\n## Based on ${sourceLabel}\n`;
  text += `### Classification\n`;
  text += `- **Funnel Stage:** ${brief.funnelStage || "N/A"}\n`;
  text += `- **Hook Archetype:** ${(brief as any).hookArchetype?.replace(/_/g, " ") || "N/A"}\n`;
  text += `- **Awareness Level:** ${brief.awarenessLevel?.replace(/_/g, " ") || "N/A"}\n`;
  text += `### Competitor Concept Analysis\n${brief.competitorConceptAnalysis}\n`;
  text += `### Hook Style\n${brief.hookStyle}\n`;
  text += `### Narrative Framework\n${brief.narrativeFramework}\n`;
  text += `### Persuasion Mechanism\n${brief.persuasionMechanism}\n`;
  text += `### Product Selling Angle\n${brief.productSellingAngle || "N/A"}\n`;
  text += `### Primary Objection\n${brief.primaryObjection || "N/A"}\n`;
  text += `### Competitive Repositioning\n${brief.competitiveRepositioning || "N/A"}\n`;
  text += `### ONEST Adaptation Strategy\n${brief.onestAdaptation}\n`;
  text += `### Stack Opportunity\n${brief.stackOpportunity || "None"}\n---\n`;
  text += `### Script Concepts (${brief.concepts?.length || 0})\n`;
  if (brief.concepts && Array.isArray(brief.concepts)) {
    brief.concepts.forEach((concept, i) => {
      const styleName = SCRIPT_STYLES.find(s => s.id === concept.styleId)?.label || concept.styleId;
      text += `\n**${i + 1}. ${concept.title}** (${styleName})\n`;
      text += `- Hook: "${concept.hookLine}"\n`;
      text += `- Structure: ${concept.structure}\n`;
      text += `- Angle: ${concept.keyAngle}\n`;
      text += `- Selling Strategy: ${concept.sellingStrategy || "N/A"}\n`;
      text += `- CTA: ${concept.ctaApproach || "N/A"}\n`;
      text += `- Sub-Structure: ${concept.subStructureId || "N/A"}\n`;
    });
  }
  text += `\n---\n**Target Audience:** ${brief.targetAudience}\n**Tone & Energy:** ${brief.toneAndEnergy}`;
  return text;
}

// Convert new-style StyleConfig[] to old-style object for backward compat
function normalizeStyleConfig(input: any): StyleConfig[] {
  if (Array.isArray(input)) return input as StyleConfig[];
  // Old format: { direct_response: 2, ugc_testimonial: 2 }
  const mapping: Record<string, ScriptStyleId> = {
    direct_response: "DR",
    ugc_testimonial: "UGC",
    founder_led: "FOUNDER",
    education_mythbusting: "EDUCATION",
    lifestyle_aspiration: "LIFESTYLE",
    problem_solution_demo: "DEMO",
  };
  const result: StyleConfig[] = [];
  if (input && typeof input === "object") {
    for (const [key, val] of Object.entries(input)) {
      const styleId = mapping[key];
      if (styleId && typeof val === "number" && val > 0) {
        result.push({ styleId, quantity: val });
      }
    }
  }
  if (result.length === 0) {
    result.push({ styleId: "DR", quantity: 2 }, { styleId: "UGC", quantity: 2 });
  }
  return result;
}

/**
 * Stages 1-3: Transcription → Visual Analysis → Brief Generation
 * Pauses at stage_3b_brief_approval for user review.
 */
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
  styleConfig?: any;
  funnelStage?: FunnelStage;
  actorArchetype?: ActorArchetype;
}) {
  console.log(`[VideoPipeline] Starting stages 1-3 for run #${runId}`);
  const sourceType = input.sourceType || "competitor";
  const duration = input.duration || 60;
  const styleConfig = normalizeStyleConfig(input.styleConfig);
  const funnelStage: FunnelStage = (input as any).funnelStage || "cold";
  const productInfoContext = await loadProductInfoContext(input.product);

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
      analyzeVideoFrames(input.mediaUrl, transcript, input.foreplayAdBrand || ""),
      STEP_TIMEOUT, "Visual analysis"
    );
  } catch (err: any) {
    console.error("[VideoPipeline] Visual analysis failed:", err.message);
    visualAnalysis = `Visual analysis failed: ${err.message}`;
  }
  await db.updatePipelineRun(runId, { visualAnalysis });
  console.log(`[VideoPipeline] Stage 2 complete, analysis length: ${visualAnalysis.length}`);

  // Stage 3: Generate Video Brief (v3.0 Stage 1)
  await db.updatePipelineRun(runId, { videoStage: "stage_3_brief" });
  try {
    const briefOptions = await withTimeout(
      generateVideoBrief(
        transcript, visualAnalysis, input.product,
        input.foreplayAdBrand || "", productInfoContext,
        styleConfig, duration, sourceType, funnelStage
      ),
      STEP_TIMEOUT, "Video brief"
    );
    console.log(`[VideoPipeline] Stage 3 complete, brief generated with ${briefOptions.concepts?.length || 0} concepts`);
    const briefText = formatBriefForDisplay(briefOptions, input.foreplayAdBrand || "", input.product, sourceType);
    await db.updatePipelineRun(runId, {
      videoBrief: briefText,
      videoBriefOptions: briefOptions,
      videoStage: "stage_3b_brief_approval",
      videoFunnelStage: funnelStage,
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

/**
 * Stage 4: Script Generation + Expert Review (v3.0 Stages 2 & 3)
 * Pauses at stage_4b_script_approval for user review.
 */
export async function runVideoPipelineStage4(runId: number, run: any) {
  console.log(`[VideoPipeline] Resuming stage 4 for run #${runId}`);
  const stageStart = Date.now();
  const brief: VideoBriefOptions = (run.videoBriefOptions as any) || {};
  const duration = run.videoDuration || 60;
  const sourceType = run.videoSourceType || "competitor";
  const funnelStage: FunnelStage = run.videoFunnelStage || brief.funnelStage || "cold";
  const archetypes: ActorArchetype[] = (run.videoArchetypes as any) || [];
  const defaultArchetype = archetypes.length > 0 ? archetypes[0] : undefined;
  const productInfoContext = await loadProductInfoContext(run.product);

  await db.updatePipelineRun(runId, { videoStage: "stage_4_scripts" });
  const concepts = brief.concepts || [
    ...(brief.drConcepts || []).map((c: any) => ({ ...c, styleId: "DR" as ScriptStyleId })),
    ...(brief.ugcConcepts || []).map((c: any) => ({ ...c, styleId: "UGC" as ScriptStyleId })),
  ];

  const allScripts: any[] = [];
  for (let i = 0; i < concepts.length; i++) {
    // Check outer timeout before starting next script
    if (Date.now() - stageStart > STAGE_4_TIMEOUT) {
      console.error(`[VideoPipeline] Stage 4 timed out after ${Math.round((Date.now() - stageStart) / 60000)}min. ${allScripts.length}/${concepts.length} scripts completed.`);
      await db.updatePipelineRun(runId, { scriptsJson: allScripts });
      throw new Error(`Stage 4 timed out after ${Math.round((Date.now() - stageStart) / 60000)} minutes. ${allScripts.length}/${concepts.length} scripts were generated successfully.`);
    }
    const concept = concepts[i];
    const styleLabel = SCRIPT_STYLES.find(s => s.id === concept.styleId)?.label || concept.styleId;
    const label = `${styleLabel} ${i + 1}`;
    console.log(`[VideoPipeline] Generating script ${i + 1}/${concepts.length}: ${concept.title} (${styleLabel})...`);

    try {
      const script = await withTimeout(
        generateConceptMatchedScript(
          run.transcript || "", run.visualAnalysis || "",
          run.product, concept, brief, productInfoContext,
          duration, funnelStage,
          concept.styleId === "UGC" ? defaultArchetype : undefined
        ),
        STEP_TIMEOUT, `Script ${label}`
      );
      console.log(`[VideoPipeline] ${label} generated, starting review...`);

      let review;
      try {
        review = await withTimeout(
          reviewScriptWithPanel(
            script, run.product, styleLabel, brief,
            productInfoContext, funnelStage
          ),
          STEP_TIMEOUT * 2, `Review ${label}`
        );
      } catch (reviewErr: any) {
        console.error(`[VideoPipeline] Review of ${label} failed:`, reviewErr.message);
        review = { finalScore: 75, rounds: [], approved: true, summary: `Review failed: ${reviewErr.message}. Script approved by default.` };
      }

      allScripts.push({
        type: concept.styleId,
        number: i + 1,
        label,
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
  await db.updatePipelineRun(runId, {
    videoStage: "stage_4b_script_approval",
  });
  console.log(`[VideoPipeline] Scripts generated. Waiting for user approval before ClickUp push.`);
}

function formatScriptForClickUp(script: any, runId: number, appUrl: string): string {
  const scriptViewUrl = `${appUrl}/results/${runId}?script=${encodeURIComponent(script.label)}`;
  const meta = script.scriptMetadata || {};
  const vd = script.visualDirection || {};
  let content = `# ${script.title}\n\n`;
  content += `**Type:** ${(script.type || "").replace(/_/g, " ")} | **Score:** ${script.review?.finalScore}/100\n`;
  if (meta.scriptStyle) content += `**Style:** ${meta.scriptStyle}\n`;
  if (meta.funnelStage) content += `**Funnel Stage:** ${meta.funnelStage}\n`;
  if (meta.awarenessLevel) content += `**Awareness:** ${meta.awarenessLevel}\n`;
  if (meta.targetPersona) content += `**Persona:** ${meta.targetPersona}\n`;
  if (meta.subStructure) content += `**Sub-Structure:** ${meta.subStructure}\n`;
  if (meta.hookArchetype) content += `**Hook Archetype:** ${meta.hookArchetype}\n`;
  if (meta.testHypothesis) content += `**Hypothesis:** ${meta.testHypothesis}\n`;
  if (meta.primaryObjection) content += `**Primary Objection:** ${meta.primaryObjection}\n`;
  if (meta.actorArchetype) content += `**Actor Archetype:** ${meta.actorArchetype}\n`;
  content += `\n## STRATEGIC THESIS\n${script.strategicThesis}\n\n`;
  content += `## HOOK\n${script.hook}\n\n`;
  content += `## FULL SCRIPT\n\n**[View on ONEST Pipeline →](${scriptViewUrl})**\n\n`;
  if (script.script && Array.isArray(script.script)) {
    content += `| TIMESTAMP | VISUAL | DIALOGUE |\n|---|---|---|\n`;
    for (const row of script.script) {
      const ts = (row.timestamp || "").replace(/\|/g, "\\|");
      const vis = (row.visual || "").replace(/\|/g, "\\|");
      const dia = (row.dialogue || "").replace(/\|/g, "\\|");
      content += `| ${ts} | ${vis} | ${dia} |\n`;
    }
    content += `\n`;
  }
  if (typeof vd === "object" && (vd.style || vd.talent || vd.setting)) {
    content += `## VISUAL DIRECTION BRIEF\n`;
    for (const [key, val] of Object.entries(vd)) {
      if (val) content += `- **${key}:** ${val}\n`;
    }
  } else if (typeof script.visualDirection === "string") {
    content += `## VISUAL DIRECTION\n${script.visualDirection}\n`;
  }
  return content;
}

/**
 * Stage 5: Push approved scripts to ClickUp.
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

