/**
 * Magic Hour Face Swap Video Service
 * API base: https://api.magichour.ai/api/v1
 * Docs: https://docs.magichour.ai/api-reference/video-projects/face-swap-video
 *
 * Flow:
 * 1. Get pre-signed upload URLs for video + portrait
 * 2. PUT files to the signed URLs
 * 3. Submit face swap job with file_paths
 * 4. Poll GET /v1/video-projects/{id} until complete
 * 5. Return download URL
 */

import fs from "fs";
import path from "path";
import os from "os";

const MH_BASE = "https://api.magichour.ai/api/v1";

function getApiKey(): string {
  const key = process.env.MAGIC_HOUR_API_KEY;
  if (!key) throw new Error("MAGIC_HOUR_API_KEY is not set");
  return key;
}

async function mhFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${MH_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

// ─── Upload URLs ────────────────────────────────────────────────────────────

interface UploadUrlItem {
  upload_url: string;
  expires_at: string;
  file_path: string;
}

interface UploadUrlsResponse {
  items: UploadUrlItem[];
}

export async function getUploadUrls(items: { type: "video" | "image" | "audio"; extension: string }[]): Promise<UploadUrlItem[]> {
  const res = await mhFetch("/files/upload-urls", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Magic Hour upload-urls failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as UploadUrlsResponse;
  return data.items;
}

// ─── Upload file bytes to pre-signed URL ────────────────────────────────────

export async function uploadFileToMagicHour(uploadUrl: string, fileBuffer: Buffer, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileBuffer as unknown as BodyInit,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Magic Hour file upload failed (${res.status}): ${err}`);
  }
}

// ─── Download a remote URL to a buffer ──────────────────────────────────────

export async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Submit face swap job ────────────────────────────────────────────────────

interface FaceSwapJobRequest {
  videoFilePath: string;     // file_path from upload
  portraitFilePath: string;  // file_path from upload
  name?: string;
  startSeconds?: number;
  endSeconds?: number;
}

interface FaceSwapJobResponse {
  id: string;
  credits_charged: number;
}

export async function submitFaceSwapJob(req: FaceSwapJobRequest): Promise<FaceSwapJobResponse> {
  const body = {
    name: req.name || `UGC Clone - ${new Date().toISOString()}`,
    start_seconds: req.startSeconds ?? 0,
    end_seconds: req.endSeconds ?? 60,
    style: { version: "default" },
    assets: {
      face_swap_mode: "all-faces",
      video_file_path: req.videoFilePath,
      video_source: "file",
      face_mappings: [
        {
          new_face: req.portraitFilePath,
          // No original_face needed for all-faces mode
        },
      ],
    },
  };

  const res = await mhFetch("/face-swap", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Magic Hour face swap submit failed (${res.status}): ${err}`);
  }

  return (await res.json()) as FaceSwapJobResponse;
}

// ─── Poll job status ─────────────────────────────────────────────────────────

interface VideoProjectStatus {
  id: string;
  status: "queued" | "processing" | "complete" | "error";
  credits_charged?: number;
  downloads?: Array<{ url: string; type: string }>;
  error?: string;
}

export async function getFaceSwapJobStatus(jobId: string): Promise<VideoProjectStatus> {
  const res = await mhFetch(`/video-projects/${jobId}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Magic Hour status check failed (${res.status}): ${err}`);
  }
  return (await res.json()) as VideoProjectStatus;
}

// ─── Poll until complete (with timeout) ─────────────────────────────────────

export async function waitForFaceSwapCompletion(
  jobId: string,
  timeoutMs = 10 * 60 * 1000, // 10 minutes
  pollIntervalMs = 10_000
): Promise<VideoProjectStatus> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getFaceSwapJobStatus(jobId);

    if (status.status === "complete") {
      return status;
    }

    if (status.status === "error") {
      throw new Error(`Magic Hour face swap job failed: ${status.error || "unknown error"}`);
    }

    // Still queued or processing — wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Magic Hour face swap job timed out after ${timeoutMs / 1000}s`);
}

// ─── Full upload + swap flow ─────────────────────────────────────────────────

export interface MagicHourSwapInput {
  sourceVideoUrl: string;   // Public URL to the original UGC video
  portraitUrl: string;      // Public URL to the reference portrait image
  name?: string;
  videoDurationSeconds?: number;
}

export interface MagicHourSwapResult {
  jobId: string;
  outputVideoUrl: string;
  creditsCharged: number;
  estimatedCostUsd: string;
}

/**
 * Full pipeline: download source files → upload to Magic Hour → submit swap → poll → return result.
 * This is a long-running operation (2–10 minutes). Call from a background job or with a long timeout.
 */
export async function runMagicHourCharacterSwap(input: MagicHourSwapInput): Promise<MagicHourSwapResult> {
  const { sourceVideoUrl, portraitUrl, name, videoDurationSeconds = 30 } = input;

  // 1. Get upload URLs for video + portrait
  const uploadUrls = await getUploadUrls([
    { type: "video", extension: "mp4" },
    { type: "image", extension: "png" },
  ]);

  const [videoUpload, portraitUpload] = uploadUrls;

  // 2. Download source files and upload to Magic Hour storage
  const [videoBuffer, portraitBuffer] = await Promise.all([
    downloadToBuffer(sourceVideoUrl),
    downloadToBuffer(portraitUrl),
  ]);

  await Promise.all([
    uploadFileToMagicHour(videoUpload.upload_url, videoBuffer, "video/mp4"),
    uploadFileToMagicHour(portraitUpload.upload_url, portraitBuffer, "image/png"),
  ]);

  // 3. Submit face swap job
  const job = await submitFaceSwapJob({
    videoFilePath: videoUpload.file_path,
    portraitFilePath: portraitUpload.file_path,
    name: name || `UGC Clone - ${new Date().toISOString()}`,
    startSeconds: 0,
    endSeconds: videoDurationSeconds,
  });

  // 4. Poll until complete
  const result = await waitForFaceSwapCompletion(job.id);

  // 5. Extract output URL
  const outputUrl = result.downloads?.[0]?.url;
  if (!outputUrl) {
    throw new Error("Magic Hour job completed but no download URL found");
  }

  // Estimate cost: ~$0.0024 per credit at Creator tier
  const costUsd = ((result.credits_charged ?? job.credits_charged ?? 0) * 0.0024).toFixed(2);

  return {
    jobId: job.id,
    outputVideoUrl: outputUrl,
    creditsCharged: result.credits_charged ?? job.credits_charged ?? 0,
    estimatedCostUsd: `$${costUsd}`,
  };
}
