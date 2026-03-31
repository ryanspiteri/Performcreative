# ONEST Script Generation System — Creative Framework

**For review by: Lachlan (Marketing Director)**
**Purpose: Understand how scripts are generated, why they're written the way they are, and what to change**

---

## How It Works (Overview)

The system generates video ad scripts by combining six inputs:

1. **Product** — which ONEST product the script is selling
2. **Script Style** — the format/approach (DR, UGC, Founder-Led, etc.)
3. **Structure** — the specific narrative framework (19 options)
4. **Funnel Stage** — where the viewer is in the buying journey
5. **Audience Archetype** — who the script is written for
6. **Concept** — the user's creative direction (free text)

The AI assembles all of these into a prompt, generates the script, then runs it through an expert review panel that scores and revises it up to 5 times until it hits 90/100.

---

## 1. Script Styles (7 Types)

Each style changes the AI's entire writing persona and approach.

| Style | What It Is | When to Use |
|---|---|---|
| **DR (Direct Response)** | Hard-sell with clear offer, urgency, and direct CTA | Paid ads where ROAS is the metric |
| **UGC / Testimonial** | Authentic personal experience, soft-sell recommendation | When authenticity matters more than polish |
| **Founder-Led** | Brand founder speaking with authority and passion | Building trust, industry call-outs |
| **Brand / Equity** | Belief-led content — asks for belief, not a sale | Top-of-funnel, watch time, shares, saves |
| **Education / Myth-Busting** | Teach something surprising, position product as the answer | When the differentiator needs explaining |
| **Lifestyle / Aspiration** | Aspirational day-in-the-life with product woven in | Organic-feeling content, identity-driven |
| **Demo** | Show the problem, demonstrate the product solving it | When the product experience is the sell |

### What each style tells the AI

**DR scripts** must: mention ONEST product name 3+ times, include 3+ specific ingredients/benefits, end with a clear CTA telling viewers exactly where to go. Every segment must serve the sale.

**UGC scripts** must: sound like a real person talking to their phone, not an actor reading ad copy. Benefits expressed as personal experiences ("I actually had energy at 3pm"), not marketing claims. Includes at least one moment of genuine personality — a laugh, a tangent, a self-deprecating comment.

**Founder-Led scripts** must: speak with authority and insider knowledge of the supplement industry. Show what competitors do wrong. Be specific about ingredients and doses. CTA is an invitation, not a hard sell.

**Brand scripts** must: NOT ask for a sale. Product appears late — earned through the narrative. Focus on identity, belief, and community. Measured by watch time, shares, saves — never direct ROAS.

**Banned words across all UGC:** "formulated", "proprietary", "cutting-edge", "revolutionary", "unlock your potential", "fuel your journey", "transform your body", "achieve your goals" — instant inauthenticity signals.

---

## 2. The 19 Sub-Structures

These are the specific narrative frameworks the AI follows. Each one has defined stages, a psychological lever, and a reason it converts.

### Direct Response (7 structures)

**DR-1: Problem - Agitate - Solve (PAS)**
- Funnel: Cold | Length: 15-30s
- Flow: Hook (name the problem personally) → Problem (validate the pain) → Agitate (make inaction feel costly) → Solve (ONEST as logical answer) → Proof (one credible result) → CTA
- Why it converts: Meets Peter and Lara at their emotion before asking them to care about a product
- Psychological lever: Loss aversion — agitation makes inaction feel more costly than the purchase

**DR-2: Before - After - Bridge (BAB)**
- Funnel: Warm | Length: 20-45s
- Flow: Hook (paint the 'before' state) → Before (make it feel lived-in) → After (specific, believable contrast) → Bridge (ONEST moves you between states) → CTA (anchor to the 'after' state)
- Why it converts: The brain visualises the 'after' automatically. Lara is motivated by the clearest vision of her best self
- Psychological lever: Desire amplification

**DR-3: Hook - Mechanism - Proof - CTA**
- Funnel: Warm/Retargeting | Length: 30-60s
- Flow: Hook (bold claim or contrarian statement) → Mechanism (name the ingredient, explain the process) → Proof (numbers, results, science) → CTA
- Why it converts: Directly answers "does it actually work?" Named ingredients are the sale — transparency is the differentiator
- Psychological lever: Authority + Commitment — education creates a micro-yes ladder

