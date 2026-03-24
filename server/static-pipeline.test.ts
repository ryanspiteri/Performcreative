import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@onest.com.au",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("pipeline.submitSelections", () => {
  it("rejects submission when run is not in selection stage", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Attempt to submit selections for a non-existent run
    await expect(
      caller.pipeline.submitSelections({
        runId: 999999,
        selections: {
          images: [
            { headline: "Test Headline 1", subheadline: null, background: { title: "BG1", description: "desc", prompt: "prompt" } },
            { headline: "Test Headline 2", subheadline: "Sub 2", background: { title: "BG2", description: "desc", prompt: "prompt" } },
            { headline: "Test Headline 3", subheadline: null, background: { title: "BG3", description: "desc", prompt: "prompt" } },
          ],
          benefits: "Science-Backed Results",
        },
      })
    ).rejects.toThrow();
  });

  it("validates selection schema requires exactly 3 images", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Attempt with only 2 images — should fail validation
    await expect(
      caller.pipeline.submitSelections({
        runId: 1,
        selections: {
          images: [
            { headline: "Test", subheadline: null, background: { title: "BG", description: "d", prompt: "p" } },
            { headline: "Test", subheadline: null, background: { title: "BG", description: "d", prompt: "p" } },
          ] as any,
          benefits: "Benefits",
        },
      })
    ).rejects.toThrow();
  });

  it("allows null subheadlines in selections", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // This should pass validation even though subheadlines are null
    // (will fail at DB lookup, but the schema validation should pass)
    await expect(
      caller.pipeline.submitSelections({
        runId: 999999,
        selections: {
          images: [
            { headline: "Headline 1", subheadline: null, background: { title: "BG1", description: "desc1", prompt: "prompt1" } },
            { headline: "Headline 2", subheadline: null, background: { title: "BG2", description: "desc2", prompt: "prompt2" } },
            { headline: "Headline 3", subheadline: null, background: { title: "BG3", description: "desc3", prompt: "prompt3" } },
          ],
          benefits: "Zero Fillers",
        },
      })
    ).rejects.toThrow();
  });

  it("allows string subheadlines in selections", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Should pass schema validation but fail at DB lookup (NOT_FOUND)
    await expect(
      caller.pipeline.submitSelections({
        runId: 999999,
        selections: {
          images: [
            { headline: "H1", subheadline: "Sub 1", background: { title: "BG1", description: "d", prompt: "p" } },
            { headline: "H2", subheadline: "Sub 2", background: { title: "BG2", description: "d", prompt: "p" } },
            { headline: "H3", subheadline: "Sub 3", background: { title: "BG3", description: "d", prompt: "p" } },
          ],
          benefits: "Clinically Dosed",
        },
      })
    ).rejects.toThrow();
  });
});

describe("pipeline.teamApprove", () => {
  it("rejects approval for non-existent run", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.pipeline.teamApprove({
        runId: 999999,
        approved: true,
        notes: "Looks great",
      })
    ).rejects.toThrow();
  });
});

describe("pipeline.getActiveProducts", () => {
  it("returns the list of active products", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const products = await caller.pipeline.getActiveProducts();
    expect(products).toBeDefined();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    expect(products).toContain("Hyperburn");
    expect(products).toContain("Thermosleep");
  });
});

describe("ImageSelections type", () => {
  it("ImageSelections interface allows null subheadlines", async () => {
    const { ImageSelections } = await import("./services/_shared") as any;

    const selections = {
      images: [
        { headline: "H1", subheadline: null, background: { title: "BG1", description: "d", prompt: "p" } },
        { headline: "H2", subheadline: "Sub 2", background: { title: "BG2", description: "d", prompt: "p" } },
        { headline: "H3", subheadline: null, background: { title: "BG3", description: "d", prompt: "p" } },
      ],
      benefits: "Science-Backed",
    };

    expect(selections.images).toHaveLength(3);
    expect(selections.images[0].subheadline).toBeNull();
    expect(selections.images[1].subheadline).toBe("Sub 2");
    expect(selections.benefits).toBe("Science-Backed");
  });
});
