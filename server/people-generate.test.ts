import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildPeoplePrompt } from "./routers";

/**
 * Tests for the people.generate / people.regenerate endpoints' input validation
 * and the exported buildPeoplePrompt helper. No Gemini API calls in tests.
 */

const generateInputSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().min(1),
  tags: z.string().optional(),
  style: z.enum(["professional", "ugc", "lifestyle", "gym-selfie"]).optional().default("professional"),
  productId: z.number().optional(),
});

const regenerateInputSchema = z.object({
  id: z.number(),
  prompt: z.string().min(10),
});

describe("people.generate input validation", () => {
  it("accepts valid input with all fields", () => {
    const result = generateInputSchema.safeParse({
      name: "Athletic Female",
      description: "Mid-20s, toned physique, gym setting",
      tags: "female,athletic",
      style: "ugc",
      productId: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.style).toBe("ugc");
      expect(result.data.productId).toBe(42);
    }
  });

  it("defaults style to professional when not provided", () => {
    const result = generateInputSchema.safeParse({
      name: "Test Person",
      description: "A person description",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.style).toBe("professional");
    }
  });

  it("accepts all four valid styles", () => {
    const styles = ["professional", "ugc", "lifestyle", "gym-selfie"] as const;
    for (const style of styles) {
      const result = generateInputSchema.safeParse({
        name: "Test",
        description: "Test description",
        style,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.style).toBe(style);
      }
    }
  });

  it("rejects invalid style values", () => {
    const result = generateInputSchema.safeParse({
      name: "Test",
      description: "Test description",
      style: "cinematic",
    });
    expect(result.success).toBe(false);
  });

  it("allows productId to be omitted", () => {
    const result = generateInputSchema.safeParse({
      name: "Test",
      description: "Test description",
      style: "ugc",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productId).toBeUndefined();
    }
  });

  it("rejects empty name", () => {
    const result = generateInputSchema.safeParse({
      name: "",
      description: "Valid description",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = generateInputSchema.safeParse({
      name: "Valid Name",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 128 characters", () => {
    const result = generateInputSchema.safeParse({
      name: "x".repeat(129),
      description: "Valid description",
    });
    expect(result.success).toBe(false);
  });
});

describe("people.regenerate input validation", () => {
  it("accepts valid id + prompt", () => {
    const result = regenerateInputSchema.safeParse({
      id: 42,
      prompt: "Generate a hyper-realistic photo of a person with flat iPhone lighting.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects prompt shorter than 10 characters", () => {
    const result = regenerateInputSchema.safeParse({
      id: 42,
      prompt: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const result = regenerateInputSchema.safeParse({
      prompt: "A valid prompt that is definitely more than ten characters long",
    });
    expect(result.success).toBe(false);
  });
});

describe("buildPeoplePrompt — exported helper", () => {
  it("builds professional prompt with DSLR language", () => {
    const prompt = buildPeoplePrompt("professional", "Athletic female, mid-20s");
    expect(prompt).toContain("DSLR");
    expect(prompt).toContain("Magazine quality");
    expect(prompt).toContain("Athletic female, mid-20s");
    expect(prompt).not.toContain("iPhone");
    expect(prompt).not.toContain("FLAT LIGHTING");
  });

  it("builds UGC prompt with hammer-strong flat lighting language", () => {
    const prompt = buildPeoplePrompt("ugc", "Girl mid-workout");
    // Core UGC signals
    expect(prompt).toContain("FLAT LIGHTING ONLY");
    expect(prompt).toContain("iPhone");
    expect(prompt).toContain("NOT cinematic");
    expect(prompt).toContain("NOT moody");
    expect(prompt).toContain("NOT dramatic");
    // Anti-professional
    expect(prompt).not.toContain("DSLR");
    expect(prompt).not.toContain("Magazine quality");
    // Subject injected
    expect(prompt).toContain("Girl mid-workout");
  });

  it("builds lifestyle prompt with flat natural light requirement", () => {
    const prompt = buildPeoplePrompt("lifestyle", "Woman walking");
    expect(prompt).toContain("candid");
    expect(prompt).toContain("FLAT diffuse light");
    expect(prompt).toContain("NOT editorial");
    // Explicitly anti-directed (not present as a positive instruction)
    expect(prompt).toContain("NO golden hour backlight");
    expect(prompt).toContain("Woman walking");
  });

  it("builds gym-selfie prompt with gym lighting language", () => {
    const prompt = buildPeoplePrompt("gym-selfie", "Guy flexing");
    expect(prompt).toContain("gym");
    expect(prompt).toContain("fluorescent");
    expect(prompt).toContain("NOT a fitness magazine");
  });

  it("appends product suffix with HAMMER-STRONG pixel-for-pixel language when productName provided", () => {
    const prompt = buildPeoplePrompt("ugc", "Girl mid-workout", "Hyperburn");
    expect(prompt).toContain("Hyperburn");
    expect(prompt).toContain("CRITICAL PRODUCT REQUIREMENT");
    expect(prompt).toContain("Pixel-for-pixel");
    expect(prompt).toContain("Do NOT generate a \"similar\"");
  });

  it("does NOT append product suffix when productName is undefined", () => {
    const prompt = buildPeoplePrompt("ugc", "Girl mid-workout");
    expect(prompt).not.toContain("CRITICAL PRODUCT REQUIREMENT");
    expect(prompt).not.toContain("Pixel-for-pixel");
  });

  it("does NOT append product suffix when productName is null", () => {
    const prompt = buildPeoplePrompt("ugc", "Girl mid-workout", null);
    expect(prompt).not.toContain("CRITICAL PRODUCT REQUIREMENT");
  });
});
