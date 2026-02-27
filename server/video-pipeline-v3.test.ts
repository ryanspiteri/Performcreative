import { describe, expect, it } from "vitest";
import {
  SCRIPT_STYLES,
  SCRIPT_SUB_STRUCTURES,
  FUNNEL_STAGE_RULES,
  ARCHETYPE_PROFILES,
  PRODUCT_INTELLIGENCE,
  EMOTION_STRUCTURE_MAP,
  NAMED_EXPERTS,
  estimatePipelineCost,
  getStyleSystemPrompt,
  type StyleConfig,
  type FunnelStage,
  type ActorArchetype,
  type ScriptStyleId,
} from "./services/videoPipeline";

// ============================================================
// v3.0 COPY FRAMEWORK — Unit Tests
// ============================================================

describe("SCRIPT_STYLES", () => {
  it("contains 7 script styles (DR, UGC, FOUNDER, BRAND, EDUCATION, LIFESTYLE, DEMO)", () => {
    expect(SCRIPT_STYLES).toHaveLength(7);
    const ids = SCRIPT_STYLES.map(s => s.id);
    expect(ids).toContain("DR");
    expect(ids).toContain("UGC");
    expect(ids).toContain("FOUNDER");
    expect(ids).toContain("BRAND");
    expect(ids).toContain("EDUCATION");
    expect(ids).toContain("LIFESTYLE");
    expect(ids).toContain("DEMO");
  });

  it("each style has id, label, and description", () => {
    for (const style of SCRIPT_STYLES) {
      expect(style.id).toBeTruthy();
      expect(style.label).toBeTruthy();
      expect(style.description).toBeTruthy();
    }
  });
});

describe("SCRIPT_SUB_STRUCTURES", () => {
  it("contains all 19 sub-structures", () => {
    expect(SCRIPT_SUB_STRUCTURES.length).toBe(19);
  });

  it("has 7 DR sub-structures with IDs DR-1 to DR-7", () => {
    const dr = SCRIPT_SUB_STRUCTURES.filter(s => s.category === "DR");
    expect(dr.length).toBe(7);
    const ids = dr.map(s => s.id).sort();
    expect(ids).toEqual(["DR-1", "DR-2", "DR-3", "DR-4", "DR-5", "DR-6", "DR-7"]);
  });

  it("has 6 UGC sub-structures with IDs UGC-1 to UGC-6", () => {
    const ugc = SCRIPT_SUB_STRUCTURES.filter(s => s.category === "UGC");
    expect(ugc.length).toBe(6);
    const ids = ugc.map(s => s.id).sort();
    expect(ids).toEqual(["UGC-1", "UGC-2", "UGC-3", "UGC-4", "UGC-5", "UGC-6"]);
  });

  it("has 3 Founder-Led sub-structures with IDs FL-1 to FL-3", () => {
    const founder = SCRIPT_SUB_STRUCTURES.filter(s => s.category === "FOUNDER");
    expect(founder.length).toBe(3);
    const ids = founder.map(s => s.id).sort();
    expect(ids).toEqual(["FL-1", "FL-2", "FL-3"]);
  });

  it("has 3 Brand sub-structures with IDs BR-1 to BR-3", () => {
    const brand = SCRIPT_SUB_STRUCTURES.filter(s => s.category === "BRAND");
    expect(brand.length).toBe(3);
    const ids = brand.map(s => s.id).sort();
    expect(ids).toEqual(["BR-1", "BR-2", "BR-3"]);
  });

  it("every sub-structure has required fields", () => {
    for (const sub of SCRIPT_SUB_STRUCTURES) {
      expect(sub.id).toBeTruthy();
      expect(sub.name).toBeTruthy();
      expect(sub.category).toBeTruthy();
      expect(sub.funnelStages.length).toBeGreaterThan(0);
      expect(sub.awarenessLevel).toBeTruthy();
      expect(sub.platform).toBeTruthy();
      expect(sub.stages.length).toBeGreaterThan(0);
      expect(sub.whyItConverts).toBeTruthy();
      expect(sub.psychologicalLever).toBeTruthy();
    }
  });

  it("every sub-structure has valid funnel stages", () => {
    const validStages: FunnelStage[] = ["cold", "warm", "retargeting", "retention"];
    for (const sub of SCRIPT_SUB_STRUCTURES) {
      for (const stage of sub.funnelStages) {
        expect(validStages).toContain(stage);
      }
    }
  });
});