**DR-4: Enemy Framing - Reveal - Solution**
- Funnel: Cold/Warm | Length: 20-45s
- Flow: Hook (name the enemy — a lie, an industry practice) → Expose (how the enemy causes the problem) → Reveal (ONEST operates differently) → Proof (label shown, dose stated) → CTA ("judge for yourself")
- Why it converts: Peter and Lara are already cynical about supplements. Validates that cynicism and positions ONEST as the honest exception
- Psychological lever: Unity + Liking — shared enemy creates tribal alignment

**DR-5: Contrarian Statement - Proof - Reframe - CTA**
- Funnel: Cold | Length: 15-30s
- Flow: Hook (say the opposite of what they expect) → Proof (back it immediately) → Reframe (show them the world differently) → CTA ("see for yourself")
- Why it converts: A contrarian hook creates neurological pattern interruption — the brain must resolve the tension
- Psychological lever: Cognitive dissonance

**DR-6: Social Proof Lead - Identification - Product - CTA**
- Funnel: Retargeting | Length: 15-30s
- Flow: Hook (specific customer result) → Identification ("if you're anything like [name]...") → Problem connect (confirm the shared pain) → Product (mechanism behind the result) → CTA (risk-reversal)
- Why it converts: Social proof as the opener short-circuits scepticism before it activates
- Psychological lever: Social proof + Endowment effect

**DR-7: Story - Lesson - Product**
- Funnel: Cold/Warm | Length: 45-90s
- Flow: Hook (open mid-story, in media res) → Story (personal, relatable struggle) → Lesson (what changed) → Product (part of the solution, mentioned naturally) → CTA (soft)
- Why it converts: Bypasses the sales defence mechanism entirely. Viewer is invested in the story before they realise there's a product
- Psychological lever: Narrative transportation

---

### UGC (6 structures)

**UGC-1: Talking Head Review**
- Funnel: Cold/Warm | Length: 30-60s
- Flow: Hook (mid-thought, never "hey guys") → Credibility (who they are in one sentence) → The before (one clear pain point) → The discovery (how they found ONEST — casual) → The result (one specific result) → The endorsement ("I just tell everyone now") → CTA (soft)
- Why it converts: The brain processes peer-to-camera content as advice, not advertising
- Psychological lever: Social proof through perceived authenticity

**UGC-2: Objection Crusher**
- Funnel: Warm/Retargeting | Length: 30-45s
- Flow: Hook (voice the objection directly) → Validate (agree with the scepticism) → The turning point (what made them try) → What surprised them (one unexpected result) → The reframe ("I was wrong about this one") → CTA
- Why it converts: Names the exact objection in the viewer's head, validates it, then resolves it
- Psychological lever: Credibility through honesty — admitting prior scepticism makes the endorsement exponentially more believable

**UGC-3: Day in the Life**
- Funnel: Cold | Length: 45-90s
- Flow: Hook (real moment — waking up, pre-gym) → Context (show the routine, not just product) → Natural integration (product as part of routine) → The feeling (energy, focus, no crash) → The outcome (life benefit) → Sign-off ("this is just what I do now")
- Why it converts: Lara isn't buying a supplement — she's buying into a version of her life where she's consistent, energised, and performing
- Psychological lever: Aspirational identity — the product is the prop, not the plot

