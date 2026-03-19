/**
 * Tests for product render DB helpers introduced in Round 16.
 *
 * getDefaultProductRender   — 3 paths: isDefault=1 found, fallback-to-latest, no renders
 * setDefaultProductRender   — clears existing default, sets new one, throws on missing row
 * createProductRender       — auto-sets isDefault=1 on new upload, clears previous default
 * getChildRunsByParentId    — targeted query (not full-table-scan)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Configurable mock state ───────────────────────────────────────────────────

// Each call to select().from() consumes one entry from this queue.
// This lets us configure different return values for sequential selects.
let selectQueue: any[][] = [];
let mockInsertId: number | null = null;
let updateCallCount = 0;

function resetMock() {
  selectQueue = [];
  mockInsertId = null;
  updateCallCount = 0;
  mockDb.update.mockClear();
  mockDb.select.mockClear();
  mockDb.insert.mockClear();
}

// A fluent chain that resolves to `rows` at any terminal call.
// Drizzle chains can end with: .limit(), .orderBy(), or just being awaited.
// This mock handles all three: .where().limit(), .where().orderBy().limit(),
// and .where().orderBy() (awaited directly as a Promise).
function makeChain(rows: any[]): any {
  const chain: any = {
    where: vi.fn().mockImplementation(() => makeChain(rows)),
    orderBy: vi.fn().mockImplementation(() => makeChain(rows)), // returns another chain (not resolved yet)
    limit: vi.fn().mockResolvedValue(rows),   // terminal
  };
  // Make the chain thenable so `await chain` resolves to rows
  chain.then = (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject);
  return chain;
}

const mockDb = {
  select: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => {
      const rows = selectQueue.length > 0 ? selectQueue.shift()! : [];
      return makeChain(rows);
    }),
  })),
  insert: vi.fn().mockImplementation(() => ({
    values: vi.fn().mockResolvedValue([{ insertId: mockInsertId }]),
  })),
  update: vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        updateCallCount++;
        return Promise.resolve();
      }),
    })),
  })),
  delete: vi.fn().mockImplementation(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  })),
};

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((_col: any, val: any) => ({ __eq: val })),
    and: vi.fn((...args: any[]) => ({ __and: args })),
    desc: vi.fn((col: any) => ({ __desc: col })),
  };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getDefaultProductRender", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test";
    vi.resetModules();
    resetMock();
  });

  it("returns the render with isDefault=1 when one exists", async () => {
    const defaultRender = { id: 2, product: "Hyperburn", url: "https://cdn/v2.png", isDefault: 1 };
    // First select (WHERE isDefault=1 LIMIT 1) → returns the default render
    selectQueue = [[defaultRender]];

    const { getDefaultProductRender } = await import("./db");
    const result = await getDefaultProductRender("Hyperburn");
    expect(result).toEqual(defaultRender);
    expect(result?.isDefault).toBe(1);
  });

  it("falls back to the most recent render when no isDefault=1 row exists", async () => {
    const latestRender = { id: 3, product: "Hyperburn", url: "https://cdn/v3.png", isDefault: 0 };
    // First select (WHERE isDefault=1) → empty; second (ORDER BY createdAt) → latest
    selectQueue = [[], [latestRender]];

    const { getDefaultProductRender } = await import("./db");
    const result = await getDefaultProductRender("Hyperburn");
    expect(result).toEqual(latestRender);
  });

  it("returns null when no renders exist for the product at all", async () => {
    // Both selects return empty
    selectQueue = [[], []];

    const { getDefaultProductRender } = await import("./db");
    const result = await getDefaultProductRender("Hyperburn");
    expect(result).toBeNull();
  });

  it("throws when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    // Also reset the singleton so getDb() re-evaluates
    vi.resetModules();
    const { getDefaultProductRender } = await import("./db");
    await expect(getDefaultProductRender("Hyperburn")).rejects.toThrow("Database not available");
  });
});

describe("setDefaultProductRender", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test";
    vi.resetModules();
    resetMock();
  });

  it("throws when the render ID does not exist", async () => {
    selectQueue = [[]]; // row lookup returns empty
    const { setDefaultProductRender } = await import("./db");
    await expect(setDefaultProductRender(999)).rejects.toThrow("Product render not found");
  });

  it("issues two UPDATE calls: clear product defaults then set the target", async () => {
    const targetRender = { id: 5, product: "Thermosleep", url: "https://cdn/ts.png", isDefault: 0 };
    selectQueue = [[targetRender]]; // row lookup returns the target render
    const { setDefaultProductRender } = await import("./db");
    await setDefaultProductRender(5);
    expect(updateCallCount).toBe(2);
  });
});

describe("createProductRender auto-default", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test";
    vi.resetModules();
    resetMock();
    mockInsertId = 10;
  });

  it("returns the new insertId and issues two UPDATE calls (clear + set default)", async () => {
    const { createProductRender } = await import("./db");
    const insertId = await createProductRender({
      product: "Hyperburn",
      fileName: "render-v4.png",
      url: "https://cdn/v4.png",
      mimeType: "image/png",
    });
    expect(insertId).toBe(10);
    // UPDATE 1: set isDefault=0 on all renders for this product
    // UPDATE 2: set isDefault=1 on the newly inserted render
    expect(updateCallCount).toBe(2);
  });

  it("does not issue UPDATE calls when insertId is null (failed insert)", async () => {
    mockInsertId = null;
    const { createProductRender } = await import("./db");
    await createProductRender({
      product: "Hyperburn",
      fileName: "render-v5.png",
      url: "https://cdn/v5.png",
      mimeType: "image/png",
    });
    expect(updateCallCount).toBe(0);
  });
});

describe("getChildRunsByParentId", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test";
    vi.resetModules();
    resetMock();
  });

  it("returns child runs for the given parent", async () => {
    const childRun = { id: 42, parentRunId: 7, variationLayer: "child", status: "completed" };
    selectQueue = [[childRun]];
    const { getChildRunsByParentId } = await import("./db");
    const results = await getChildRunsByParentId(7);
    expect(results).toEqual([childRun]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("returns an empty array when the parent has no children", async () => {
    selectQueue = [[]];
    const { getChildRunsByParentId } = await import("./db");
    const results = await getChildRunsByParentId(99);
    expect(results).toEqual([]);
  });
});
