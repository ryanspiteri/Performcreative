/**
 * AutoEdit Python Service — HTTP Client
 *
 * Communicates with the AutoEdit video-editing service which may run
 * locally (dev) or remotely (Docker / cloud).
 *
 * Endpoints:
 *   GET  /api/v1/health         — liveness check
 *   POST /api/v1/process-video  — full edit pipeline (cut + subtitle + thumbnail)
 *   POST /api/v1/transcribe     — transcription only
 *   GET  /api/v1/styles         — available editing style presets
 */

import axios from "axios";
import { ENV } from "../_core/env";
import { withTimeout, STEP_TIMEOUT } from "./_shared";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TranscriptionSegment {
  word: string;
  start: number;   // seconds
  end: number;     // seconds
  confidence: number; // 0–1
}

export interface ProcessVideoResult {
  outputUrl: string;
  transcription: string;
  segments: TranscriptionSegment[];
  thumbnailUrl: string;
}

export interface TranscriptionResult {
  transcription: string;
  segments: TranscriptionSegment[];
}

interface ProcessVideoInput {
  inputPath: string;
  inputType: "local" | "url";
  style?: string;
  targetDuration?: number;
}

interface TranscribeInput {
  inputPath: string;
  inputType: "local" | "url";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseUrl(): string {
  const url = ENV.autoEditApiUrl;
  if (!url) {
    throw new Error("[AutoEdit] AUTOEDIT_API_URL is not configured");
  }
  // Strip trailing slash for consistent joining
  return url.replace(/\/+$/, "");
}

// ─── Health check ───────────────────────────────────────────────────────────

/**
 * Lightweight liveness probe. Returns true if the service responds 200,
 * false on any error (connection refused, timeout, non-200, etc.).
 * Never throws.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await axios.get(`${baseUrl()}/api/v1/health`, { timeout: 5_000 });
    console.log(`[AutoEdit] Health check OK (${res.status})`);
    return res.status === 200;
  } catch (err: any) {
    const reason =
      err.code === "ECONNREFUSED"
        ? "connection refused"
        : err.code === "ETIMEDOUT" || err.code === "ECONNABORTED"
          ? "timeout"
          : err.message ?? "unknown error";
    console.log(`[AutoEdit] Health check failed: ${reason}`);
    return false;
  }
}

// ─── Process video ──────────────────────────────────────────────────────────

/**
 * Submit a video for the full edit pipeline (cut, subtitle, thumbnail).
 * Wrapped with a 10-minute timeout (STEP_TIMEOUT).
 */
export async function processVideo(input: ProcessVideoInput): Promise<ProcessVideoResult> {
  const body: Record<string, unknown> = {};

  if (input.inputType === "url") {
    body.s3_url = input.inputPath;
  } else {
    body.local_path = input.inputPath;
  }

  if (input.style) body.style = input.style;
  if (input.targetDuration !== undefined) body.target_duration = input.targetDuration;

  console.log(`[AutoEdit] Processing video (${input.inputType}): ${input.inputPath}`);

  const request = axios
    .post(`${baseUrl()}/api/v1/process-video`, body, { timeout: STEP_TIMEOUT })
    .then((res) => {
      const data = res.data;
      console.log("[AutoEdit] Process-video completed successfully");
      return {
        outputUrl: data.output_url ?? data.outputUrl,
        transcription: data.transcription,
        segments: (data.segments ?? []).map((s: any) => ({
          word: s.word,
          start: s.start,
          end: s.end,
          confidence: s.confidence,
        })),
        thumbnailUrl: data.thumbnail_url ?? data.thumbnailUrl,
      } as ProcessVideoResult;
    });

  return withTimeout(request, STEP_TIMEOUT, "AutoEdit process-video");
}

// ─── Transcribe ─────────────────────────────────────────────────────────────

/**
 * Transcribe audio from a video file or URL.
 */
export async function transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
  const body: Record<string, unknown> = {};

  if (input.inputType === "url") {
    body.s3_url = input.inputPath;
  } else {
    body.local_path = input.inputPath;
  }

  console.log(`[AutoEdit] Transcribing (${input.inputType}): ${input.inputPath}`);

  const res = await axios.post(`${baseUrl()}/api/v1/transcribe`, body, { timeout: STEP_TIMEOUT });
  const data = res.data;

  console.log("[AutoEdit] Transcription completed successfully");

  return {
    transcription: data.transcription,
    segments: (data.segments ?? []).map((s: any) => ({
      word: s.word,
      start: s.start,
      end: s.end,
      confidence: s.confidence,
    })),
  };
}

// ─── Styles ─────────────────────────────────────────────────────────────────

/**
 * Fetch available editing style presets from the AutoEdit service.
 */
export async function getStyles(): Promise<string[]> {
  console.log("[AutoEdit] Fetching available styles");

  const res = await axios.get(`${baseUrl()}/api/v1/styles`, { timeout: 10_000 });
  const styles: string[] = Array.isArray(res.data) ? res.data : res.data?.styles ?? [];

  console.log(`[AutoEdit] ${styles.length} style(s) available: ${styles.join(", ")}`);
  return styles;
}