**UGC-4: Myth Bust / Hot Take**
- Funnel: Cold/Warm | Length: 30-60s
- Flow: Hook ("You don't need a pre-workout") → Hold tension (don't resolve it) → The nuance ("...unless you're doing it right") → The standard (specific ingredients, real doses) → The product (ONEST as the example) → CTA ("judge for yourself")
- Why it converts: Peter trusts people willing to tell him what not to buy. When you then show him what to buy, credibility transfer is complete
- Psychological lever: Authority through honesty — transparency framing is ONEST's core DNA

**UGC-5: Results Reveal**
- Funnel: Retargeting | Length: 20-40s
- Flow: Hook (result first — "I've lost 6kg in 8 weeks") → Pre-empt the sceptic → What changed (minimal) → The product's role (one specific benefit) → The proof (photo, metric) → CTA
- Why it converts: Leads with the destination. Viewer's first question is "how?" — they're leaning in before you've explained anything
- Psychological lever: Curiosity through proof

**UGC-6: Product Demo / Ingredient Education**
- Funnel: Warm/Retargeting | Length: 45-75s
- Flow: Hook (specific ingredient claim) → Education (explain the mechanism simply) → The comparison (category standard vs ONEST) → Visual demo (scooping, mixing, label shown) → The feel (what it feels like in the body) → CTA
- Why it converts: Converts the analytical buyer who reads every label. Transparency is the sale — this structure makes it literal and visible
- Psychological lever: Authority through education

---

### Founder-Led (3 structures)

**FL-1: The Origin Story**
- Funnel: Cold/Warm | Length: 60-90s
- Flow: Hook (the breaking point, not the beginning) → The problem they lived → The decision (build instead of complain) → The standard they set → What that looks like now → The invitation ("That's why we built this. That's who it's for.")
- Why it converts: Answers "why should I trust you?" before the question is asked
- Psychological lever: Narrative authority — the founder's story IS the proof of concept

**FL-2: The Industry Call-Out**
- Funnel: Cold/Warm | Length: 45-75s
- Flow: Hook ("I need to talk about what's in most supplements") → The problem named (proprietary blends, underdosing) → The evidence (how to spot it) → The standard (what ONEST does differently) → The challenge ("compare our label") → CTA
- Why it converts: Validates every suspicion Peter and Lara already had
- Psychological lever: Unity + Authority — shared enemy creates tribal alignment

**FL-3: The Standard-Setter**
- Funnel: Retargeting | Length: 30-60s
- Flow: Hook (specific product claim with confidence) → The why (personal conviction) → The what (specific ingredient/dose decision) → The comparison (what the alternative looks like) → The ask ("Try it and judge for yourself")
- Why it converts: Converts the final-stage sceptic who needs to believe in the people behind the product
- Psychological lever: Personal conviction as proof

---

### Brand / Equity (3 structures)

**BR-1: The Belief Film**
- Funnel: Cold | Length: 60-120s
- Flow: Opening visual (athlete in action, no product) → The truth (belief statement) → The audience named ("the ones who don't settle") → The tension → The conviction (what ONEST believes) → The product reveal (conclusion of the argument) → Sign-off: MADE OF GREATNESS
- Why it converts: Asks for belief, not a sale
- Psychological lever: Identity alignment — viewer sees themselves in the belief before seeing the product

**BR-2: The Community Proof**
- Funnel: Warm | Length: 45-90s
- Flow: Hook (multiple faces, a movement) → The common thread → The results (varied, specific) → The brand's role (understated) → The identity statement ("ONEST is for people who take this seriously") → CTA (light)
- Why it converts: Peter doesn't just want results — he wants to belong to the right tribe
- Psychological lever: Tribal identity — ONEST becomes the badge of belonging

**BR-3: The Values Declaration**
- Funnel: All stages | Length: 30-60s
- Flow: Hook (bold statement of what ONEST stands for) → What that means in practice (every ingredient, every dose) → What it costs (honesty about the trade-off) → Who it's for ("people who care enough to read the label") → The invitation ("If that's you — welcome.")
- Why it converts: In a category defined by noise, clarity is a differentiator
- Psychological lever: Self-selection — attracts the right customers, pre-selects out the wrong ones

---

## 3. Funnel Stage Rules

These are non-negotiable. They override everything else.

### Cold
- Product name does NOT appear in the hook — under any circumstances
- Hook leads with the problem, the enemy, or a contrarian statement
- Product introduced as the logical conclusion of the problem
- Proof section kept brief — viewer isn't invested enough for detailed evidence yet
- CTA: "link below" / "check it out" / "see for yourself" — NEVER "buy now"

### Warm
- ONEST can be named after the hook section
- Lead with what makes ONEST different — transparency, ingredient specificity, Australian-made
- Assume they've seen competitor products — differentiation is the primary job
- CTA can be more direct: "try ONEST" / "visit onest.com.au"

### Retargeting
- Can open with product name — they already know it
- Lead immediately with social proof or a specific result
- Address the most likely objection for the product
- CTA is the strongest of any stage — "try it risk-free" / "30-day guarantee" / "order now"

### Retention
- Never re-explain what the product does
- Lead with loyalty, community, or new product announcement
- Stack-sell opportunity: reference complementary products they don't own yet
- CTA is relationship-oriented, not transaction-oriented

---

## 4. Audience Archetypes

Each archetype changes the voice, references, and objection handling throughout the entire script.

### Fitness Enthusiast
- **Life context:** Trains 4-6 days a week. Tracks macros. Has tried multiple supplements. Goes to an F45 or commercial gym. Influenced by what people in their gym circle are using.
- **Language:** Comfortable with supplement terminology but still casual. Says "reps", "gains", "recovery". Australian colloquialisms where they fit naturally.
- **Main objection:** "I've already tried most things in this category. I'm cynical because I've wasted money on products that underdosed or overpromised."
- **What converts them:** A specific training metric that changed, or a specific ingredient they finally understood.

### Busy Mum
- **Life context:** Juggling kids, work, and personal goals. Fitness is important but time is the constraint. Values simplicity.
- **Language:** Warm and direct. References real moments: school drop-off, 5:30am gym before the house wakes up, 3pm energy slump. Not fitness-speak heavy — talks about how she feels.
- **Main objection:** "Is this safe? What's actually in it? I don't want to take something I can't understand."
- **What converts them:** The transparent label — seeing exactly what's in it and being able to verify it.

### Athlete
- **Life context:** Competes in something — Hyrox, CrossFit, team sports, powerlifting. Supplements are tools for performance, not lifestyle accessories.
- **Language:** Precise and performance-focused. Knows what Creapure means, knows what Dicaffeine Malate is. Respects specificity as a signal of quality.
- **Main objection:** "I can't afford to put something in my body that isn't clinically dosed. I've seen athletes take products that don't contain what the label claims."
- **What converts them:** Full ingredient transparency — every dose listed, nothing hidden in a blend.

### Biohacker
- **Life context:** Optimises everything. Tracks sleep, HRV, bloodwork. Reads PubMed. Treats their body as a system to be engineered.
- **Language:** Analytical and curious. References self-tracking: "I noticed on my Oura ring", "my recovery scores went up". Wants to understand why something works.
- **Main objection:** "Most supplements have proprietary blends so I can't verify the doses I'm actually getting."
- **What converts them:** Full label transparency combined with the specific mechanism of a key ingredient.

### Wellness Advocate
- **Life context:** Health-conscious but not gym-obsessed. Holistic view of health. May have been burned by overpromised supplements.
- **Language:** Warm, considered, slightly cautious. "I felt better in the mornings", "my skin actually changed", "I stopped feeling so flat by 2pm."
- **Main objection:** "I don't want to take something full of stimulants or artificial ingredients I don't recognise."
- **What converts them:** No artificial colours / no fillers / no proprietary blends + Australian-made GMP certification.

---

## 5. Hook Bank

Every script uses one of these five hook archetypes:

| Archetype | Example |
|---|---|
| **Contrarian** | "The reason you're not losing fat has nothing to do with your diet." |
| **Specific frustration** | "Six months in a calorie deficit and the scale hasn't moved." |
| **Social proof lead** | "47,000 Aussies have switched to this in the last 12 months." |
| **Named enemy** | "Most fat burners don't tell you what's actually in them. Here's why." |
| **Bold claim + number** | "250mg of two forms of caffeine. Here's what that actually does to your metabolism." |

---

## 6. CTA Bank

CTAs are matched to funnel stage:

| Stage | CTA Approach |
|---|---|
| **Cold** | "See the full ingredient breakdown — link below" |
| **Warm** | "Try it and judge for yourself — link below" |
| **Retargeting** | "30-day guarantee — order now at onest.com.au" |

---

## 7. Transition Logic

The viewer should never feel the structure change. Each transition should feel like the most natural next sentence, not the next section of a brief.

| Transition | Wrong Version | Correct Version |
|---|---|---|
| Problem → Solution | "That's why we created HyperBurn." | "The only way to fix a dormant metabolism is to give it a reason to fire back up." |
| Story → Product | "Anyway, I started using HyperBurn and..." | "The thing that actually changed it was understanding what my body was missing — specifically one thing." |
| Education → CTA | "So if you want to try it, click the link." | "That's literally everything that's in it — no blends, no fillers. If you want to read the full breakdown yourself, it's all on the site." |
| Proof → CTA | "Don't miss out — buy now." | "There's a 30-day guarantee, so there's actually no reason not to try it." |

---

## 8. Script Audit Checklist

Every completed script is checked against these 10 criteria:

1. **Awareness match** — Does the script assume the right level of audience knowledge for the funnel stage?
2. **Hook independence** — Does the hook work as a complete idea in under 3 seconds with no context?
3. **Banned phrases** — Zero instances of "unlock your potential", "fuel your journey", "transform your body", "achieve your goals"
4. **Specificity test** — At least one named ingredient, specific number, or concrete timeframe
5. **One job** — Single primary message, obvious in one sentence
6. **Transition logic** — All major transitions feel inevitable rather than engineered
7. **Single CTA** — One and only one action asked for at the end
8. **Brand voice** — Could this script appear on a competitor's product without modification? If yes — rewrite
9. **Emotional logic** — Script takes the viewer from one clear emotional state to a different one logically
10. **Peter / Lara test** — Read it aloud imagining you are Peter or Lara hearing it for the first time

---

## 9. Compliance Rules

These are mandatory. Any violation scores the script 0 regardless of quality.

**Can say:** "supports," "helps," "promotes," "contributes to," "designed to," "formulated with"

**Cannot say:** "cures," "treats," "prevents," "guarantees," "clinically proven to [specific outcome]," "doctor recommended"

**Cannot say:** specific weight loss amounts, medical claims, comparison to prescription drugs

| Safe | Not Safe |
|---|---|
| "supports healthy metabolism" | "burns fat guaranteed" |
| "helps maintain energy levels" | "gives you unlimited energy" |
| "supports restful sleep" | "cures insomnia" |

---

## 10. Expert Review Panel

After generation, every script goes through a simulated expert review panel. 10 advertising experts score on 6 criteria:

1. **Engagement Framework** — Does it follow the approved structure?
2. **Product Selling** — Does it effectively sell the ONEST product? Are specific benefits and named ingredients mentioned?
3. **CTA Strength** — DR: clear and direct? UGC: genuine recommendation?
4. **Format Authenticity** — DR: feels like polished direct response? UGC: feels like a real person?
5. **Persuasion Architecture** — Does each segment increase purchase intent before the next begins?
6. **Conversion Potential** — Would this script drive purchases?

### Score floor rules:
- Script fails to mention product by name → score MUST be below 70
- No clear CTA → score MUST be below 75
- Could belong to any generic supplement brand → score MUST be below 80
- Product introduced before problem is established (cold/warm) → score MUST be below 80
- Contains banned phrases → score MUST be below 75

### Revision process:
- Score 90+ → Approved
- Score below 90 → AI revises based on the 3 lowest-scoring criteria, resubmits
- After 3 failed rounds → structural rewrite (new hook, new narrative arc, new proof sequencing)
- Maximum 5 rounds

---

## 11. Product Intelligence

Each ONEST product has specific selling rules built into the system. Here's what the AI knows about each product:

### Hyperburn
- **Category:** Thermogenic Fat Burner
- **Differentiator:** Two forms of caffeine for sustained energy — most fat burners spike and crash
- **Key ingredients:** Caffeine Anhydrous, Infinergy (DiCaffeine Malate), CaloriBurn GP, CapsiMax, BioPerine
- **Copy levers:** Two forms of caffeine (no crash), CaloriBurn GP (activates brown adipose tissue), transparent label, Australian-made, dual-action (burns fat AND provides energy)
- **Copy traps:** Never say "melts fat" or "burns fat fast". Never promise specific weight loss amounts.

### Thermosleep
- **Category:** Night-Time Fat Burner & Sleep Aid
- **Differentiator:** Only product combining clinical sleep ingredients with thermogenic compounds — no stimulants
- **Key ingredients:** Ashwagandha KSM-66, L-Theanine, Grains of Paradise, Zinc, Magnesium
- **Copy levers:** Dual benefit (fat metabolism while you sleep), no stimulants, pairs with HyperBurn for 24hr support
- **Copy traps:** Never say "lose weight while you sleep" as a guarantee. Don't position as a sleeping pill.

### Protein + Collagen
- **Category:** Protein Powder with Collagen
- **Differentiator:** Only protein powder with clinically dosed hydrolysed collagen — replaces two supplements
- **Key ingredients:** Whey Protein Isolate, Hydrolysed Collagen Peptides, Digestive Enzymes
- **Copy levers:** Beauty meets performance, one scoop replaces protein shake AND collagen supplement, tastes incredible
- **Copy traps:** Don't position as just a protein powder. Avoid "anti-aging" claims.

### Hyperload
- **Category:** Pre-Workout
- **Differentiator:** Full label transparency with clinical doses — most pre-workouts hide behind proprietary blends
- **Key ingredients:** L-Citrulline, Beta-Alanine, Betaine Anhydrous, Caffeine, Alpha-GPC
- **Copy levers:** Transparent label, clinical doses, smooth energy, nootropic blend for focus
- **Copy traps:** Don't just say "best pre-workout". Avoid "insane energy" or "crazy pumps".

### Creatine
- **Category:** Creatine Monohydrate
- **Differentiator:** Creapure (Germany) — most brands use cheap Chinese creatine
- **Key ingredients:** Creapure Creatine Monohydrate
- **Copy levers:** World's purest creatine, 500+ peer-reviewed studies, not just for bodybuilders (brain, energy, aging)
- **Copy traps:** Don't say "bulking". Avoid "loading phase required".

### Thermoburn
- **Category:** Capsule Thermogenic
- **Differentiator:** Multi-pathway thermogenic in capsule format — not just caffeine pills
- **Key ingredients:** Two forms of caffeine, Green Tea Extract, Bitter Orange Extract, Grains of Paradise, Lion's Mane
- **Copy levers:** Sustained energy, mood support, capsule convenience
- **Copy traps:** Don't position capsules as weaker than powder.

### Carb Control
- **Category:** Carb & Blood Sugar Support
- **Differentiator:** Targeted carb management with transparent clinical dosing
- **Key ingredients:** White Kidney Bean Extract, Chromium, Gymnema Sylvestre
- **Copy levers:** Supports healthy blood sugar response, take before meals
- **Copy traps:** Never say "blocks all carbs". Don't position as license to eat unlimited carbs.

### HyperPump
- **Category:** Stimulant-Free Pre-Workout / Pump Formula
- **Differentiator:** Dedicated pump formula with clinical doses — not a watered-down stim-free pre-workout
- **Key ingredients:** L-Citrulline, Nitrosigine, GlycerPump, S7
- **Copy levers:** Massive pumps without stimulants, stack with HyperLoad
- **Copy traps:** Don't say "stimulant-free" as if it's lesser. Avoid "skin-splitting pumps".

### AminoLoad
- **Category:** EAA / BCAA Recovery
- **Differentiator:** Full EAA spectrum, not just BCAAs — plus hydration
- **Key ingredients:** Full Spectrum EAAs, Coconut Water Powder, Electrolytes
- **Copy levers:** All 9 essential amino acids, great taste, replaces sugary sports drinks
- **Copy traps:** Don't just say "BCAAs" — EAAs are the upgrade.

### Marine Collagen
- **Category:** Beauty & Joint Supplement
- **Differentiator:** Marine-sourced for better bioavailability — sustainably sourced
- **Key ingredients:** Hydrolysed Marine Collagen Peptides, Vitamin C
- **Copy levers:** Superior absorption, Type I and III collagen, unflavoured
- **Copy traps:** Don't make anti-aging claims.

### SuperGreens
- **Category:** Greens Powder
- **Differentiator:** 75+ ingredients with transparent dosing AND great taste
- **Key ingredients:** Organic Greens Blend, Probiotics, Digestive Enzymes, Mushroom Complex
- **Copy levers:** 75+ superfoods, actually tastes good, replaces handfuls of supplements
- **Copy traps:** Don't say "replaces fruits and vegetables". Avoid "detox" or "cleanse".

### Whey ISO Pro
- **Category:** Whey Protein Isolate
- **Differentiator:** 100% isolate with full transparency — no concentrate blends hiding behind "protein blend" labels
- **Key ingredients:** 100% Whey Protein Isolate, Digestive Enzymes
- **Copy levers:** Fast absorbing, low lactose, no amino spiking, amazing taste
- **Copy traps:** Don't compete on protein per serve — compete on quality and transparency.

---

## 12. Emotion-to-Structure Map

When the system needs to choose a structure based on the viewer's emotional state:

| Emotional State | Recommended Structures |
|---|---|
| **Frustrated** | DR-1 (PAS), UGC-2 (Objection Crusher), FL-2 (Industry Call-Out) |
| **Aspirational** | DR-2 (BAB), UGC-3 (Day in the Life), BR-1 (Belief Film) |
| **Sceptical** | DR-3 (Mechanism-Proof), DR-4 (Enemy Framing), UGC-4 (Myth Bust), FL-1 (Origin Story) |
| **Curious** | DR-5 (Contrarian), DR-7 (Story-Lesson), UGC-1 (Talking Head) |
| **Ready but hesitant** | DR-6 (Social Proof Lead), UGC-5 (Results Reveal), FL-3 (Standard-Setter) |

---

## 13. Review Findings — Gaps to Address

**Reviewed by: Claude + Codex (dual independent AI review, March 2026)**

These are gaps identified in the current framework. Each one will flow through to better scripts once implemented.

### CRITICAL

**Gap 1: Retention is a dead zone**
- The system defines retention as a funnel stage with rules, but only 1 of 19 structures (BR-3) supports it.
- No retention CTA in the CTA bank. No stack-sell structure. No loyalty UGC. No reorder/replenishment framework.
- For a brand at $8-15M revenue, retention is where LTV compounds. This is the biggest gap.
- **Action needed:** Add 3+ retention structures (Stack-Sell DR, Loyalty UGC, New Product Founder-Led) + retention CTA bank entry.

**Gap 2: Review panel is burning tokens without proportional value**
- The system simulates 10 named experts in a single Claude call (not 10 independent evaluations). Scores are correlated, not independent.
- Score floor rules (product name must appear, banned phrases, etc.) are in the prompt but NOT enforced in code. A script that never mentions the product can score 92 and be approved.
- 5 revision rounds x 4 scripts = up to 40 Claude API calls in one pipeline run.
- **Action needed:** Add programmatic pre-checks (product name, banned phrases, CTA presence). Reduce to criterion-level scoring with 2 rounds max. Ship to market faster.

### HIGH

**Gap 3: Archetypes miss the growth audience**
- All 5 current archetypes skew toward people who already exercise and care about supplements.
- Missing: **Healthy Ager (50+)** for creatine, marine collagen, supergreens. **Weight Loss Beginner** (male, 35-50, not a gym person). **Wellness Switcher** (currently uses AG1/Bloom, wants something Australian/transparent).
- "Peter" and "Lara" are referenced 8+ times in the structures but never defined as archetypes.
- **Action needed:** Add 3 new archetypes. Define Peter and Lara explicitly.

**Gap 4: No offer strategy integration**
- CTAs are generic ("link below", "30-day guarantee") but real DTC ads pair the script with a specific offer.
- Missing: bundle framing, subscribe-and-save, price anchoring, trial/entry offers, bonus stacking, limited-time incentives.
- Every warm/retargeting/retention concept should specify an offer type.
- **Action needed:** Add offer strategy as a pipeline input. Add to review criteria.

**Gap 5: Education, Lifestyle, and Demo styles lack sub-structure depth**
- DR has 7 sub-structures. UGC has 6. Founder has 3. Brand has 3.
- Education, Lifestyle, and Demo have ZERO sub-structures. They rely on simpler inline prompts.
- This creates two tiers of creative quality.
- **Action needed:** Add 2-3 sub-structures each for Education, Lifestyle, and Demo.

### MEDIUM

**Gap 6: No platform-specific adaptation**
- Sub-structures reference platforms (TikTok, Meta, YouTube) but the script generation ignores this.
- TikTok hooks need 1-1.5 seconds, not 3. Instagram has different CTA mechanics. YouTube pre-roll needs skip-prevention.
- **Action needed:** Add platform as a pipeline input. Adjust hook timing and CTA mechanics per platform.

**Gap 7: No creative fatigue protection**
- The system can generate the same combination (product + structure + archetype + funnel + hook) repeatedly without knowing it already generated 15 scripts with that exact combination.
- Creative fatigue is the single biggest performance killer in paid social.
- **Action needed:** Track combination fingerprints. Flag overused combinations. Force diversification.

**Gap 8: HyperBurn Caffeine Free missing from product intelligence**
- Has a fallback brief in the code but no full product intelligence entry (copy levers, copy traps, key ingredients, differentiator).
- **Action needed:** Add full PRODUCT_INTELLIGENCE entry.

---

## What to Change

If anything in this document needs updating — structures, rules, archetypes, product copy levers, compliance language, hook archetypes — the changes will flow through to every script the system generates.

The source of truth for all of this lives in `server/services/videoPipeline.ts`. Any changes Lachlan marks up on this document, we'll update in the code.
