import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set env before importing
process.env.BANNERBEAR_API_KEY = "test_key_123";

describe("Bannerbear Layer Validation", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should detect missing layers from template", async () => {
    // Mock the template info endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uid: "test_template",
        name: "Test Template",
        width: 1080,
        height: 1080,
        available_modifications: [
          { name: "headline", type: "text" },
          { name: "background", type: "image" },
          // Missing: subheadline, product_image, logo, benefit_callout
        ],
      }),
    });

    const { validateModifications } = await import("./services/bannerbear");

    const result = await validateModifications("test_template", [
      { name: "headline", text: "TEST" },
      { name: "subheadline", text: "Sub" },
      { name: "background", image_url: "https://example.com/bg.jpg" },
      { name: "product_image", image_url: "https://example.com/product.png" },
      { name: "logo", image_url: "https://example.com/logo.png" },
      { name: "benefit_callout", text: "Benefits" },
    ]);

    expect(result.valid).toBe(false);
    expect(result.matchedLayers).toContain("headline");
    expect(result.matchedLayers).toContain("background");
    expect(result.missingFromTemplate).toContain("subheadline");
    expect(result.missingFromTemplate).toContain("product_image");
    expect(result.missingFromTemplate).toContain("logo");
    expect(result.missingFromTemplate).toContain("benefit_callout");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should pass validation when all layers match", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uid: "perfect_template",
        name: "Perfect Template",
        width: 1080,
        height: 1080,
        available_modifications: [
          { name: "headline", type: "text" },
          { name: "subheadline", type: "text" },
          { name: "background", type: "image" },
          { name: "product_image", type: "image" },
          { name: "logo", type: "image" },
          { name: "benefit_callout", type: "text" },
        ],
      }),
    });

    const { validateModifications } = await import("./services/bannerbear");

    const result = await validateModifications("perfect_template", [
      { name: "headline", text: "TEST" },
      { name: "subheadline", text: "Sub" },
      { name: "background", image_url: "https://example.com/bg.jpg" },
      { name: "product_image", image_url: "https://example.com/product.png" },
      { name: "logo", image_url: "https://example.com/logo.png" },
      { name: "benefit_callout", text: "Benefits" },
    ]);

    expect(result.valid).toBe(true);
    expect(result.missingFromTemplate).toHaveLength(0);
    expect(result.matchedLayers).toHaveLength(6);
  });

  it("should identify extra layers in template not being used", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uid: "extra_layers_template",
        name: "Extra Layers Template",
        width: 1080,
        height: 1080,
        available_modifications: [
          { name: "headline", type: "text" },
          { name: "background", type: "image" },
          { name: "custom_badge", type: "image" },
          { name: "promo_text", type: "text" },
        ],
      }),
    });

    const { validateModifications } = await import("./services/bannerbear");

    const result = await validateModifications("extra_layers_template", [
      { name: "headline", text: "TEST" },
      { name: "background", image_url: "https://example.com/bg.jpg" },
    ]);

    expect(result.valid).toBe(true); // All requested layers exist
    expect(result.extraInTemplate).toContain("custom_badge");
    expect(result.extraInTemplate).toContain("promo_text");
  });

  it("should list all templates from Bannerbear API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          uid: "template_1",
          name: "Template One",
          width: 1080,
          height: 1080,
          available_modifications: [
            { name: "headline", type: "text" },
            { name: "background", type: "image" },
          ],
          preview_url: "https://example.com/preview1.png",
          tags: ["test"],
        },
        {
          uid: "template_2",
          name: "Template Two",
          width: 1080,
          height: 1350,
          available_modifications: [
            { name: "headline", type: "text" },
          ],
          preview_url: "https://example.com/preview2.png",
          tags: [],
        },
      ]),
    });

    const { listBannerbearTemplates } = await import("./services/bannerbear");

    const templates = await listBannerbearTemplates();

    expect(templates).toHaveLength(2);
    expect(templates[0].uid).toBe("template_1");
    expect(templates[0].name).toBe("Template One");
    expect(templates[0].layers).toContain("headline");
    expect(templates[0].layers).toContain("background");
    expect(templates[1].uid).toBe("template_2");
    expect(templates[1].layers).toHaveLength(1);
  });

  it("should handle Bannerbear API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const { getTemplateInfo } = await import("./services/bannerbear");

    await expect(getTemplateInfo("bad_template")).rejects.toThrow("Failed to fetch template info (401)");
  });
});
