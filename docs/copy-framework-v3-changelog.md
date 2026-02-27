# ONEST Creative Pipeline — Copy Framework v3.0 Changelog

**Author:** Manus AI  
**Date:** 27 February 2026  
**Version:** 3.0  

---

## Executive Summary

Copy Framework v3.0 represents a comprehensive overhaul of the ONEST Creative Pipeline's video script generation engine. The update replaces the previous prompt-based system with a structured, data-driven framework built around 19 script sub-structures, funnel-stage-aware generation rules, UGC actor archetype voice profiles, and a 6-criteria expert review system with up to 5 rounds of iteration. The goal is to produce scripts that are structurally sound, emotionally resonant, compliance-safe, and optimised for conversion at every stage of the customer journey.

---

## What Changed

### 1. Script Sub-Structures (19 Total)

The previous system generated scripts based on high-level style labels (DR, UGC, etc.) with free-form prompts. v3.0 introduces **19 named sub-structures**, each with defined stages, psychological levers, funnel stage eligibility, and platform recommendations. The AI is now assigned a specific sub-structure before writing, ensuring structural consistency and strategic intent.

| Category | Count | Sub-Structure IDs | Examples |
|---|---|---|---|
| Direct Response (DR) | 7 | DR-1 to DR-7 | PAS, Before/After Bridge, Myth Buster, Social Proof Stack, Ingredient Spotlight, Objection Crusher, Urgency Engine |
| UGC / Testimonial | 6 | UGC-1 to UGC-6 | Morning Routine, Sceptic Convert, Day-in-the-Life, Side-by-Side Compare, Unboxing First Impressions, Challenge/Transformation |
| Founder-Led | 3 | FL-1 to FL-3 | Origin Story, Behind the Formula, Founder Challenge |
| Brand / Equity | 3 | BR-1 to BR-3 | Belief Film, Community Proof Montage, Values Declaration |

Each sub-structure includes:
- Named stages with defined functions (e.g., "Disruption Hook → Agitate → Mechanism → Proof → CTA")
- Psychological lever (e.g., Loss Aversion, Identity Shift, Authority Bias)
- Platform recommendation (e.g., "Meta primary, TikTok")
- Recommended length range
- "Why it converts" rationale

### 2. Funnel Stage Awareness

Every pipeline run now requires a **funnel stage** selection. The system enforces non-negotiable rules per stage that constrain the AI's creative choices:

| Funnel Stage | Key Rules |
|---|---|
| **Cold** | Must lead with problem/emotion, not product. No brand name in first 3 seconds. Hook must work for someone who has never heard of ONEST. |
| **Warm** | Can reference brand familiarity. Lead with social proof or deeper mechanism. Assume the viewer has seen one ad before. |
| **Retargeting** | Acknowledge prior interest. Use urgency, scarcity, or objection handling. Can reference specific product by name immediately. |
| **Retention** | Speak to existing customers. Focus on stacking, new use cases, or loyalty rewards. Assume product experience. |

Sub-structures are filtered by funnel stage eligibility before assignment.

### 3. UGC Actor Archetype Voice Profiles

When generating UGC scripts, the system now supports **5 actor archetypes**, each with a distinct voice profile:

| Archetype | Life Context | Language Register |
|---|---|---|
| **Fitness Enthusiast** | Gym 5–6x/week, tracks macros, follows fitness influencers | High-energy, uses gym slang ("gains", "shredded", "stack") |
| **Busy Mum** | Juggling kids, work, and personal goals; time is the constraint | Warm and direct; references school drop-off, 5:30am gym, 3pm energy slump |
| **Athlete** | Competes or trains seriously; recovery and performance are non-negotiable | Performance-focused, references training blocks, competition prep |
| **Biohacker** | Optimises everything; tracks sleep, HRV, bloodwork; reads PubMed | Analytical and curious; references Oura ring, recovery scores, self-tracking |
| **Wellness Advocate** | Holistic approach; values clean ingredients and sustainability | Gentle, mindful language; references "nourishing", "clean", "intentional" |

Each archetype includes a `preProductObjection` — the specific doubt the character had before trying ONEST — which the AI weaves into the script's narrative arc.

### 4. Brand Scripts (New Style Category)

v3.0 adds **Brand / Equity** as a 7th script style, with 3 sub-structures:

- **BR-1: Belief Film** — Asks for belief, not a sale. Positions ONEST as a movement.
- **BR-2: Community Proof Montage** — Multiple real customers, rapid-fire social proof.
- **BR-3: Values Declaration** — Brand manifesto format. Transparency, quality, Australian-made.

Brand scripts are eligible for all funnel stages and serve as top-of-funnel awareness content.

### 5. Transition Lines

Every timestamp segment in the script table now requires a `transitionLine` field — a brief direction for how the scene transitions to the next (e.g., "SMASH CUT to product close-up", "Camera follows subject as they walk to kitchen"). This ensures the script reads as a cohesive visual narrative, not a collection of disconnected shots.

