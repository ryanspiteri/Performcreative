import { describe, it, expect } from "vitest";

describe("Video Pipeline - Copy Framework v3.0", () => {
  describe("Product Intelligence", () => {
    it("should export PRODUCT_INTELLIGENCE with all products", async () => {
      const { PRODUCT_INTELLIGENCE } = await import("./services/videoPipeline");
      expect(PRODUCT_INTELLIGENCE).toBeDefined();
      const products = Object.keys(PRODUCT_INTELLIGENCE);
      expect(products.length).toBeGreaterThanOrEqual(5);
      expect(products).toContain("Hyperburn");
      expect(products).toContain("Thermosleep");
      expect(products).toContain("Protein + Collagen");
      expect(products).toContain("Hyperload");
      expect(products).toContain("Creatine");
    });

    it("should have copy levers and traps for each product", async () => {
      const { PRODUCT_INTELLIGENCE } = await import("./services/videoPipeline");
      for (const [name, info] of Object.entries(PRODUCT_INTELLIGENCE)) {
        expect(info).toHaveProperty("copyLevers");
        expect(info).toHaveProperty("copyTraps");
        expect(info).toHaveProperty("stackPartners");
        expect(Array.isArray((info as any).copyLevers)).toBe(true);
        expect(Array.isArray((info as any).copyTraps)).toBe(true);
        expect(Array.isArray((info as any).stackPartners)).toBe(true);
        expect((info as any).copyLevers.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Script Style System", () => {
    it("should export SCRIPT_STYLES with 7 styles (v3.0 adds BRAND)", async () => {
      const { SCRIPT_STYLES } = await import("./services/videoPipeline");
      expect(SCRIPT_STYLES).toBeDefined();
      expect(Array.isArray(SCRIPT_STYLES)).toBe(true);
      expect(SCRIPT_STYLES.length).toBe(7);
      const ids = SCRIPT_STYLES.map((s: any) => s.id);
      expect(ids).toContain("DR");
      expect(ids).toContain("UGC");
      expect(ids).toContain("FOUNDER");
      expect(ids).toContain("BRAND");
      expect(ids).toContain("EDUCATION");
      expect(ids).toContain("LIFESTYLE");
      expect(ids).toContain("DEMO");
    });

    it("each style should have id and label", async () => {
      const { SCRIPT_STYLES } = await import("./services/videoPipeline");
      for (const style of SCRIPT_STYLES) {
        expect(style).toHaveProperty("id");
        expect(style).toHaveProperty("label");
        expect(typeof (style as any).id).toBe("string");
        expect(typeof (style as any).label).toBe("string");
      }
    });
  });

  describe("Named Expert Reviewers", () => {
    it("should export NAMED_EXPERTS with at least 3 experts", async () => {
      const { NAMED_EXPERTS } = await import("./services/videoPipeline");
      expect(NAMED_EXPERTS).toBeDefined();
      expect(Array.isArray(NAMED_EXPERTS)).toBe(true);
      expect(NAMED_EXPERTS.length).toBeGreaterThanOrEqual(3);
    });

    it("each expert should have name, framework, and lens", async () => {
      const { NAMED_EXPERTS } = await import("./services/videoPipeline");
      for (const expert of NAMED_EXPERTS) {
        expect(expert).toHaveProperty("name");
        expect(expert).toHaveProperty("framework");
        expect(expert).toHaveProperty("lens");
        expect(typeof (expert as any).name).toBe("string");
        expect(typeof (expert as any).framework).toBe("string");
      }
    });
  });

  describe("Pipeline Functions", () => {
    it("should export runVideoPipelineStages1to3", async () => {
      const mod = await import("./services/videoPipeline");
      expect(typeof mod.runVideoPipelineStages1to3).toBe("function");
    });

    it("should export runVideoPipelineStage4", async () => {
      const mod = await import("./services/videoPipeline");
      expect(typeof mod.runVideoPipelineStage4).toBe("function");
    });

    it("should export runVideoPipelineStage5", async () => {
      const mod = await import("./services/videoPipeline");
      expect(typeof mod.runVideoPipelineStage5).toBe("function");
    });

    it("should export completeVideoPipelineWithoutClickUp", async () => {
      const mod = await import("./services/videoPipeline");
      expect(typeof mod.completeVideoPipelineWithoutClickUp).toBe("function");
    });
  });

  describe("Style-Specific Prompts (v3.0)", () => {
    it("should export getStyleSystemPrompt for each style", async () => {
      const { getStyleSystemPrompt } = await import("./services/videoPipeline");
      expect(typeof getStyleSystemPrompt).toBe("function");
      const drPrompt = getStyleSystemPrompt("DR", "Hyperburn", 60, "cold");
      expect(drPrompt.length).toBeGreaterThan(100);

      const ugcPrompt = getStyleSystemPrompt("UGC", "Hyperburn", 60, "warm");
      expect(ugcPrompt.length).toBeGreaterThan(100);
    });

    it("BRAND prompt should be non-empty", async () => {
      const { getStyleSystemPrompt } = await import("./services/videoPipeline");
      const prompt = getStyleSystemPrompt("BRAND", "Hyperburn", 60, "cold");
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("FOUNDER prompt should be non-empty", async () => {
      const { getStyleSystemPrompt } = await import("./services/videoPipeline");
      const prompt = getStyleSystemPrompt("FOUNDER", "Hyperburn", 60, "cold");
      expect(prompt.length).toBeGreaterThan(100);
    });
  });
});
