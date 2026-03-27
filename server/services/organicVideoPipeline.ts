/**
 * Organic Video Pipeline — Orchestrator
 *
 * Chains: AutoEdit → Whisper → Transcript Editor Gate → ffmpeg Subtitles → Caption Generator.
 *
 * Pipeline stages:
 *   Stage 1: uploading     — Validate input + check AutoEdit health
 *   Stage 2: editing       — Send to AutoEdit for processing
 *   Stage 3: transcribing  — Whisper transcribes the edited (smaller) video
 *   Stage 3b: reviewing    — PAUSE — user reviews/edits transcript in UI
 *   Stage 4: subtitling    — ffmpeg burns subtitles (if style != "none")
 *   Stage 5: captioning    — Caption Generator produces 3 platform variants
 *   Stage 6: completed     — Done
 */

import * as db from "../db";
import { withTimeout, STEP_TIMEOUT, validateVideoInput, type SubtitleStyle } from "./_shared";
import { ENV } from "../_core/env";
import { checkHealth, processVideo } from "./autoEditClient";
import { generateAssFile, renderSubtitles } from "./subtitleService";
import { generateCaption } from "./captionGenerator";
import { transcribeVideo } from "./whisper";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrganicVideoInput {
  videoInputPath: string;   // local path or S3 URL
  subtitleStyle: SubtitleStyle;
  contentPillar?: string;
  contentPurpose?: string;
  topic?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Log a stage transition and persist it to the database.
 */
async function transitionStage(runId: number, stage: string): Promise<void> {
  console.log(`[OrganicVideo] Run #${runId} — Stage ${stage}`);
  await db.updateOrganicRun(runId, { stage, status: "running" });
}

/**
 * Mark a run as failed with an error message.
 */
async function failRun(runId: number, err: Error): Promise<void> {
  console.error(`[OrganicVideo] Run #${runId} — FAILED:`, err.message);
  await db.updateOrganicRun(runId, {
    status: "failed",
    errorMessage: err.message,
  });
}

// ─── Stages 1–3: Upload → Edit → Transcribe (pauses for review) ────────

/**
 * Run pipeline stages 1 through 3, then pause for user transcript review.
 *
 * Stage 1: Validate input + check AutoEdit health
 * Stage 2: Send to AutoEdit for processing
 * Stage 3: Whisper transcribes the edited (smaller) video
 *
 * After Stage 3 the run enters "reviewing" status and waits for the user
 * to approve or edit the transcript via `approveTranscript()`.
 */
export async function runOrganicVideoStages1to3(
  runId: number,
  input: OrganicVideoInput,
): Promise<void> {
  try {
    // ── Stage 1: uploading ──────────────────────────────────────────────
    await transitionStage(runId, "uploading");

    // Determine if input is a URL (uploaded/S3) or local path
    const isUrl = input.videoInputPath.startsWith("http://") || input.videoInputPath.startsWith("https://");
    let videoUrl: string;

    if (isUrl) {
      // Uploaded file — URL is already valid, skip local path validation
      videoUrl = input.videoInputPath;
    } else {
      const validated = validateVideoInput(input.videoInputPath, ENV.localMediaBasePath);
      videoUrl = validated.path;
    }

    // ── Stage 2: editing (skip if AutoEdit unavailable) ─────────────────
    const healthy = await checkHealth();
    let editedVideoUrl = videoUrl;

    if (healthy) {
      await transitionStage(runId, "editing");

      const editResult = await withTimeout(
        processVideo({
          inputPath: videoUrl,
          inputType: isUrl ? "url" : "local",
        }),
        STEP_TIMEOUT,
        "AutoEdit process-video",
      );

      editedVideoUrl = editResult.outputUrl;
      await db.updateOrganicRun(runId, {
        autoEditOutputUrl: editResult.outputUrl,
      });
    } else {
      console.log(`[OrganicVideo] Run #${runId} — AutoEdit unavailable, skipping editing stage`);
    }

    // ── Stage 3: transcribing ───────────────────────────────────────────
    await transitionStage(runId, "transcribing");

    const transcription = await withTimeout(
      transcribeVideo(editedVideoUrl),
      STEP_TIMEOUT,
      "Whisper transcription",
    );

    // Store transcription text
    await db.updateOrganicRun(runId, {
      transcription: JSON.stringify({
        text: transcription,
        segments: [],
      }),
    });

    // ── Stage 3b: reviewing — PAUSE ─────────────────────────────────────
    console.log(`[OrganicVideo] Run #${runId} — Stage reviewing`);
    await db.updateOrganicRun(runId, { stage: "reviewing", status: "running" });
    console.log(`[OrganicVideo] Run #${runId} — Paused for transcript review`);
  } catch (err: any) {
    await failRun(runId, err);
  }
}

// ─── Stages 4–6: Subtitles → Captions → Complete ───────────────────────

/**
 * Run pipeline stages 4 through 6 after the user has approved the transcript.
 *
 * Stage 4: Generate & burn subtitles (if style != "none")
 * Stage 5: Generate captions for Instagram, TikTok, LinkedIn
 * Stage 6: Mark as completed
 */
export async function runOrganicVideoStages4to6(runId: number): Promise<void> {
  try {
    const run = await db.getOrganicRun(runId);
    if (!run) {
      throw new Error(`Organic run #${runId} not found`);
    }

    const subtitleStyle = (run.subtitleStyle ?? "none") as SubtitleStyle;
    const autoEditOutputUrl = run.autoEditOutputUrl as string;

    // Prefer edited transcription over original
    const transcriptionData =
      typeof run.transcriptionEdited === "string"
        ? JSON.parse(run.transcriptionEdited)
        : typeof run.transcriptionEdited === "object" && run.transcriptionEdited !== null
          ? run.transcriptionEdited
          : typeof run.transcription === "string"
            ? JSON.parse(run.transcription)
            : run.transcription;

    const segments = (transcriptionData as any)?.segments ?? [];

    // ── Stage 4: subtitling ─────────────────────────────────────────────
    await transitionStage(runId, "subtitling");

    let finalVideoUrl = autoEditOutputUrl;

    if (subtitleStyle !== "none") {
      const assContent = generateAssFile(segments, subtitleStyle);

      const outputKey = `organic-videos/${runId}/subtitled_${Date.now()}.mp4`;
      finalVideoUrl = await withTimeout(
        renderSubtitles(autoEditOutputUrl, assContent, outputKey),
        STEP_TIMEOUT,
        "Subtitle render",
      );

      await db.updateOrganicRun(runId, { subtitledVideoUrl: finalVideoUrl });
    } else {
      console.log(`[OrganicVideo] Run #${runId} — Subtitle style is "none", skipping burn-in`);
    }

    // ── Stage 5: captioning ─────────────────────────────────────────────
    await transitionStage(runId, "captioning");

    const pillar = (run.contentPillar as string) ?? "Life Dump";
    const purpose = (run.contentPurpose as string) ?? "Connect";
    const topic = (run.topic as string) ?? "organic video";

    const captions = await withTimeout(
      generateCaption({ pillar, purpose, topic }),
      STEP_TIMEOUT,
      "Caption generation",
    );

    await db.updateOrganicRun(runId, {
      captionInstagram: captions.instagram,
      captionTiktok: captions.tiktok,
      captionLinkedin: captions.linkedin,
    });

    // ── Stage 6: completed ──────────────────────────────────────────────
    console.log(`[OrganicVideo] Run #${runId} — Stage completed`);
    await db.updateOrganicRun(runId, {
      stage: "completed",
      status: "completed",
      completedAt: new Date(),
    });

    console.log(`[OrganicVideo] Run #${runId} — Pipeline finished successfully`);
  } catch (err: any) {
    await failRun(runId, err);
  }
}

// ─── Transcript approval gate ───────────────────────────────────────────

/**
 * Approve the transcript and resume the pipeline.
 *
 * If `editedSegments` are provided they are stored in the `transcriptionEdited`
 * field and used for subtitle generation. Otherwise the original transcription
 * is used as-is.
 *
 * After storing edits, stages 4–6 are kicked off in the background
 * (fire-and-forget) so the API call returns immediately.
 */
export async function approveTranscript(
  runId: number,
  editedSegments?: any,
): Promise<void> {
  if (editedSegments) {
    await db.updateOrganicRun(runId, {
      transcriptionEdited: JSON.stringify(editedSegments),
    });
    console.log(`[OrganicVideo] Run #${runId} — Stored edited transcription`);
  } else {
    console.log(`[OrganicVideo] Run #${runId} — Using original transcription (no edits)`);
  }

  // Fire-and-forget: resume pipeline in the background
  runOrganicVideoStages4to6(runId).catch((err) => {
    console.error(`[OrganicVideo] Run #${runId} — Background stages 4-6 failed:`, err.message);
  });
}
