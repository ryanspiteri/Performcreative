/**
 * Magic Hour Face Swap Video Service
 * API base: https://api.magichour.ai/v1
 * Docs: https://docs.magichour.ai/integration/adding-api-to-your-app
 *
 * Flow:
 * 1. Submit face swap job with direct URL references (no pre-upload needed)
 * 2. Poll GET /v1/face-swap/{id} until complete
 * 3. Return download URL
 *
 * Status values: queued | rendering | complete | error | canceled
 */

const MH_BASE = "https://api.magichour.ai/v1";

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

// ─── Submit face swap job ────────────────────────────────────────────────────

interface FaceSwapJobResponse {
  id: string;
  status: string;
  credits_charged?: number;
}

export async function submitFaceSwapJob(params: {
  videoUrl: string;
  portraitUrl: string;
  name?: string;
  startSeconds?: number;
  endSeconds?: number;
}): Promise<FaceSwapJobResponse> {
  const body = {
    name: params.name || `UGC Clone - ${new Date().toISOString()}`,
    start_seconds: params.startSeconds ?? 0,
    end_seconds: params.endSeconds ?? 60,
    assets: {
      video_file_path: params.videoUrl,
      video_source: "file",
      image_file_path: params.portraitUrl,
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
  status: "queued" | "rendering" | "complete" | "error" | "canceled";
  credits_charged?: number;
  downloads?: Array<{ url: string; expires_at?: string }>;
  error?: { code?: string; message?: string } | string;
}

export async function getFaceSwapJobStatus(jobId: string): Promise<VideoProjectStatus> {
  const res = await mhFetch(`/face-swap/${jobId}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Magic Hour status check failed (${res.status}): ${err}`);
  }
  return (await res.json()) as VideoProjectStatus;
}

// ─── Poll until complete (with timeout) ─────────────────────────────────────

export async function waitForFaceSwapCompletion(
  jobId: string,
  timeoutMs = 15 * 60 * 1000, // 15 minutes
  pollIntervalMs = 10_000
): Promise<VideoProjectStatus> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getFaceSwapJobStatus(jobId);

    if (status.status === "complete") {
      return status;
    }

    if (status.status === "error" || status.status === "canceled") {
      const errMsg = typeof status.error === "object"
        ? status.error?.message || JSON.stringify(status.error)
        : status.error || "unknown error";
      throw new Error(`Magic Hour face swap job ${status.status}: ${errMsg}`);
    }

    // Still queued or rendering — wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Magic Hour face swap job timed out after ${timeoutMs / 1000}s`);
}

// ─── Full swap flow ──────────────────────────────────────────────────────────

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
 * Submit face swap job with direct URL references, poll until complete, return result.
 * This is a long-running operation (2–10 minutes). Call from a background job.
 */
export async function runMagicHourCharacterSwap(input: MagicHourSwapInput): Promise<MagicHourSwapResult> {
  const { sourceVideoUrl, portraitUrl, name, videoDurationSeconds = 30 } = input;

  // Submit job with direct URL references
  const job = await submitFaceSwapJob({
    videoUrl: sourceVideoUrl,
    portraitUrl,
    name: name || `UGC Clone - ${new Date().toISOString()}`,
    startSeconds: 0,
    endSeconds: videoDurationSeconds,
  });

  // Poll until complete
  const result = await waitForFaceSwapCompletion(job.id);

  // Extract output URL
  const outputUrl = result.downloads?.[0]?.url;
  if (!outputUrl) {
    throw new Error("Magic Hour job completed but no download URL found");
  }

  // Estimate cost: ~$0.0024 per credit at Creator tier
  const credits = result.credits_charged ?? job.credits_charged ?? 0;
  const costUsd = (credits * 0.0024).toFixed(2);

  return {
    jobId: job.id,
    outputVideoUrl: outputUrl,
    creditsCharged: credits,
    estimatedCostUsd: `$${costUsd}`,
  };
}
