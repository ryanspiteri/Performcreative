import { describe, expect, it } from "vitest";
import {
  CONTENT_PILLARS,
  CONTENT_PURPOSES,
  CONTENT_FORMATS,
  SUBTITLE_STYLES,
  PLATFORMS,
} from "./services/_shared";

describe("Content Strategy Constants", () => {
  describe("CONTENT_PILLARS", () => {
    it("has exactly 8 entries", () => {
      expect(CONTENT_PILLARS).toHaveLength(8);
    });

    it("contains all expected pillar values", () => {
      expect(CONTENT_PILLARS).toContain("PTC Value");
      expect(CONTENT_PILLARS).toContain("Story");
      expect(CONTENT_PILLARS).toContain("Edutaining");
      expect(CONTENT_PILLARS).toContain("Trends");
      expect(CONTENT_PILLARS).toContain("Sale");
      expect(CONTENT_PILLARS).toContain("Motivation");
      expect(CONTENT_PILLARS).toContain("Life Dump");
      expect(CONTENT_PILLARS).toContain("Workout");
    });
  });

  describe("CONTENT_PURPOSES", () => {
    it("has exactly 5 entries", () => {
      expect(CONTENT_PURPOSES).toHaveLength(5);
    });

    it("contains all expected purpose values", () => {
      expect(CONTENT_PURPOSES).toContain("Educate");
      expect(CONTENT_PURPOSES).toContain("Inspire");
      expect(CONTENT_PURPOSES).toContain("Entertain");
      expect(CONTENT_PURPOSES).toContain("Sell");
      expect(CONTENT_PURPOSES).toContain("Connect");
    });
  });

  describe("CONTENT_FORMATS", () => {
    it("has exactly 5 entries", () => {
      expect(CONTENT_FORMATS).toHaveLength(5);
    });

    it("contains all expected format values", () => {
      expect(CONTENT_FORMATS).toContain("reel");
      expect(CONTENT_FORMATS).toContain("short_video");
      expect(CONTENT_FORMATS).toContain("post");
      expect(CONTENT_FORMATS).toContain("carousel");
      expect(CONTENT_FORMATS).toContain("story");
    });
  });

  describe("SUBTITLE_STYLES", () => {
    it("has exactly 4 entries (including 'none')", () => {
      expect(SUBTITLE_STYLES).toHaveLength(4);
    });

    it("contains all expected style ids", () => {
      const ids = SUBTITLE_STYLES.map((s) => s.id);
      expect(ids).toContain("tiktok_bold");
      expect(ids).toContain("minimal");
      expect(ids).toContain("karaoke");
      expect(ids).toContain("none");
    });

    it("each style has id, label, and description", () => {
      for (const style of SUBTITLE_STYLES) {
        expect(style).toHaveProperty("id");
        expect(style).toHaveProperty("label");
        expect(style).toHaveProperty("description");
        expect(typeof style.id).toBe("string");
        expect(typeof style.label).toBe("string");
        expect(typeof style.description).toBe("string");
      }
    });
  });

  describe("PLATFORMS", () => {
    it("has exactly 3 entries", () => {
      expect(PLATFORMS).toHaveLength(3);
    });

    it("contains all expected platform values", () => {
      expect(PLATFORMS).toContain("instagram");
      expect(PLATFORMS).toContain("tiktok");
      expect(PLATFORMS).toContain("linkedin");
    });
  });
});