describe("FUNNEL_STAGE_RULES", () => {
  it("defines rules for all 4 funnel stages", () => {
    const stages: FunnelStage[] = ["cold", "warm", "retargeting", "retention"];
    for (const stage of stages) {
      expect(FUNNEL_STAGE_RULES[stage]).toBeTruthy();
      expect(typeof FUNNEL_STAGE_RULES[stage]).toBe("string");
      expect(FUNNEL_STAGE_RULES[stage].length).toBeGreaterThan(20);
    }
  });
});

describe("ARCHETYPE_PROFILES", () => {
  it("defines all 5 actor archetypes", () => {
    const archetypes: ActorArchetype[] = [
      "FitnessEnthusiast", "BusyMum", "Athlete", "Biohacker", "WellnessAdvocate",
    ];
    for (const arch of archetypes) {
      expect(ARCHETYPE_PROFILES[arch]).toBeTruthy();
    }
  });

  it("each archetype has label, lifeContext, languageRegister, and preProductObjection", () => {
    for (const [key, profile] of Object.entries(ARCHETYPE_PROFILES)) {
      expect(profile.label).toBeTruthy();
      expect(profile.lifeContext).toBeTruthy();
      expect(profile.languageRegister).toBeTruthy();
      expect(profile.preProductObjection).toBeTruthy();
    }
  });

  it("BusyMum has appropriate life context", () => {
    const profile = ARCHETYPE_PROFILES["BusyMum"];
    const ctx = profile.lifeContext.toLowerCase();
    expect(ctx.includes("juggl") || ctx.includes("kid") || ctx.includes("time")).toBe(true);
  });

  it("Biohacker has appropriate language register", () => {
    const profile = ARCHETYPE_PROFILES["Biohacker"];
    const reg = profile.languageRegister.toLowerCase();
    expect(reg.includes("analytical") || reg.includes("track") || reg.includes("test") || reg.includes("recovery")).toBe(true);
  });
});

describe("PRODUCT_INTELLIGENCE", () => {
  it("contains entries for core ONEST products", () => {
    const coreProducts = ["Hyperburn", "Thermosleep", "Hyperload"];
    for (const p of coreProducts) {
      expect(PRODUCT_INTELLIGENCE[p]).toBeTruthy();
    }
  });

  it("each product has required intelligence fields", () => {
    for (const [name, intel] of Object.entries(PRODUCT_INTELLIGENCE)) {
      expect(intel.fullName).toBeTruthy();
      expect(intel.category).toBeTruthy();
      expect(intel.copyLevers).toBeTruthy();
      expect(intel.copyLevers.length).toBeGreaterThan(0);
      expect(intel.copyTraps).toBeTruthy();
      expect(intel.stackPartners).toBeTruthy();
      expect(intel.targetPersona).toBeTruthy();
      expect(intel.keyIngredients).toBeTruthy();
      expect(intel.keyIngredients.length).toBeGreaterThan(0);
      expect(intel.primaryBenefit).toBeTruthy();
    }
  });

  it("Hyperburn has fat-burning related primary benefit", () => {
    const intel = PRODUCT_INTELLIGENCE["Hyperburn"];
    const benefit = intel.primaryBenefit.toLowerCase();
    expect(benefit.includes("fat") || benefit.includes("burn") || benefit.includes("metabol") || benefit.includes("energy")).toBe(true);
  });
});

describe("EMOTION_STRUCTURE_MAP", () => {
  it("maps emotion categories to sub-structure IDs", () => {
    expect(Object.keys(EMOTION_STRUCTURE_MAP).length).toBeGreaterThan(0);
    for (const [emotion, structures] of Object.entries(EMOTION_STRUCTURE_MAP)) {
      expect(Array.isArray(structures)).toBe(true);
      expect(structures.length).toBeGreaterThan(0);
      // Each mapped structure should exist in SCRIPT_SUB_STRUCTURES
      for (const structId of structures) {
        const found = SCRIPT_SUB_STRUCTURES.find(s => s.id === structId);
        expect(found).toBeTruthy();
      }
    }
  });
});

