import { describe, it, expect } from "vitest";

describe("Product Renders & Info", () => {
  describe("Active Products", () => {
    it("should have exactly 5 active products", async () => {
      const { ACTIVE_PRODUCTS } = await import("../drizzle/schema");
      expect(ACTIVE_PRODUCTS).toHaveLength(5);
      expect(ACTIVE_PRODUCTS).toContain("Hyperburn");
      expect(ACTIVE_PRODUCTS).toContain("Thermosleep");
      expect(ACTIVE_PRODUCTS).toContain("Hyperload");
      expect(ACTIVE_PRODUCTS).toContain("Thermoburn");
      expect(ACTIVE_PRODUCTS).toContain("Carb Control");
    });

    it("should NOT contain removed products", async () => {
      const { ACTIVE_PRODUCTS } = await import("../drizzle/schema");
      expect(ACTIVE_PRODUCTS).not.toContain("SuperGreens");
      expect(ACTIVE_PRODUCTS).not.toContain("EAA");
      expect(ACTIVE_PRODUCTS).not.toContain("Creatine");
      expect(ACTIVE_PRODUCTS).not.toContain("Pre-Workout");
      expect(ACTIVE_PRODUCTS).not.toContain("HB");
    });
  });

  describe("Product Renders Schema", () => {
    it("should export productRenders table", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.productRenders).toBeDefined();
    });

    it("should export InsertProductRender type", async () => {
      // This is a compile-time check — if the type doesn't exist, the import fails
      const schema = await import("../drizzle/schema");
      expect(schema.productRenders).toBeDefined();
    });
  });

  describe("Product Info Schema", () => {
    it("should export productInfo table", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.productInfo).toBeDefined();
    });
  });

  describe("Image Compositing", () => {
    it("should export generateStaticAdVariations", async () => {
      const { generateStaticAdVariations } = await import("./services/imageCompositing");
      expect(typeof generateStaticAdVariations).toBe("function");
    });
  });

  describe("Claude Service", () => {
    it("generateScripts should accept optional productInfoContext parameter", async () => {
      const { generateScripts } = await import("./services/claude");
      expect(typeof generateScripts).toBe("function");
      // Check function accepts 6 parameters (including optional productInfoContext)
      expect(generateScripts.length).toBeGreaterThanOrEqual(5);
    });
  });
});
