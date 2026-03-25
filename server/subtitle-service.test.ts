import { describe, expect, it } from "vitest";
import { generateAssFile, type TranscriptionSegment } from "./services/subtitleService";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const SAMPLE_SEGMENTS: TranscriptionSegment[] = [
  { word: "Hello", start: 0.0, end: 0.5, confidence: 0.99 },
  { word: "world", start: 0.6, end: 1.0, confidence: 0.98 },
  { word: "this", start: 1.1, end: 1.3, confidence: 0.97 },
  { word: "is", start: 1.4, end: 1.5, confidence: 0.99 },
  { word: "a", start: 1.6, end: 1.7, confidence: 0.95 },
  { word: "test", start: 1.8, end: 2.2, confidence: 0.96 },
];

// ─── ASS file format helpers ────────────────────────────────────────────────

function hasScriptInfo(content: string): boolean {
  return content.includes("[Script Info]") && content.includes("ScriptType: v4.00+");
}

function hasStyleSection(content: string): boolean {
  return content.includes("[V4+ Styles]") && content.includes("Style: Default,");
}

function hasEventsSection(content: string): boolean {
  return content.includes("[Events]") && content.includes("Format: Layer, Start, End, Style");
}

function countDialogueLines(content: string): number {
  return (content.match(/^Dialogue:/gm) || []).length;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("generateAssFile", () => {
  describe("tiktok_bold style", () => {
    it("produces valid ASS content with all required sections", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "tiktok_bold");

      expect(result).toBeTruthy();
      expect(hasScriptInfo(result)).toBe(true);
      expect(hasStyleSection(result)).toBe(true);
      expect(hasEventsSection(result)).toBe(true);
    });

    it("uses bold font (Bold=1) and large font size", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "tiktok_bold");

      // Style line should contain Bold=1 and font size 72
      expect(result).toContain("Arial,72");
      // Bold is the 8th field (after BackColour): ,1, for bold
      expect(result).toMatch(/Style: Default,Arial,72,.*,1,0,0,0/);
    });

    it("creates dialogue events for each word segment", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "tiktok_bold");
      const dialogueCount = countDialogueLines(result);

      // tiktok_bold creates one dialogue event per word
      expect(dialogueCount).toBe(SAMPLE_SEGMENTS.length);
    });

    it("includes accent color for word highlighting", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "tiktok_bold");

      // Accent color in ASS BGR format
      expect(result).toContain("&H003838FF");
    });

    it("positions text centered at (960,800)", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "tiktok_bold");

      expect(result).toContain("\\an5\\pos(960,800)");
    });

    it("contains correct time formatting in dialogue events", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "tiktok_bold");

      // First segment starts at 0.0 -> "0:00:00.00"
      expect(result).toContain("0:00:00.00");
      // First segment ends at 0.5 -> "0:00:00.50"
      expect(result).toContain("0:00:00.50");
    });
  });

  describe("minimal style", () => {
    it("produces valid ASS content with all required sections", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "minimal");

      expect(result).toBeTruthy();
      expect(hasScriptInfo(result)).toBe(true);
      expect(hasStyleSection(result)).toBe(true);
      expect(hasEventsSection(result)).toBe(true);
    });

    it("uses non-bold font (Bold=0) and smaller font size", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "minimal");

      expect(result).toContain("Arial,48");
      // Bold field should be 0
      expect(result).toMatch(/Style: Default,Arial,48,.*,0,0,0,0/);
    });

    it("groups words into sentence chunks (fewer dialogue lines than words)", () => {
      // With only 6 words and no large gaps, they should form a single chunk
      const result = generateAssFile(SAMPLE_SEGMENTS, "minimal");
      const dialogueCount = countDialogueLines(result);

      // 6 words is less than the chunk limit (5-8), so should be 1 chunk
      expect(dialogueCount).toBeGreaterThanOrEqual(1);
      expect(dialogueCount).toBeLessThan(SAMPLE_SEGMENTS.length);
    });

    it("positions text at bottom (950) of screen", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "minimal");

      expect(result).toContain("\\an5\\pos(960,950)");
    });
  });

  describe("karaoke style", () => {
    it("produces valid ASS content with all required sections", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "karaoke");

      expect(result).toBeTruthy();
      expect(hasScriptInfo(result)).toBe(true);
      expect(hasStyleSection(result)).toBe(true);
      expect(hasEventsSection(result)).toBe(true);
    });

    it("uses bold font and medium font size", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "karaoke");

      expect(result).toContain("Arial,64");
      expect(result).toMatch(/Style: Default,Arial,64,.*,1,0,0,0/);
    });

    it("contains karaoke \\k timing tags", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "karaoke");

      // Karaoke uses \k tags with centisecond durations
      expect(result).toMatch(/\\k\d+/);
    });

    it("includes accent color for karaoke highlighting", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "karaoke");

      expect(result).toContain("&H003838FF");
    });

    it("groups words into sentence-like lines", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "karaoke");
      const dialogueCount = countDialogueLines(result);

      // 6 words should form 1 line (under the 6-10 word limit)
      expect(dialogueCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("'none' style", () => {
    it("returns empty string for 'none' style", () => {
      const result = generateAssFile(SAMPLE_SEGMENTS, "none");

      expect(result).toBe("");
    });
  });

  describe("empty segments", () => {
    it("returns empty string when no segments provided", () => {
      const result = generateAssFile([], "tiktok_bold");

      expect(result).toBe("");
    });
  });
});

describe("ASS time formatting (via output inspection)", () => {
  // formatTime is not exported, but we can verify its behavior through the generated ASS output

  it("converts 0 seconds correctly (0:00:00.00)", () => {
    const segments: TranscriptionSegment[] = [
      { word: "Start", start: 0, end: 0.5, confidence: 0.99 },
    ];
    const result = generateAssFile(segments, "tiktok_bold");

    expect(result).toContain("0:00:00.00");
  });

  it("converts 1.5 seconds correctly (0:00:01.50)", () => {
    const segments: TranscriptionSegment[] = [
      { word: "Mid", start: 1.5, end: 2.0, confidence: 0.99 },
    ];
    const result = generateAssFile(segments, "tiktok_bold");

    expect(result).toContain("0:00:01.50");
  });

  it("converts 65.12 seconds correctly (0:01:05.12)", () => {
    const segments: TranscriptionSegment[] = [
      { word: "Late", start: 65.12, end: 65.5, confidence: 0.99 },
    ];
    const result = generateAssFile(segments, "tiktok_bold");

    expect(result).toContain("0:01:05.12");
  });

  it("converts large values with hours correctly", () => {
    const segments: TranscriptionSegment[] = [
      { word: "Hour", start: 3661.5, end: 3662.0, confidence: 0.99 },
    ];
    const result = generateAssFile(segments, "tiktok_bold");

    // 3661.5s = 1h 1m 1.5s -> "1:01:01.50"
    expect(result).toContain("1:01:01.50");
  });
});
