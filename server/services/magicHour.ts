/**
 * Magic Hour Face Swap Video Service
 * API base: https://api.magichour.ai/v1
 *
 * Correct three-step flow:
 * 1. POST /v1/face-detection  → detect faces in the source video, get task ID
 * 2. GET  /v1/face-detection/{id} → poll until complete, get faces[].path (e.g. "api-assets/id/0-0.png")
 * 3. POST /v1/face-swap → submit swap with face_mappings[{ original_face, new_face }]
 * 4. GET  /v1/video-projects/{id} → poll until complete, get downloads[].url
 *
 * Both video and portrait URLs can be public HTTPS URLs (S3, CDN, etc.) — no pre-upload needed.
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000); // 60s per-request timeout
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Step 1: Face Detection ───────────────────────────────────────────────────

interface FaceDetectionSubmitResponse {
  id: string;
  credits_charged: number;
}

interface FaceDetectionResult {
  id: string;
  status: "queued" | "rendering" | "complete" | "error";
  credits_charged: number;
  faces: Array<{
    path: string;  // e.g. "api-assets/id/0-0.png" — use as original_face in face_mappings
    url: string;   // full URL to the detected face crop
  }>;
}

async function submitFaceDetection(fileUrl: string): Promise<FaceDetectionSubmitResponse> {
  const body = {
    assets: { target_file_path: fileUrl },
    confidence_score: 0.5,
  };

  console.log("[MagicHour] Submitting face detection for:", fileUrl);

  const res = await mhFetch("/face-detection", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`[MagicHour] Face detection submit (${res.status}):`, text);

  if (!res.ok) {
    throw new Error(`Magic Hour face detection submit failed (${res.status}): ${text}`);
  }

  return JSON.parse(text) as FaceDetectionSubmitResponse;
}

async function waitForFaceDetection(
  taskId: string,
  timeoutMs = 3 * 60 * 1000,
  pollIntervalMs = 5_000
): Promise<FaceDetectionResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await mhFetch(`/face-detection/${taskId}`);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Magic Hour face detection poll failed (${res.status}): ${err}`);
    }

    const result = (await res.json()) as FaceDetectionResult;
    console.log(`[MagicHour] Face detection ${taskId}: ${result.status}, faces found: ${result.faces?.length ?? 0}`);

    if (result.status === "complete") {
      if (!result.faces || result.faces.length === 0) {
        throw new Error("Magic Hour face detection completed but no faces were found in the video. Ensure the video contains a clear, front-facing person.");
      }
      return result;
    }

    if (result.status === "error") {
      throw new Error(`Magic Hour face detection failed for task ${taskId}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Magic Hour face detection timed out after ${timeoutMs / 1000}s`);
}

// ─── Step 2: Submit face swap job ────────────────────────────────────────────

interface FaceSwapJobResponse {
  id: string;
  status: string;
  credits_charged?: number;
}

async function submitFaceSwapJob(params: {
  videoUrl: string;
  originalFacePath: string;  // from face detection result: faces[0].path
  portraitUrl: string;
  name?: string;
  startSeconds?: number;
  endSeconds?: number;
}): Promise<FaceSwapJobResponse> {
  const body = {
    name: params.name || `UGC Clone - ${new Date().toISOString()}`,
    start_seconds: params.startSeconds ?? 0,
    end_seconds: params.endSeconds ?? 60,
    style: { version: "default" },
    assets: {
      video_file_path: params.videoUrl,
      video_source: "file",
      face_swap_mode: "individual-faces",
      face_mappings: [
        {
          original_face: params.originalFacePath,  // MH internal path from face detection
          new_face: params.portraitUrl,             // public URL to portrait image
        },
      ],
    },
  };

  console.log("[MagicHour] Submitting face swap job:", JSON.stringify(body, null, 2));

  const res = await mhFetch("/face-swap", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`[MagicHour] Face swap submit (${res.status}):`, text);

  if (!res.ok) {
    throw new Error(`Magic Hour face swap submit failed (${res.status}): ${text}`);
  }

  return JSON.parse(text) as FaceSwapJobResponse;
}

// ─── Step 3: Poll face swap job status ───────────────────────────────────────

interface VideoProjectStatus {
  id: string;
  status: "queued" | "rendering" | "complete" | "error" | "canceled";
  credits_charged?: number;
  downloads?: Array<{ url: string; expires_at?: string }>;
  error?: { code?: string; message?: string } | string;
}

export async function getFaceSwapJobStatus(jobId: string): Promise<VideoProjectStatus> {
  const res = await mhFetch(`/video-projects/${jobId}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Magic Hour video project status check failed (${res.status}): ${err}`);
  }
  return (await res.json()) as VideoProjectStatus;
}

async function waitForFaceSwapCompletion(
  jobId: string,
  timeoutMs = 15 * 60 * 1000,
  pollIntervalMs = 10_000
): Promise<VideoProjectStatus> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getFaceSwapJobStatus(jobId);
    console.log(`[MagicHour] Face swap job ${jobId}: ${status.status}`);

    if (status.status === "complete") {
      return status;
    }

    if (status.status === "error" || status.status === "canceled") {
      const errMsg = typeof status.error === "object"
        ? status.error?.message || JSON.stringify(status.error)
        : status.error || "unknown error";
      throw new Error(`Magic Hour face swap job ${status.status}: ${errMsg}`);
    }

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
 * Full three-step character swap pipeline:
 * 1. Detect faces in source video (get original_face path)
 * 2. Submit face swap job (original_face → portrait)
 * 3. Poll until complete, return output video URL
 *
 * Both sourceVideoUrl and portraitUrl must be publicly accessible HTTPS URLs.
 */
export async function runMagicHourCharacterSwap(input: MagicHourSwapInput): Promise<MagicHourSwapResult> {
  const { sourceVideoUrl, portraitUrl, name, videoDurationSeconds = 30 } = input;

  // ── Step 1: Detect faces in the source video ─────────────────────────────
  console.log("[MagicHour] Step 1: Detecting faces in source video...");
  const detectionTask = await submitFaceDetection(sourceVideoUrl);
  const detectionResult = await waitForFaceDetection(detectionTask.id);

  // Use the first detected face as the original_face for the swap
  const originalFacePath = detectionResult.faces[0].path;
  console.log(`[MagicHour] Detected face path: ${originalFacePath}`);

  // ── Step 2: Submit face swap job ─────────────────────────────────────────
  console.log("[MagicHour] Step 2: Submitting face swap job...");
  const job = await submitFaceSwapJob({
    videoUrl: sourceVideoUrl,
    originalFacePath,
    portraitUrl,
    name: name || `UGC Clone - ${new Date().toISOString()}`,
    startSeconds: 0,
    endSeconds: videoDurationSeconds,
  });

  console.log(`[MagicHour] Face swap job submitted: ${job.id}`);

  // ── Step 3: Poll until complete ──────────────────────────────────────────
  console.log("[MagicHour] Step 3: Polling for completion...");
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
