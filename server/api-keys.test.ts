import { describe, it, expect } from "vitest";
import { generateFluxProBackground } from "./services/fluxPro";
import { createBannerbearImage, BANNERBEAR_TEMPLATES } from "./services/bannerbear";

describe("API Keys Validation", () => {
  it("should validate Flux Pro API key with a simple generation", async () => {
    // Simple test prompt
    const testPrompt = "A clean white background";
    
    // This will throw if API key is invalid
    const imageUrl = await generateFluxProBackground(testPrompt, 512, 512);
    
    expect(imageUrl).toBeDefined();
    expect(typeof imageUrl).toBe("string");
    expect(imageUrl).toMatch(/^https?:\/\//);
    
    console.log("[Test] Flux Pro API key validated successfully");
    console.log("[Test] Generated image URL:", imageUrl);
  }, 180000); // 3 minute timeout for image generation

  it("should validate Bannerbear API key with a simple template render", async () => {
    // Use the first template with minimal modifications
    const templateUid = BANNERBEAR_TEMPLATES.hyperburnHelps;
    
    const modifications = [
      {
        name: "headline",
        text: "API Test",
      },
    ];
    
    // This will throw if API key is invalid
    const imageUrl = await createBannerbearImage(templateUid, modifications);
    
    expect(imageUrl).toBeDefined();
    expect(typeof imageUrl).toBe("string");
    expect(imageUrl).toMatch(/^https?:\/\//);
    
    console.log("[Test] Bannerbear API key validated successfully");
    console.log("[Test] Generated image URL:", imageUrl);
  }, 120000); // 2 minute timeout for image generation
});