describe("NAMED_EXPERTS", () => {
  it("contains at least 3 named experts", () => {
    expect(NAMED_EXPERTS.length).toBeGreaterThanOrEqual(3);
  });

  it("each expert has name, framework, and lens", () => {
    for (const expert of NAMED_EXPERTS) {
      expect(expert.name).toBeTruthy();
      expect(expert.framework).toBeTruthy();
      expect(expert.lens).toBeTruthy();
    }
  });
});

describe("estimatePipelineCost", () => {
  it("returns zero scripts for empty style config", () => {
    const result = estimatePipelineCost([], 60);
    expect(result.totalScripts).toBe(0);
    expect(result.breakdown.length).toBe(0);
  });

  it("calculates cost for a single DR script", () => {
    const config: StyleConfig[] = [{ styleId: "DR", quantity: 1 }];
    const result = estimatePipelineCost(config, 60);
    expect(result.totalScripts).toBe(1);
    expect(result.estimatedCostUSD).toBeGreaterThan(0);
  });

  it("scales cost with number of scripts", () => {
    const config1: StyleConfig[] = [{ styleId: "DR", quantity: 1 }];
    const config2: StyleConfig[] = [{ styleId: "DR", quantity: 3 }];
    const result1 = estimatePipelineCost(config1, 60);
    const result2 = estimatePipelineCost(config2, 60);
    expect(result2.estimatedCostUSD).toBeGreaterThan(result1.estimatedCostUSD);
    expect(result2.totalScripts).toBe(3);
  });

  it("returns breakdown array with style details", () => {
    const config: StyleConfig[] = [{ styleId: "UGC", quantity: 1 }];
    const result = estimatePipelineCost(config, 60);
    expect(result.breakdown.length).toBe(1);
    expect(result.breakdown[0].quantity).toBe(1);
    expect(result.breakdown[0].tokensPerScript).toBeGreaterThan(0);
  });
});

describe("getStyleSystemPrompt", () => {
  it("returns a non-empty prompt for DR style", () => {
    const prompt = getStyleSystemPrompt("DR", "Hyperburn", 60, "cold");
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("returns a non-empty prompt for UGC style", () => {
    const prompt = getStyleSystemPrompt("UGC", "Thermosleep", 60, "warm");
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("returns a non-empty prompt for FOUNDER style", () => {
    const prompt = getStyleSystemPrompt("FOUNDER", "Hyperload", 90, "cold");
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("returns a non-empty prompt for BRAND style", () => {
    const prompt = getStyleSystemPrompt("BRAND", "Hyperburn", 60, "warm");
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("includes product name in the prompt", () => {
    const prompt = getStyleSystemPrompt("UGC", "Hyperburn", 60, "cold");
    expect(prompt).toContain("Hyperburn");
  });
});

describe("Sub-structure funnel stage filtering", () => {
  it("cold funnel has at least 5 available sub-structures", () => {
    const cold = SCRIPT_SUB_STRUCTURES.filter(s => s.funnelStages.includes("cold"));
    expect(cold.length).toBeGreaterThanOrEqual(5);
  });

  it("retargeting funnel has at least 3 available sub-structures", () => {
    const retargeting = SCRIPT_SUB_STRUCTURES.filter(s => s.funnelStages.includes("retargeting"));
    expect(retargeting.length).toBeGreaterThanOrEqual(3);
  });

  it("retention funnel has at least 1 available sub-structure", () => {
    const retention = SCRIPT_SUB_STRUCTURES.filter(s => s.funnelStages.includes("retention"));
    expect(retention.length).toBeGreaterThanOrEqual(1);
  });

  it("warm funnel has at least 4 available sub-structures", () => {
    const warm = SCRIPT_SUB_STRUCTURES.filter(s => s.funnelStages.includes("warm"));
    expect(warm.length).toBeGreaterThanOrEqual(4);
  });

  it("every sub-structure is available for at least one funnel stage", () => {
    for (const sub of SCRIPT_SUB_STRUCTURES) {
      expect(sub.funnelStages.length).toBeGreaterThan(0);
    }
  });
});
