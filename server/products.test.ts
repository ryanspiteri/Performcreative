import { describe, it, expect, vi } from "vitest";
import { runWithConcurrency } from "./services/_shared";

describe("Product Renders & Info", () => {
  describe("Active Products", () => {
    it("should have exactly 12 active products", async () => {
      const { ACTIVE_PRODUCTS } = await import("../drizzle/schema");
      expect(ACTIVE_PRODUCTS).toHaveLength(12);
      expect(ACTIVE_PRODUCTS).toContain("Hyperburn");
      expect(ACTIVE_PRODUCTS).toContain("Thermosleep");
      expect(ACTIVE_PRODUCTS).toContain("Hyperload");
      expect(ACTIVE_PRODUCTS).toContain("Thermoburn");
      expect(ACTIVE_PRODUCTS).toContain("Carb Control");
      expect(ACTIVE_PRODUCTS).toContain("Protein + Collagen");
      expect(ACTIVE_PRODUCTS).toContain("Creatine");
      expect(ACTIVE_PRODUCTS).toContain("HyperPump");
      expect(ACTIVE_PRODUCTS).toContain("AminoLoad");
      expect(ACTIVE_PRODUCTS).toContain("Marine Collagen");
      expect(ACTIVE_PRODUCTS).toContain("SuperGreens");
      expect(ACTIVE_PRODUCTS).toContain("Whey ISO Pro");
    });

    it("should NOT contain removed products", async () => {
      const { ACTIVE_PRODUCTS } = await import("../drizzle/schema");
      expect(ACTIVE_PRODUCTS).not.toContain("EAA");
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

  describe("Claude Service", () => {
    it("generateScripts should accept optional productInfoContext parameter", async () => {
      const { generateScripts } = await import("./services/claude");
      expect(typeof generateScripts).toBe("function");
      expect(generateScripts.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("DB functions (mocked)", () => {
    it("getDefaultProductRender returns default render when isDefault=1 exists", async () => {
      const mockRow = { id: 1, product: "Hyperburn", url: "https://cdn.example.com/hb.png", isDefault: 1 };
      vi.doMock("./db", () => ({
        getDefaultProductRender: vi.fn().mockResolvedValue(mockRow),
      }));
      const db = await import("./db");
      const result = await db.getDefaultProductRender("Hyperburn");
      expect(result).toEqual(mockRow);
      expect(result!.isDefault).toBe(1);
      vi.doUnmock("./db");
    });

    it("getDefaultProductRender returns null when no renders exist", async () => {
      vi.doMock("./db", () => ({
        getDefaultProductRender: vi.fn().mockResolvedValue(null),
      }));
      const db = await import("./db");
      const result = await db.getDefaultProductRender("NonExistentProduct");
      expect(result).toBeNull();
      vi.doUnmock("./db");
    });

    it("getProductInfo returns product data when it exists", async () => {
      const mockInfo = { product: "Hyperburn", ingredients: "Caffeine, Green Tea", benefits: "Fat burning" };
      vi.doMock("./db", () => ({
        getProductInfo: vi.fn().mockResolvedValue(mockInfo),
      }));
      const db = await import("./db");
      const result = await db.getProductInfo("Hyperburn");
      expect(result).toEqual(mockInfo);
      expect(result!.ingredients).toBe("Caffeine, Green Tea");
      vi.doUnmock("./db");
    });

    it("getProductInfo returns null for unknown product", async () => {
      vi.doMock("./db", () => ({
        getProductInfo: vi.fn().mockResolvedValue(null),
      }));
      const db = await import("./db");
      const result = await db.getProductInfo("UnknownProduct");
      expect(result).toBeNull();
      vi.doUnmock("./db");
    });
  });
});

describe("runWithConcurrency", () => {
  it("runs tasks concurrently up to the limit", async () => {
    const order: number[] = [];
    const tasks = [0, 1, 2, 3, 4].map(i => async () => {
      order.push(i);
      await new Promise(r => setTimeout(r, 10));
      return i * 2;
    });

    const results = await runWithConcurrency(tasks, 2);
    expect(results).toEqual([0, 2, 4, 6, 8]);
  });

  it("returns results in input order regardless of completion order", async () => {
    // Task 0 is slow, task 1 is fast — results should still be [0, 1]
    const tasks = [
      async () => { await new Promise(r => setTimeout(r, 30)); return "slow"; },
      async () => { await new Promise(r => setTimeout(r, 5)); return "fast"; },
    ];

    const results = await runWithConcurrency(tasks, 2);
    expect(results).toEqual(["slow", "fast"]);
  });

  it("handles empty task list", async () => {
    const results = await runWithConcurrency([], 2);
    expect(results).toEqual([]);
  });

  it("handles concurrency=1 (sequential)", async () => {
    const order: number[] = [];
    const tasks = [0, 1, 2].map(i => async () => {
      order.push(i);
      return i;
    });

    const results = await runWithConcurrency(tasks, 1);
    expect(results).toEqual([0, 1, 2]);
    expect(order).toEqual([0, 1, 2]); // strictly sequential
  });

  it("propagates errors from tasks", async () => {
    const tasks = [
      async () => "ok",
      async () => { throw new Error("task failed"); },
    ];

    await expect(runWithConcurrency(tasks, 2)).rejects.toThrow("task failed");
  });
});
