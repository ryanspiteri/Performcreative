/**
 * FFmpeg-based subtitle burn-in service.
 *
 * Generates ASS (Advanced SubStation Alpha) subtitle files from word-level
 * transcription segments and renders them onto video using fluent-ffmpeg.
 */

// @ts-expect-error -- no @types/fluent-ffmpeg; package ships untyped JS
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import ffmpegStatic from "ffmpeg-static";

import { storagePut } from "../storage";
import { withTimeout, type SubtitleStyle } from "./_shared";

// Point fluent-ffmpeg at the ffmpeg-static binary when available
if (ffmpegStatic && typeof ffmpegStatic === "string" && fs.existsSync(ffmpegStatic)) {
  (ffmpeg as any).setFfmpegPath(ffmpegStatic);
  console.log("[Subtitle] Using ffmpeg-static binary:", ffmpegStatic);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TranscriptionSegment {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
  confidence: number;
}

// Re-export SubtitleStyle from _shared for convenience
export type { SubtitleStyle };

// ─── Constants ──────────────────────────────────────────────────────────────

const RENDER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Converts seconds to ASS time format: "H:MM:SS.CC" (centiseconds).
 * e.g., 1.5 -> "0:00:01.50", 65.123 -> "0:01:05.12"
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Escape special ASS characters in text.
 */
function escapeAss(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

// ─── ASS Generation ─────────────────────────────────────────────────────────

/**
 * Generate the [Script Info] and [V4+ Styles] header for an ASS file.
 */
function buildAssHeader(
  fontName: string,
  fontSize: number,
  bold: 0 | 1,
  outline: number,
  shadow: number,
  marginV: number,
  borderStyle: 1 | 3 = 1,
): string {
  return [
    "[Script Info]",
    "Title: Subtitles",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, StrikeOut, Underline, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000038FF,&H00000000,&H80000000,${bold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,10,10,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
}

/**
 * tiktok_bold style: word-by-word display with highlight color on active word.
 * Each word appears as a separate dialogue event. The active word is shown
 * in accent color (#FF3838 -> ASS &H003838FF in BGR).
 */
function generateTiktokBold(segments: TranscriptionSegment[]): string {
  const header = buildAssHeader("Arial", 72, 1, 3, 2, 10);
  const accentColor = "&H003838FF"; // #FF3838 in ASS BGR format

  const events: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const word = escapeAss(seg.word.trim());
    if (!word) continue;

    // Build context: show surrounding words, highlight the active one
    const contextStart = Math.max(0, i - 2);
    const contextEnd = Math.min(segments.length - 1, i + 2);

    let text = "{\\an5\\pos(960,800)}";
    for (let j = contextStart; j <= contextEnd; j++) {
      const w = escapeAss(segments[j].word.trim());
      if (!w) continue;
      if (j === i) {
        // Active word: accent color
        text += `{\\c${accentColor}}${w}{\\c&H00FFFFFF} `;
      } else {
        text += `${w} `;
      }
    }

    events.push(
      `Dialogue: 0,${formatTime(seg.start)},${formatTime(seg.end)},Default,,0,0,0,,${text.trim()}`
    );
  }

  return header + "\n" + events.join("\n") + "\n";
}

/**
 * minimal style: sentence blocks grouped by ~5-8 words, positioned at bottom third.
 * Chunks are split on natural pauses (gaps > 0.3s between words).
 */
function generateMinimal(segments: TranscriptionSegment[]): string {
  const header = buildAssHeader("Arial", 48, 0, 1, 0, 10);

  // Group words into chunks based on natural pauses or word count
  const chunks: TranscriptionSegment[][] = [];
  let current: TranscriptionSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    current.push(seg);

    const isLast = i === segments.length - 1;
    const gap = isLast ? 0 : segments[i + 1].start - seg.end;
    const atLimit = current.length >= 8;
    const atNaturalPause = gap > 0.3 && current.length >= 5;

    if (isLast || atLimit || atNaturalPause) {
      chunks.push(current);
      current = [];
    }
  }

  const events: string[] = [];
  for (const chunk of chunks) {
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text = chunk.map(s => escapeAss(s.word.trim())).filter(Boolean).join(" ");
    events.push(
      `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5\\pos(960,950)}${text}`
    );
  }

  return header + "\n" + events.join("\n") + "\n";
}

/**
 * karaoke style: uses ASS \k tags for progressive word highlighting.
 * Each line is a sentence-length block with karaoke timing per word.
 * Highlight color: #FF3838.
 */
function generateKaraoke(segments: TranscriptionSegment[]): string {
  const header = buildAssHeader("Arial", 64, 1, 2, 1, 10);

  // Group into sentence-like lines (6-10 words, or split on large gaps)
  const lines: TranscriptionSegment[][] = [];
  let current: TranscriptionSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    current.push(seg);

    const isLast = i === segments.length - 1;
    const gap = isLast ? 0 : segments[i + 1].start - seg.end;
    const atLimit = current.length >= 10;
    const atNaturalPause = gap > 0.5 && current.length >= 6;

    if (isLast || atLimit || atNaturalPause) {
      lines.push(current);
      current = [];
    }
  }

  const accentColor = "&H003838FF"; // #FF3838 in BGR
  const events: string[] = [];

  for (const line of lines) {
    const lineStart = line[0].start;
    const lineEnd = line[line.length - 1].end;

    // Build karaoke text with \k tags
    // \k duration is in centiseconds
    let text = `{\\an5\\pos(960,800)\\1c${accentColor}}`;
    for (const seg of line) {
      const duration = Math.round((seg.end - seg.start) * 100);
      text += `{\\k${duration}}${escapeAss(seg.word.trim())} `;
    }

    events.push(
      `Dialogue: 0,${formatTime(lineStart)},${formatTime(lineEnd)},Default,,0,0,0,,${text.trim()}`
    );
  }

  return header + "\n" + events.join("\n") + "\n";
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate an ASS subtitle file from word-level transcription segments.
 *
 * @param segments - Word-level transcription data with timing info
 * @param style    - Subtitle style preset
 * @returns Full ASS file content as a string, or empty string for "none"
 */
export function generateAssFile(segments: TranscriptionSegment[], style: SubtitleStyle): string {
  if (style === "none" || !segments.length) {
    return "";
  }

  console.log(`[Subtitle] Generating ASS file: style=${style}, segments=${segments.length}`);

  switch (style) {
    case "tiktok_bold":
      return generateTiktokBold(segments);
    case "minimal":
      return generateMinimal(segments);
    case "karaoke":
      return generateKaraoke(segments);
    default:
      console.warn(`[Subtitle] Unknown style "${style}", falling back to tiktok_bold`);
      return generateTiktokBold(segments);
  }
}

/**
 * Burn subtitles into a video file.
 *
 * 1. Downloads the video from the given URL
 * 2. Writes the ASS content to a temp file
 * 3. Uses fluent-ffmpeg to burn subtitles via the `ass` video filter
 * 4. Uploads the result to S3
 * 5. Cleans up temp files
 *
 * If assContent is empty (style "none"), returns the original video URL.
 *
 * @param videoUrl   - URL of the source video
 * @param assContent - Full ASS subtitle file content
 * @param outputKey  - S3 key for the output file
 * @returns S3 URL of the subtitled video
 */
export async function renderSubtitles(
  videoUrl: string,
  assContent: string,
  outputKey: string,
): Promise<string> {
  // "none" style: skip processing and return the original URL
  if (!assContent) {
    console.log("[Subtitle] No subtitle content provided, returning original video URL");
    return videoUrl;
  }

  const run = async (): Promise<string> => {
    const tmpDir = os.tmpdir();
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const videoPath = path.join(tmpDir, `sub_input_${uid}.mp4`);
    const assPath = path.join(tmpDir, `sub_${uid}.ass`);
    const outputPath = path.join(tmpDir, `sub_output_${uid}.mp4`);

    try {
      // 1. Download source video
      console.log("[Subtitle] Downloading video from:", videoUrl);
      const response = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 500 * 1024 * 1024, // 500MB max
      });
      fs.writeFileSync(videoPath, Buffer.from(response.data));
      console.log("[Subtitle] Video downloaded, size:", fs.statSync(videoPath).size, "bytes");

      // 2. Write ASS file
      fs.writeFileSync(assPath, assContent, "utf-8");
      console.log("[Subtitle] ASS file written to:", assPath);

      // 3. Burn subtitles with ffmpeg
      console.log("[Subtitle] Burning subtitles with ffmpeg...");
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .videoFilter(`ass=${assPath}`)
          .output(outputPath)
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      const outputSize = fs.statSync(outputPath).size;
      console.log("[Subtitle] Subtitled video rendered, size:", outputSize, "bytes");

      if (outputSize === 0) {
        throw new Error("Rendered video file is empty");
      }

      // 4. Upload to S3
      console.log("[Subtitle] Uploading subtitled video to:", outputKey);
      const videoData = fs.readFileSync(outputPath);
      const { url } = await storagePut(outputKey, videoData, "video/mp4");
      console.log("[Subtitle] Upload complete:", url);

      return url;
    } finally {
      // 5. Clean up temp files
      for (const f of [videoPath, assPath, outputPath]) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  };

  return withTimeout(run(), RENDER_TIMEOUT, "Subtitle render");
}
