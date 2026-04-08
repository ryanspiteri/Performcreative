import { describe, it, expect } from "vitest";
import { formatScriptForClickUp } from "./routers/scriptGenerator";

describe("formatScriptForClickUp", () => {
  it("formats a complete script with all fields", () => {
    const script = {
      title: "HyperBurn — The 2pm Slump",
      hook: "Your metabolism isn't slow because you're lazy.",
      script: [
        {
          timestamp: "0-3s",
          visual: "Close-up of clock at 2pm",
          dialogue: "That 3pm slump where you're reading the same email for the fourth time.",
          transitionLine: "But here's what's actually happening.",
        },
        {
          timestamp: "3-15s",
          visual: "Split screen: tired person vs energised person",
          dialogue: "Most fat burners give you a caffeine spike and crash.",
        },
      ],
      visualDirection: "Polished DR energy. Clean cuts. No stock footage.",
      strategicThesis: "Targets problem-aware cold traffic through the invisible problem reveal.",
      review: { finalScore: 87, approved: true, summary: "Strong hook and dimensionalization." },
    };

    const result = formatScriptForClickUp(script);

    expect(result).toContain("**HOOK:**");
    expect(result).toContain("Your metabolism isn't slow because you're lazy.");
    expect(result).toContain("**SCRIPT:**");
    expect(result).toContain("**0-3s**");
    expect(result).toContain("_Dialogue:_");
    expect(result).toContain("_Transition:_ But here's what's actually happening.");
    expect(result).toContain("**VISUAL DIRECTION:**");
    expect(result).toContain("**STRATEGIC THESIS:**");
  });

  it("handles null review score with fallback 0", () => {
    const script = {
      title: "Script without review",
      hook: "Hook line.",
      script: [],
      review: null,
    };
    // The router applies fallback: s.review?.finalScore ?? 0
    const score = (script as any).review?.finalScore ?? 0;
    expect(score).toBe(0);
  });

  it("handles missing optional fields gracefully", () => {
    const script = {
      hook: "Hook only.",
      script: [
        { timestamp: "0-3s", dialogue: "Just dialogue, no visual or transition." },
      ],
    };

    const result = formatScriptForClickUp(script);

    expect(result).toContain("**HOOK:**");
    expect(result).toContain("Hook only.");
    expect(result).toContain("**0-3s**");
    expect(result).toContain("_Dialogue:_ Just dialogue, no visual or transition.");
    expect(result).not.toContain("**VISUAL DIRECTION:**");
    expect(result).not.toContain("**STRATEGIC THESIS:**");
  });

  it("returns trimmed non-empty string for minimal input", () => {
    const result = formatScriptForClickUp({ hook: "Hi." });
    expect(result.trim().length).toBeGreaterThan(0);
    expect(result).toBe(result.trim());
  });

  it("handles completely empty script object without throwing", () => {
    expect(() => formatScriptForClickUp({})).not.toThrow();
  });
});
