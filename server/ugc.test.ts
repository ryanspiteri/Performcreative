import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

const hasForgeKey = !!ENV.forgeApiKey?.trim();

describe("UGC Clone Engine", () => {
  describe("Structure Extraction", () => {
    it("should extract structure blueprint from transcript", async () => {
      if (!hasForgeKey) return; // Skip: requires BUILT_IN_FORGE_API_KEY
      const sampleTranscript = `
        Hey, are you tired of feeling sluggish all day? I was too, until I discovered Hyperburn.
        This thermogenic powerhouse has completely transformed my energy levels.
        It's packed with natural ingredients that boost your metabolism and suppress your appetite.
        I've lost 8 kilos in just 6 weeks, and I feel amazing.
        Don't wait - grab your bottle today and start your transformation!
      `;

      const blueprint = await extractStructureBlueprint(sampleTranscript, "Hyperburn");

      expect(blueprint).toBeDefined();
      expect(blueprint.hook).toBeDefined();
      expect(blueprint.hook.text).toBeTruthy();
      expect(blueprint.body).toBeDefined();
      expect(blueprint.cta).toBeDefined();
      expect(blueprint.pacing).toBeDefined();
      expect(blueprint.pacing.energyLevel).toMatch(/high|medium|low/);
      
      console.log("[Test] Structure blueprint extracted successfully");
      console.log(`[Test] Hook: ${blueprint.hook.text.substring(0, 50)}...`);
      console.log(`[Test] Energy Level: ${blueprint.pacing.energyLevel}`);
    }, 30000); // 30s timeout for LLM call
  });

  describe("Variant Generation", () => {
    it("should generate controlled script variants", async () => {
      if (!hasForgeKey) return; // Skip: requires BUILT_IN_FORGE_API_KEY
      const mockBlueprint = {
        hook: {
          text: "Hey, are you tired of feeling sluggish all day?",
          startTime: 0,
          endTime: 3,
          strength: "strong" as const,
        },
        body: {
          text: "This thermogenic powerhouse has completely transformed my energy levels. It's packed with natural ingredients that boost your metabolism and suppress your appetite.",
          startTime: 3,
          endTime: 12,
          keyPoints: ["boosts metabolism", "suppresses appetite", "natural ingredients"],
        },
        cta: {
          text: "Don't wait - grab your bottle today and start your transformation!",
          startTime: 12,
          endTime: 15,
          urgency: "high" as const,
        },
        pacing: {
          wordsPerMinute: 150,
          pauseCount: 3,
          energyLevel: "high" as const,
        },
        complianceLanguage: ["natural ingredients"],
        structuralNotes: "Fast-paced, energetic delivery with clear problem-solution-CTA structure",
      };

      const variants = await generateVariants({
        uploadId: 1,
        product: "Hyperburn",
        audienceTag: "fitness enthusiasts",
        desiredOutputVolume: 5,
        structureBlueprint: mockBlueprint,
        transcript: "Sample transcript",
      });

      expect(variants).toBeDefined();
      expect(variants.length).toBe(5);
      
      // Check that each variant has required fields
      for (const variant of variants) {
        expect(variant.variantNumber).toBeGreaterThan(0);
        expect(variant.actorArchetype).toBeTruthy();
        expect(variant.voiceTone).toBeTruthy();
        expect(variant.energyLevel).toMatch(/high|medium|low/);
        expect(variant.scriptText).toBeTruthy();
        expect(variant.runtime).toBeGreaterThan(0);
      }

      // Check that variants have different archetypes/tones (not all the same)
      const uniqueArchetypes = new Set(variants.map((v) => v.actorArchetype));
      expect(uniqueArchetypes.size).toBeGreaterThan(1);

      console.log("[Test] Generated 5 variants successfully");
      console.log(`[Test] Unique archetypes: ${Array.from(uniqueArchetypes).join(", ")}`);
      console.log(`[Test] Sample variant: ${variants[0].actorArchetype} / ${variants[0].voiceTone} / ${variants[0].energyLevel}`);
    }, 60000); // 60s timeout for multiple LLM calls
  });
});
