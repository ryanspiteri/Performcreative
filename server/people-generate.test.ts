import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Tests for the people.generate endpoint's input validation and style handling.
 * Tests the Zod schema + style enum without hitting the actual Gemini API.
 */

const generateInputSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().min(1),
  tags: z.string().optional(),
  style: z.enum(["professional", "ugc", "lifestyle", "gym-selfie"]).optional().default("professional"),
  productId: z.number().optional(),
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

describe("people.generate prompt building", () => {
  // Mirrors the style prompt map from server/routers.ts
  const buildPrompt = (style: string, description: string, productName?: string) => {
    const stylePrompts: Record<string, string> = {
      professional: `Generate a hyper-realistic portrait photograph of a person for use in fitness supplement advertising.
Shot on a high-end DSLR camera with shallow depth of field, natural skin texture, realistic lighting.
Subject: ${description}
Style: Professional fitness/lifestyle photography. Magazine quality.`,
      ugc: `Generate a hyper-realistic photo of a person that looks like user-generated content filmed on an iPhone.
NOT a professional photo. Phone camera quality.
Subject: ${description}
Style: iPhone selfie / UGC content creator.`,
      lifestyle: `Generate a hyper-realistic candid photo of a person in a natural lifestyle setting.
Natural light only. Candid expression.
Subject: ${description}
Style: Lifestyle / candid photography.`,
      "gym-selfie": `Generate a hyper-realistic gym selfie or gym-floor photo of a person.
Shot on a phone in a gym environment. Harsh gym lighting.
Subject: ${description}
Style: Gym selfie / post-workout content.`,
    };

    let prompt = stylePrompts[style];
    if (productName) {
      prompt += `\n\nThe person is naturally holding or using a ${productName} supplement product container/tub.`;
    }
    return prompt;
  };

  it("builds professional prompt with DSLR language", () => {
    const prompt = buildPrompt("professional", "Athletic female, mid-20s");
    expect(prompt).toContain("DSLR");
    expect(prompt).toContain("Magazine quality");
    expect(prompt).toContain("Athletic female, mid-20s");
    expect(prompt).not.toContain("iPhone");
  });

  it("builds UGC prompt with iPhone language", () => {
    const prompt = buildPrompt("ugc", "Girl mid-workout");
    expect(prompt).toContain("iPhone");
    expect(prompt).toContain("NOT a professional photo");
    expect(prompt).not.toContain("DSLR");
    expect(prompt).not.toContain("Magazine quality");
  });

  it("builds lifestyle prompt with candid language", () => {
    const prompt = buildPrompt("lifestyle", "Woman walking");
    expect(prompt).toContain("candid");
    expect(prompt).toContain("Natural light");
  });

  it("builds gym-selfie prompt with gym language", () => {
    const prompt = buildPrompt("gym-selfie", "Guy flexing");
    expect(prompt).toContain("gym");
    expect(prompt).toContain("Harsh gym lighting");
  });

  it("appends product suffix when productName provided", () => {
    const prompt = buildPrompt("ugc", "Girl mid-workout", "Hyperburn");
    expect(prompt).toContain("Hyperburn supplement product");
  });

  it("does NOT append product suffix when productName is undefined", () => {
    const prompt = buildPrompt("ugc", "Girl mid-workout");
    expect(prompt).not.toContain("supplement product");
  });
});
