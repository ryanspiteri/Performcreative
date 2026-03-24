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
