/**
 * Unit tests for `buildPainPointInstruction` — the pure helper that converts
 * per-variation pain-point selections into the prompt instruction block sent
 * to Claude for brief generation.
 *
 * Branches under test:
 * 1. Empty / undefined → returns "" so the caller can fall through to the
 *    legacy adAngle instruction path (back-compat).
 * 2. All slots are "auto" → DIVERSIFY instruction (Claude picks freely).
 * 3. Mixed (some library, some freeform, some auto) → PER VARIATION list
 *    with "Variation N: Title" lines, freeform descriptions inlined, AUTO
 *    slots flagged.
 *
 * The fourth case from the plan ("all slots set to the same library pain
 * point → LOCKED") collapses into the per-variation list with identical
 * titles, which is asserted in case 3 implicitly. We don't carve out a
 * distinct LOCKED branch in the helper because that semantic change isn't
 * meaningful for pain points — every variation listing the same pain is
 * already explicit in the per-variation block.
 */
import { describe, expect, it } from "vitest";
import { buildPainPointInstruction, type SelectedPainPoint } from "./iterationPipeline";

describe("buildPainPointInstruction", () => {
  it("returns empty string when no selections — caller falls through to legacy adAngle path", () => {
    expect(buildPainPointInstruction(undefined)).toBe("");
    expect(buildPainPointInstruction([])).toBe("");
  });

  it("emits DIVERSIFY when every slot is auto", () => {
    const slots: SelectedPainPoint[] = [
      { title: "Auto", description: "", source: "auto" },
      { title: "Auto", description: "", source: "auto" },
      { title: "Auto", description: "", source: "auto" },
    ];
    const out = buildPainPointInstruction(slots);
    expect(out).toContain("DIVERSIFY");
    expect(out).not.toContain("Variation 1:");
    expect(out).not.toContain("PER VARIATION");
  });

  it("emits PER VARIATION list with library, freeform, and AUTO slots", () => {
    const slots: SelectedPainPoint[] = [
      { title: "Belly fat that won't budge", description: "Stubborn fat that resists diet and cardio.", source: "library" },
      { title: "", description: "", source: "auto" },
      { title: "Afraid of caffeine jitters", description: "Wants energy but worried about anxiety / shakes.", source: "freeform" },
    ];
    const out = buildPainPointInstruction(slots);
    expect(out).toContain("PER VARIATION");
    // Library slot — title rendered, description rendered.
    expect(out).toContain("Variation 1: Belly fat that won't budge");
    expect(out).toContain("Stubborn fat that resists diet and cardio.");
    // AUTO slot — flagged for Claude.
    expect(out).toContain("Variation 2: AUTO");
    // Freeform slot — title + description rendered, same shape as library.
    expect(out).toContain("Variation 3: Afraid of caffeine jitters");
    expect(out).toContain("Wants energy but worried about anxiety / shakes.");
  });

  it("handles a single locked pain point repeated across all slots (all-same-as-library)", () => {
    const same = { title: "Mid-afternoon energy crash", description: "2pm slump.", source: "library" as const };
    const slots: SelectedPainPoint[] = [same, same, same];
    const out = buildPainPointInstruction(slots);
    expect(out).toContain("PER VARIATION");
    expect(out).toContain("Variation 1: Mid-afternoon energy crash");
    expect(out).toContain("Variation 2: Mid-afternoon energy crash");
    expect(out).toContain("Variation 3: Mid-afternoon energy crash");
  });
});
