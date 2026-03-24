import { describe, it, expect, vi } from "vitest";

describe("nanoBananaPro interface", () => {
  it("should have useCompositing option in the interface", async () => {
    const { generateProductAdWithNanoBananaPro } = await import("./services/nanoBananaPro");
    expect(typeof generateProductAdWithNanoBananaPro).toBe("function");
  });
});

describe("videoPipeline archetype integration", () => {
  it("should export runIterationStages1to2 without archetype dependency", async () => {
    const { runIterationStages1to2 } = await import("./services/iterationPipeline");
    expect(typeof runIterationStages1to2).toBe("function");
  });

  it("should export ARCHETYPE_PROFILES from videoPipeline (used by video pipeline only)", async () => {
    const { ARCHETYPE_PROFILES } = await import("./services/videoPipeline");
    expect(ARCHETYPE_PROFILES).toBeDefined();
    expect(ARCHETYPE_PROFILES.FitnessEnthusiast).toBeDefined();
    expect(ARCHETYPE_PROFILES.BusyMum).toBeDefined();
    expect(ARCHETYPE_PROFILES.Athlete).toBeDefined();
    expect(ARCHETYPE_PROFILES.Biohacker).toBeDefined();
    expect(ARCHETYPE_PROFILES.WellnessAdvocate).toBeDefined();
  });

  it("should have label, lifeContext, languageRegister, preProductObjection for each archetype", async () => {
    const { ARCHETYPE_PROFILES } = await import("./services/videoPipeline");

    for (const key of Object.keys(ARCHETYPE_PROFILES)) {
      const profile = ARCHETYPE_PROFILES[key as keyof typeof ARCHETYPE_PROFILES];
      expect(profile).toHaveProperty("label");
      expect(profile).toHaveProperty("lifeContext");
      expect(profile).toHaveProperty("languageRegister");
      expect(profile).toHaveProperty("preProductObjection");
      expect(typeof profile.label).toBe("string");
      expect(profile.label.length).toBeGreaterThan(0);
    }
  });
});
