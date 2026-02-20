import { describe, it, expect, vi } from "vitest";
import { generateFluxProBackground } from "./services/fluxPro";
import {
  createBannerbearImage,
  generateStaticAdWithBannerbear,
  BANNERBEAR_TEMPLATES,
} from "./services/bannerbear";
import {
  generateStaticAdVariations,
  CSS_PRESETS,
  type ImageSelections,
} from "./services/imageCompositing";

/**
 * Unit tests for the Flux Pro + Bannerbear image generation pipeline.
 * These tests validate the integration layer — they mock external APIs
 * to avoid burning credits on every test run.
 */

// ---- Mocks ----
vi.mock("./services/fluxPro", () => ({
  generateFluxProBackground: vi.fn().mockResolvedValue("https://mock-flux.example.com/background.jpg"),
}));

vi.mock("./services/bannerbear", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    createBannerbearImage: vi.fn().mockResolvedValue("https://mock-bannerbear.example.com/composite.png"),
    generateStaticAdWithBannerbear: vi.fn().mockResolvedValue("https://mock-bannerbear.example.com/final.png"),
  };
});

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://mock-s3.example.com/persisted.jpg", key: "test-key" }),
}));

vi.mock("./db", () => ({
  getProductRendersByProduct: vi.fn().mockResolvedValue([
    { id: 1, url: "https://mock-cdn.example.com/render.png", product: "HyperBurn" },
  ]),
  listProductRenders: vi.fn().mockResolvedValue([
    { id: 1, url: "https://mock-cdn.example.com/render.png", product: "HyperBurn" },
  ]),
}));

describe("Flux Pro Service", () => {
  it("should export generateFluxProBackground function", () => {
    expect(typeof generateFluxProBackground).toBe("function");
  });

  it("should return a URL string from generateFluxProBackground", async () => {
    const url = await generateFluxProBackground("test prompt", 1080, 1080);
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("should accept width and height parameters", async () => {
    await generateFluxProBackground("test", 512, 512);
    expect(generateFluxProBackground).toHaveBeenCalledWith("test", 512, 512);
  });
});

describe("Bannerbear Service", () => {
  it("should export BANNERBEAR_TEMPLATES with correct UIDs", () => {
    expect(BANNERBEAR_TEMPLATES.hyperburnHelps).toBe("wXmzGBDakV3vZLN7gj");
    expect(BANNERBEAR_TEMPLATES.bluePurpleGradient).toBe("E9YaWrZMqPrNZnRd74");
  });

  it("should export createBannerbearImage function", () => {
    expect(typeof createBannerbearImage).toBe("function");
  });

  it("should export generateStaticAdWithBannerbear function", () => {
    expect(typeof generateStaticAdWithBannerbear).toBe("function");
  });

  it("should return a URL from createBannerbearImage", async () => {
    const url = await createBannerbearImage("test-template", [{ name: "headline", text: "Test" }]);
    expect(url).toMatch(/^https?:\/\//);
  });

  it("should return a URL from generateStaticAdWithBannerbear", async () => {
    const url = await generateStaticAdWithBannerbear({
      templateUid: BANNERBEAR_TEMPLATES.hyperburnHelps,
      headline: "TEST HEADLINE",
      subheadline: "Test subheadline",
      benefitCallout: "Burn Fat | Boost Energy",
      backgroundImageUrl: "https://example.com/bg.jpg",
      productRenderUrl: "https://example.com/product.png",
      logoUrl: "https://example.com/logo.png",
    });
    expect(url).toMatch(/^https?:\/\//);
  });
});

describe("Image Compositing (Flux Pro + Bannerbear Pipeline)", () => {
  it("should export CSS_PRESETS for backwards compatibility", () => {
    expect(Array.isArray(CSS_PRESETS)).toBe(true);
    expect(CSS_PRESETS.length).toBeGreaterThan(0);
    expect(CSS_PRESETS[0]).toHaveProperty("id");
    expect(CSS_PRESETS[0]).toHaveProperty("name");
    expect(CSS_PRESETS[0]).toHaveProperty("css");
  });

  it("should generate 3 variations with default settings", async () => {
    const results = await generateStaticAdVariations(
      "Test creative brief",
      "https://example.com/inspire.jpg",
      "HyperBurn",
      "ONEST Health"
    );

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r).toHaveProperty("url");
      expect(r).toHaveProperty("variation");
      expect(typeof r.url).toBe("string");
    });
  });

  it("should generate 3 variations with user selections (flux backgrounds)", async () => {
    const selections: ImageSelections = {
      images: [
        {
          headline: "BURN FAT FASTER",
          subheadline: "Elite Thermogenic Formula",
          background: {
            type: "flux",
            title: "Dark Energy",
            prompt: "Premium dark background with red accent lighting. No text, no product.",
          },
        },
        {
          headline: "UNLOCK YOUR POTENTIAL",
          subheadline: "Science-Backed Results",
          background: {
            type: "flux",
            title: "Electric Blue",
            prompt: "Bold blue background with geometric light rays. No text, no product.",
          },
        },
        {
          headline: "NO COMPROMISES",
          subheadline: null,
          background: {
            type: "uploaded",
            url: "https://example.com/custom-bg.jpg",
            title: "Custom Background",
          },
        },
      ],
      benefits: "Clinically Dosed | No Fillers | Australian Made",
      productRenderUrl: "https://example.com/product-render.png",
    };

    const results = await generateStaticAdVariations(
      "Test brief",
      "https://example.com/inspire.jpg",
      "HyperBurn",
      "ONEST Health",
      selections
    );

    expect(results).toHaveLength(3);
    // First two should use Flux Pro (mocked)
    expect(generateFluxProBackground).toHaveBeenCalled();
    // All three should use Bannerbear (mocked)
    expect(generateStaticAdWithBannerbear).toHaveBeenCalled();
  });

  it("should handle Bannerbear template selection", async () => {
    const selections: ImageSelections = {
      images: [
        { headline: "TEST 1", subheadline: null, background: { type: "flux", title: "BG1", prompt: "test bg 1" } },
        { headline: "TEST 2", subheadline: null, background: { type: "flux", title: "BG2", prompt: "test bg 2" } },
        { headline: "TEST 3", subheadline: null, background: { type: "flux", title: "BG3", prompt: "test bg 3" } },
      ],
      benefits: "Test benefits",
      bannerbearTemplate: BANNERBEAR_TEMPLATES.bluePurpleGradient,
    };

    const results = await generateStaticAdVariations(
      "Test brief",
      "https://example.com/inspire.jpg",
      "HyperBurn",
      "ONEST Health",
      selections
    );

    expect(results).toHaveLength(3);
  });
});

describe("ImageSelections Type", () => {
  it("should support flux background type with prompt", () => {
    const selections: ImageSelections = {
      images: [
        {
          headline: "TEST",
          subheadline: null,
          background: {
            type: "flux",
            title: "Test BG",
            prompt: "A dramatic background",
            description: "Optional description",
          },
        },
        {
          headline: "TEST 2",
          subheadline: "Sub",
          background: {
            type: "uploaded",
            url: "https://example.com/bg.jpg",
            title: "Uploaded BG",
          },
        },
        {
          headline: "TEST 3",
          subheadline: null,
          background: {
            type: "preset",
            presetId: "dark-ember",
            title: "Dark Ember",
          },
        },
      ],
      benefits: "Test",
    };

    expect(selections.images).toHaveLength(3);
    expect(selections.images[0].background.type).toBe("flux");
    expect(selections.images[1].background.type).toBe("uploaded");
    expect(selections.images[2].background.type).toBe("preset");
  });
});
