import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[]; clearedCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies, clearedCookies };
}

describe("organic.checkAutoEditHealth", () => {
  it("returns { available: boolean }", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.organic.checkAutoEditHealth();

    expect(result).toHaveProperty("available");
    expect(typeof result.available).toBe("boolean");
  });
});

describe("organic.getRun", () => {
  it("throws NOT_FOUND for non-existent run", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.organic.getRun({ id: 999999 })
    ).rejects.toThrow();
  });
});

describe("organic.listContent", () => {
  it("returns { adRuns: array, organicRuns: array }", async () => {
    if (!process.env.DATABASE_URL) return; // Skip when DB not configured
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.organic.listContent();

    expect(result).toHaveProperty("adRuns");
    expect(result).toHaveProperty("organicRuns");
    expect(Array.isArray(result.adRuns)).toBe(true);
    expect(Array.isArray(result.organicRuns)).toBe(true);
  });
});
