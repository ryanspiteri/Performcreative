import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
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

describe("auth.login", () => {
  it("rejects invalid credentials", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "wrong", password: "wrong" })
    ).rejects.toThrow();
  });

  it("accepts valid ONEST / UnlockGrowth credentials and sets cookie", async () => {
    if (!process.env.JWT_SECRET?.length) return; // Skip: JWT signing requires JWT_SECRET
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({ username: "ONEST", password: "UnlockGrowth" });

    expect(result.success).toBe(true);
    expect(result.user.name).toBe("ONEST Admin");
    expect(setCookies.length).toBeGreaterThanOrEqual(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("auth.logout", () => {
  it("clears the session cookie", async () => {
    const { ctx, clearedCookies } = createPublicContext();
    // Simulate authenticated user
    ctx.user = {
      id: 1,
      openId: "onest-admin-user",
      email: "admin@onest.com.au",
      name: "ONEST Admin",
      loginMethod: "manual",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("pipeline.list", () => {
  it("returns an array of pipeline runs", async () => {
    if (!process.env.DATABASE_URL) return; // Skip when DB not configured
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.pipeline.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("pipeline.get", () => {
  it("throws NOT_FOUND for non-existent run", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.pipeline.get({ id: 999999 })
    ).rejects.toThrow();
  });
});
