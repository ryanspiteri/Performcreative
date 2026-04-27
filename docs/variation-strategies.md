# Variation Strategies — Reference

How the `/iterate` page's three pickers (Variation Strategy, Ad Angle, Style Fidelity) actually shape the output, plus the override matrix between them.

When you want to know *what `props_only` actually locks*, *why an output ignored your brief*, or *which Gemini direction a Lifestyle angle produces* — this is the page.

This doc reflects the live state of the pipeline as of PR #24.

---

## Quick reference

### Variation Types — what each one varies vs locks

| Type | Varies | Locks |
|------|--------|-------|
| `headline_only` | headline text | bg, layout, product placement, props, typography, subhead, benefits |
| `background_only` | bg colour/style | headline, layout, product placement, props, typography, all copy |
| `layout_only` | product placement + text positioning | headline, bg, props, typography, all copy |
| `benefit_callouts_only` | subhead + benefit copy | main headline, bg, layout, product placement, props |
| `props_only` | visual metaphors + supporting elements | headline, bg, layout, product placement, all copy |
| `talent_swap` | person/model | headline, bg, layout, product placement, props, all copy |
| `full_remix` | everything | only product identity + core value proposition |

### Ad Angles — the psychological hook

| Angle | Hook | Visual signature |
|-------|------|------------------|
| `auto` | (Claude diversifies per variation) | — |
| `claim_led` | bold benefit promise | headline as visual hero, big high-contrast text dominating frame |
| `before_after` | transformation framing | split-screen / paired imagery, palette shift across two states |
| `testimonial` | first-person social proof | real-feeling person, casual/candid framing, quote-style headline |
| `ugc_organic` | unpolished real-user feel | phone-camera aesthetic, natural lighting, NOT studio |
| `product_hero` | product is the star | clean premium composition, minimal copy, studio lighting |
| `lifestyle` | scene with a person | real environment, natural body language, product in context |

### Style Modes — how tightly to hug the reference ad

| Mode | Stance | What Gemini is told |
|------|--------|---------------------|
| `MATCH_REFERENCE` | Lock | "Treat Image 1's composition, palette, lighting, texture, typographic style as LOCKED. Reproduce them faithfully while substituting the copy and using the product render from Image 2." |
| `EVOLVE_REFERENCE` (default) | Same family | "Replicate Image 1's overall layout, palette, lighting, product placement, background style, typography, aesthetic. Vary only what the variation brief calls for." Plus a clarifier: where the variation brief explicitly differs, the brief wins. |
| `DEPART_FROM_REFERENCE` | Reinvent | "Use Image 1 as a quality benchmark only. You may reinvent composition, lighting, palette, and props. Still use the product render from Image 2." |

---

## Variation Types — full Stage 2 rules

What Claude is told when generating each variation in the brief. Mirrors the `typeConstraints` map.

### `headline_only`
Only vary the headline text. Keep EXACTLY the same:
- Background style, colours, and gradients
- Layout and composition
- Product placement and size
- Props and visual metaphors
- Typography style (only text changes)
- Subheadline and benefit callouts

### `background_only`
Only vary background colours/styles. Keep EXACTLY the same:
- Headline text (word-for-word)
- Layout and composition
- Product placement and size
- Props and visual metaphors
- Typography style
- All copy (headline, subheadline, benefits)

Test different: solid colours, gradients, colour schemes (warm/cool/high-contrast).

### `layout_only`
Only vary product placement and text positioning. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Props and visual metaphors
- Typography style
- All copy

Test different: centered, asymmetric, split-screen, diagonal, grid compositions.