### 6. Expert Review System (6 Criteria, 5 Rounds)

The previous system used 10 named copywriting experts with subjective feedback. v3.0 replaces this with a **6-criteria scoring system** where each criterion is scored 1–10:

| Criterion | What It Measures |
|---|---|
| **Hook Strength** | Does the first 3 seconds stop the scroll? Pattern interrupt quality. |
| **Emotional Arc** | Does the script build tension, create desire, and resolve with the product? |
| **CTA Clarity** | Is the call-to-action specific, urgent, and friction-free? |
| **Compliance Adherence** | Does the script avoid TGA/FSANZ prohibited claims? |
| **Structure Adherence** | Does the script follow the assigned sub-structure's stages? |
| **Brand Voice** | Does the script sound like ONEST — confident, transparent, Australian? |

**Score floor rules:**
- Compliance Adherence < 8 → entire script fails regardless of other scores
- Hook Strength < 6 → script is flagged for rewrite (won't stop the scroll)
- Any criterion < 5 → triggers structural rewrite

**Iteration logic:**
- Rounds 1–3: Targeted feedback on lowest-scoring criteria
- Round 4: Full structural rewrite if score hasn't reached 80+
- Round 5: Final pass — accept or reject

The 10 named experts (Schwartz, Halbert, Cialdini, etc.) are still present as the review panel's "lens" — they inform the qualitative feedback that accompanies each score.

### 7. Product Intelligence & Compliance

Product intelligence entries now include `primaryBenefit`, `differentiator`, `keyIngredients`, `copyLevers`, `copyTraps`, `stackPartners`, `targetPersona`, and `awarenessAngle` for every ONEST product. The compliance guardrails are embedded directly in the review prompt:

> **CAN SAY:** "supports," "helps," "promotes," "contributes to," "designed to," "formulated with"  
> **CANNOT SAY:** "cures," "treats," "prevents," "guarantees," "clinically proven to [specific outcome]," "doctor recommended"

Any script with compliance violations scores 0 regardless of other qualities.

### 8. Emotion-to-Structure Mapping

The system includes an `EMOTION_STRUCTURE_MAP` that maps emotional categories (frustration, aspiration, curiosity, fear, social proof, identity) to the most effective sub-structures. This allows the brief generation stage to recommend sub-structures based on the emotional tone detected in the competitor ad analysis.

---

## Frontend Changes

### BrowseCreatives Page
- **Funnel Stage Selector:** Colour-coded buttons (Cold = blue, Warm = amber, Retargeting = purple, Retention = green) with descriptive tooltips
- **Actor Archetype Picker:** Conditionally shown when UGC scripts are selected. Supports multi-select with an "AI Recommends" default option
- **Brand Style:** Added as 7th option in the script style picker
- **Cost Estimate:** Updated to reflect v3.0's 5-round review token usage

### Results Page
- **Transition Lines:** Displayed as italic connector rows between script table segments
- **Sub-Structure Label:** Shown in script metadata (e.g., "DR-3: Myth Buster")
- **Funnel Stage Badge:** Colour-coded tag in metadata
- **6-Criteria Breakdown:** Visual progress bars for each criterion with colour coding (green ≥ 8, amber 6–7, red < 6)
- **Score Floor Warnings:** Red alert badges when compliance < 8 or hook < 6

---

## Technical Details

| Metric | v2.0 | v3.0 |
|---|---|---|
| videoPipeline.ts lines | ~800 | 2,114 |
| Script styles | 6 | 7 (+ Brand) |
| Sub-structures | 0 | 19 |
| Review criteria | 10 experts (subjective) | 6 scored criteria |
| Max review rounds | 3 | 5 |
| Funnel stages | None | 4 |
| Actor archetypes | None | 5 |
| Test count | ~100 | 114 |

---

## Database Changes

- Added `videoFunnelStage` column to `pipeline_runs` table (enum: cold, warm, retargeting, retention; default: cold)

---

## Files Modified

| File | Change |
|---|---|
| `server/services/videoPipeline.ts` | Complete rewrite — 19 sub-structures, funnel rules, archetypes, 6-criteria review, staged pipeline functions |
| `server/routers.ts` | Added `funnelStage` and `actorArchetype` input params to `triggerVideo` route |
| `client/src/pages/BrowseCreatives.tsx` | Funnel stage selector, archetype picker, Brand style option |
| `client/src/pages/Results.tsx` | Transition lines, sub-structure labels, 6-criteria breakdown bars, score floor warnings |
| `server/video-pipeline-v3.test.ts` | New test file — 37 tests covering all v3.0 data structures |
| `server/videoPipeline.test.ts` | Updated existing tests for v3.0 compatibility |
| `drizzle/schema.ts` | Added `videoFunnelStage` enum column |
