/**
 * Shared utilities used across all pipelines.
 *
 * Centralises withTimeout, Claude API client, timeout constants,
 * and product info loading so changes propagate everywhere at once.
 */

import axios from "axios";
import { ENV } from "../_core/env";
import * as db from "../db";

// ─── Timeout utility ────────────────────────────────────────────────────────

/**
 * Race a promise against a timeout. Rejects with a descriptive error
 * if the promise doesn't settle within `ms` milliseconds.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

// ─── Shared timeout constants ───────────────────────────────────────────────

/** 10 minutes — used for Claude API calls and other long-running steps. */
export const STEP_TIMEOUT = 10 * 60 * 1000;

/** 4 minutes — used for individual image variation generation. */
export const VARIATION_TIMEOUT = 4 * 60 * 1000;

/** 90 minutes — outer ceiling for the entire Stage 4 (script generation + review loop). */
export const STAGE_4_TIMEOUT = 90 * 60 * 1000;

// ─── Claude (Anthropic) API client ──────────────────────────────────────────

/**
 * Shared axios instance for all Anthropic API calls.
 * Single place to configure API key, version header, and timeout.
 */
export const claudeClient = axios.create({
  baseURL: "https://api.anthropic.com/v1",
  headers: {
    "x-api-key": ENV.anthropicApiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  timeout: 600000,
});

/**
 * Convenience wrapper: send messages to Claude and get back the text response.
 */
export async function callClaude(
  messages: any[],
  system?: string,
  maxTokens = 4096
): Promise<string> {
  const body: any = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages };
  if (system) body.system = system;
  const res = await claudeClient.post("/messages", body);
  const content = res.data?.content;
  if (Array.isArray(content)) return content.map((c: any) => c.text || "").join("\n");
  return content?.text || JSON.stringify(content);
}

// ─── Product info context builder ───────────────────────────────────────────

/**
 * Load product info from the database and format it as a context string
 * suitable for injection into AI prompts.
 *
 * Returns an empty string (never throws) if the product has no info or
 * the DB call fails — callers already handle missing context gracefully.
 */
export async function buildProductInfoContext(product: string): Promise<string> {
  try {
    const info = await db.getProductInfo(product);
    if (info) {
      const parts: string[] = [];
      if ((info as any).ingredients) parts.push(`Ingredients: ${(info as any).ingredients}`);
      if ((info as any).benefits) parts.push(`Benefits: ${(info as any).benefits}`);
      if ((info as any).claims) parts.push(`Claims: ${(info as any).claims}`);
      if ((info as any).targetAudience) parts.push(`Target Audience: ${(info as any).targetAudience}`);
      if ((info as any).keySellingPoints) parts.push(`Key Selling Points: ${(info as any).keySellingPoints}`);
      if ((info as any).flavourVariants) parts.push(`Flavour Variants: ${(info as any).flavourVariants}`);
      if ((info as any).pricing) parts.push(`Pricing: ${(info as any).pricing}`);
      if ((info as any).additionalNotes) parts.push(`Notes: ${(info as any).additionalNotes}`);
      return parts.join("\n");
    }
  } catch (err: any) {
    console.warn(`[Shared] Failed to load product info for ${product}:`, err.message);
  }
  return "";
}

// ─── Concurrency helper ─────────────────────────────────────────────────────

/**
 * Run async tasks with a concurrency limit.
 * Returns results in the same order as the input tasks.
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── URL & Path validation (SSRF + traversal protection) ────────────────

const ALLOWED_URL_DOMAINS = [
  "s3.amazonaws.com",
  "s3.us-east-1.amazonaws.com",
  "s3.ap-southeast-2.amazonaws.com",
  "foreplay-ads.s3.amazonaws.com",
  "cdn.foreplay.co",
  "manuscdn.com",
  "files.manuscdn.com",
];

const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm"];

/**
 * Validate a URL against the domain allowlist. Rejects private IPs and non-allowed domains.
 * Throws on invalid/disallowed URLs.
 */
export function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname;
  // Block private/internal IPs
  if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|localhost|::1)/.test(hostname)) {
    throw new Error(`Disallowed internal address: ${hostname}`);
  }
  const allowed = ALLOWED_URL_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
  if (!allowed) {
    throw new Error(`Domain not in allowlist: ${hostname}`);
  }
}

/**
 * Validate a local file path. Ensures it's under the allowed base directory,
 * contains no traversal sequences, and has an allowed video extension.
 * Throws on invalid paths.
 */
export function validateLocalPath(filePath: string, basePath: string): void {
  if (!basePath) {
    throw new Error("LOCAL_MEDIA_BASE_PATH not configured — local file access disabled");
  }
  if (!filePath) {
    throw new Error("File path is required");
  }
  if (filePath.includes("..")) {
    throw new Error("Path traversal detected: '..' not allowed");
  }
  const resolved = filePath.startsWith("/") ? filePath : `${basePath}/${filePath}`;
  if (!resolved.startsWith(basePath)) {
    throw new Error(`Path must be under ${basePath}`);
  }
  const ext = resolved.substring(resolved.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file extension: ${ext}. Allowed: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}`);
  }
}

/**
 * Determine if input is a URL or local file path.
 * Validates accordingly and returns the normalized input.
 */
export function validateVideoInput(input: string, localBasePath: string): { type: "url" | "local"; path: string } {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    validateUrl(input);
    return { type: "url", path: input };
  }
  validateLocalPath(input, localBasePath);
  return { type: "local", path: input };
}

// ─── Content strategy framework ─────────────────────────────────────────

export const CONTENT_PILLARS = [
  "PTC Value",
  "Story",
  "Edutaining",
  "Trends",
  "Sale",
  "Motivation",
  "Life Dump",
  "Workout",
] as const;
export type ContentPillar = typeof CONTENT_PILLARS[number];

export const CONTENT_PURPOSES = [
  "Educate",
  "Inspire",
  "Entertain",
  "Sell",
  "Connect",
] as const;
export type ContentPurpose = typeof CONTENT_PURPOSES[number];

export const CONTENT_FORMATS = [
  "reel",
  "short_video",
  "post",
  "carousel",
  "story",
] as const;
export type ContentFormat = typeof CONTENT_FORMATS[number];

export const SUBTITLE_STYLES = [
  { id: "tiktok_bold", label: "TikTok Bold", description: "Word-by-word highlight, large centered text, shadow" },
  { id: "minimal", label: "Minimal Lower Third", description: "Sentence blocks at bottom, smaller font, clean" },
  { id: "karaoke", label: "Karaoke", description: "Words highlight as spoken, colored accent" },
  { id: "none", label: "None", description: "No subtitles" },
] as const;
export type SubtitleStyle = typeof SUBTITLE_STYLES[number]["id"];

export const PLATFORMS = ["instagram", "tiktok", "linkedin"] as const;
export type Platform = typeof PLATFORMS[number];

// ─── Shared types ───────────────────────────────────────────────────────────

/** Selection data passed from the UI selection gate to image generation. */
export interface ImageSelections {
  images: Array<{
    headline: string;
    subheadline: string | null;
    background: {
      type: "uploaded" | "preset" | "flux";
      url?: string;
      presetId?: string;
      title: string;
      description?: string;
      prompt?: string;
    };
  }>;
  benefits: string;
  productRenderUrl?: string;
  bannerbearTemplate?: string;
}