### `benefit_callouts_only`
Only vary subheadline and benefit copy. Keep EXACTLY the same:
- Main headline (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- Props and visual metaphors

Test different: benefit angles (speed, results, ingredients, science, guarantees).

### `props_only`
Only vary visual metaphors and supporting elements. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- All copy

Test different: visual metaphors (fire, lightning, transformation, science, speed).

### `talent_swap`
Only vary the person/model. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- Props and visual metaphors
- All copy

Test different: age groups, genders, ethnicities, body types.

### `full_remix`
Change everything — headline, background, layout, props, benefits.
Maximum creative freedom. Only maintain product identity and core value proposition.

---

## Ad Angles — full Stage 3 direction

Per-variation visual direction injected into the Gemini prompt. Mirrors `adAngleBlock`.

### `auto`
The Stage 2 brief generator picks a *different* `adAngle` per variation from the six concrete angles below, so a 5-variation run gets diverse psychological framing. The Stage 3 prompt then emits the per-variation angle's direction. No block is appended at runtime — the variation's resolved `adAngle` field carries the actual angle.

### `claim_led`
Lead with a bold benefit promise. The headline is the visual hero, not the product. Big, high-contrast headline text dominating the upper portion of the frame. The product is supporting, not the centrepiece. Composition emphasizes confidence and authority.

### `before_after`
Use transformation framing. Split-screen, paired imagery, time-lapse cues, or a clear visual contrast between two states. The output should read as "this state → this better state". Lighting and palette can shift across the two halves to reinforce the transformation. Product anchors the "after" side.

### `testimonial`
Frame as first-person social proof. Real-feeling person on camera (not a model pose). Quote-style or first-person headline ("I lost...", "After 30 days..."). Casual, candid composition — the kind of frame you'd see in a friend's selfie or a video review. Product visible but not posed.

### `ugc_organic`
Unpolished, real-user feel. Phone-camera aesthetic — slight lens distortion, natural lighting, candid framing. NOT studio. NOT polished ad. The output should look like organic social content a real customer posted. Product placed naturally in a real environment (kitchen counter, gym bag, bathroom shelf).

### `product_hero`
Product is the star. Clean, premium composition with the product centred or prominently positioned. Minimal supporting copy. Studio-quality lighting on the product. Background is restrained and atmospheric so the product reads cleanly.

### `lifestyle`
Scene/setting with a person using the product naturally. The story is "this person, this moment, this product". Real environment (home, gym, outdoors). The product is part of a life, not posed in isolation. Natural body language and interaction with the product.

---

## Style Modes — full Stage 3 fidelity language

Mirrors `styleModeBlock`.

### `MATCH_REFERENCE`
> Treat Image 1's composition, colour palette, lighting, texture, and typographic style as LOCKED. Reproduce them as faithfully as you can while substituting the copy below and using the product render from Image 2. Do not introduce props, colours, or compositions that aren't present in Image 1.

Use when: you've found a reference ad that converts and you want to test only copy changes against an otherwise identical creative.

### `EVOLVE_REFERENCE` (default)
> Study Image 1 carefully and replicate its overall layout, text placement, colour palette, lighting, product placement, background style, typography hierarchy, and aesthetic. Vary only what the variation brief calls for. Someone should look at your output beside Image 1 and say "same campaign, different headline".
>
> Where the VISUAL DESCRIPTION FOR THIS VARIATION (below) explicitly describes a different background colour, layout, composition, or palette from Image 1, the variation description WINS. The style mode sets the aesthetic family; the variation description sets the specific composition for this one variation.

Use when: you want family resemblance to the reference but real per-variation differences. The default for most runs.

### `DEPART_FROM_REFERENCE`
> Use Image 1 as a quality benchmark only — for production polish and aesthetic family. You may reinvent composition, lighting, palette, and props. Still use the product render from Image 2. Still produce a coherent supplement ad that feels premium.

Use when: the reference is a quality bar, not a template. You want fresh ideas at the same production level.

---

## Override matrix

How the three layers combine. Mirrors `effectiveStyleMode()` logic.

| Variation type | Run styleMode | Run adAngle | Effective styleMode | Effective adAngle |
|----------------|---------------|-------------|---------------------|-------------------|
| `full_remix` | (any) | `auto` | **DEPART_FROM_REFERENCE** (always) | Claude diversifies per variation |
| `full_remix` | (any) | locked (e.g. `claim_led`) | **DEPART_FROM_REFERENCE** (always) | locked value applied to all |
| `background_only` or `layout_only` | `MATCH_REFERENCE` | `auto` or locked | **EVOLVE_REFERENCE** (loosened) | as set on run |
| `background_only` or `layout_only` | `EVOLVE` or `DEPART` | (any) | as set on run | as set on run |
| All other types (`headline_only`, `benefit_callouts_only`, `props_only`, `talent_swap`) | (any) | (any) | as set on run | as set on run |

**Why these three overrides exist:**
1. `full_remix` is meant to test "change everything." A tighter style mode forces it to match the reference, which makes the remix structurally impossible.
2. `background_only` / `layout_only` briefs explicitly differ from the reference on the dimension being varied. MATCH would say "replicate the reference's bg/layout" — direct contradiction with the variation's intent.
3. `auto` adAngle diversifies for free. Locked angles let you stress-test a single hook.

---

## Always-on: Variation Uniqueness

Every variation, regardless of type/angle/mode, gets this block appended to its Stage 3 prompt:

> === VARIATION N UNIQUENESS ===
>
> This is variation #N of M. Make this visually distinct from other variations by using unique:
> - Color combinations and lighting angles
> - Composition and framing choices
> - Background element arrangements
> - Visual effects and atmospheric details
>
> Do NOT create identical or near-identical outputs. Each variation must be recognizably different while maintaining the reference style.

The point: even when MATCH_REFERENCE forces tight reference fidelity, the variations within a single run still differ from each other.

---

## Always-on: Anti-bleed product preservation

Every variation also gets product-preservation instructions injected before the style mode. For Hyperburn (and any product in `PRODUCT_LABEL_SPECS`), this enumerates the label elements explicitly: matte black tub, orange swoosh, "HYPERBURN" wordmark, "ELITE THERMOGENIC" subtext, flavour strip, Onest logo. Plus two anti-bleed clauses:

1. *Flavour names are not colour instructions.* "PINK LEMONADE" describes taste only — the tub body is matte black with an orange swoosh regardless of flavour.
2. *Image 1's product is invisible.* Don't take product-design cues from the reference ad's product. Image 2 is the only product reference that matters.

For stylised scenes (animated / illustrated / Pixar-style), an additional carve-out fires: scene is stylised, but the product remains photorealistic.

**Caveat:** these are *prompt instructions*, not deterministic guarantees. Gemini paints the tub fresh each variation and can still hallucinate label text or invent a different design. The proper fix for that is two-pass compositing (currently blocked on transparent product render PNGs being available in `/product-info`).

---

## Code pointers

When updating these rules, edit the source — and update this doc in the same PR.

| Rule | File | Symbol / region |
|------|------|-----------------|
| Variation type list | [shared/iterationBriefSchema.ts](../shared/iterationBriefSchema.ts) | `VARIATION_TYPES` const array |
| Ad angle list | [shared/iterationBriefSchema.ts](../shared/iterationBriefSchema.ts) | `AD_ANGLES` const array |
| Style mode list | [shared/iterationBriefSchema.ts](../shared/iterationBriefSchema.ts) | `STYLE_MODES` const array |
| Variation type Stage 2 constraints | [server/services/iterationPipeline.ts](../server/services/iterationPipeline.ts) | `typeConstraints` map inside `generateIterationBrief` (~ lines 960-1013) |
| Stage 2 system prompt incl. adAngle diversify/lock logic | [server/services/iterationPipeline.ts](../server/services/iterationPipeline.ts) | `generateIterationBrief` system block (~ lines 905-955) |
| Stage 2 competitor brief system prompt | [server/services/iterationPipeline.ts](../server/services/iterationPipeline.ts) | `generateCompetitorIterationBrief` system block |
| Style mode override matrix | [server/services/geminiPromptBuilder.ts](../server/services/geminiPromptBuilder.ts) | `effectiveStyleMode()` |
| Style mode prompt language | [server/services/geminiPromptBuilder.ts](../server/services/geminiPromptBuilder.ts) | `styleModeBlock()` |
| Per-angle visual direction | [server/services/geminiPromptBuilder.ts](../server/services/geminiPromptBuilder.ts) | `adAngleBlock()` |
| Product label spec (incl. anti-bleed) | [server/services/geminiPromptBuilder.ts](../server/services/geminiPromptBuilder.ts) | `PRODUCT_LABEL_SPECS` + `productPreservationBlock()` |
| Stylised scene carve-out | [server/services/geminiPromptBuilder.ts](../server/services/geminiPromptBuilder.ts) | `STYLISED_SCENE_KEYWORDS` + `stylisedSceneCarveoutBlock()` |
| Variation uniqueness block | [server/services/iterationPipeline.ts](../server/services/iterationPipeline.ts) | inline at the variation generation loop (~ line 412) |

---

## History

- **PR #17** — enumerated label spec map + stylised-scene carve-out injection.
- **PR #20** — anti-bleed clauses (flavour-as-colour, Image 1 product invisibility) added to product preservation block + brief generator system prompts.
- **PR #22** — `effectiveStyleMode()` introduced. `full_remix` overrides any styleMode → DEPART. `background_only` / `layout_only` with MATCH → loosened to EVOLVE. EVOLVE block gained the "variation description wins where it conflicts" clarifier.
- **PR #24** — `adAngle` wired through Stage 2 + Stage 3 (it was vestigial before this — picker existed but value was never read). `auto` = Claude diversifies; locked = single angle for all variations. Per-angle direction block added to runtime prompt.
