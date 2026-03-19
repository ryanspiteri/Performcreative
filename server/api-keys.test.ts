import { describe, it, expect } from "vitest";
import { generateFluxProBackground } from "./services/fluxPro";
import { BANNERBEAR_TEMPLATES } from "./services/bannerbear";

describe("API Keys Validation", () => {
  it("should validate Flux Pro API key with a simple generation", async () => {
    if (!process.env.FLUX_PRO_API_KEY) return; // Skip when key not configured
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

  it("should validate Bannerbear API key by fetching template info", async () => {
    if (!process.env.BANNERBEAR_API_KEY) return; // Skip when key not configured
    const { getTemplateInfo } = await import("./services/bannerbear");
    const templateUid = BANNERBEAR_TEMPLATES.staticAd1;
    const info = await getTemplateInfo(templateUid);
    
    expect(info).toBeDefined();
    expect(info.uid).toBe(templateUid);
    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThan(0);
    
    console.log(`[Test] Bannerbear API key validated successfully`);
    console.log(`[Test] Template: ${info.name} (${info.width}x${info.height})`);
    console.log(`[Test] Layers: ${(info.available_modifications || []).length}`);
    
    // Note: If template has 0 layers, it means the user hasn't set up
    // dynamic layers yet. The Template Tester page will guide them.
    if ((info.available_modifications || []).length === 0) {
      console.log(`[Test] ⚠️ Template has no dynamic layers — user needs to add layers in Bannerbear editor`);
    }
  }, 30000); // 30 second timeout for API call
});
