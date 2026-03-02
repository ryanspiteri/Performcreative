/**
 * Face Swap Pipeline Orchestrator
 *
 * Orchestrates the full UGC character swap pipeline:
 * 1. Validate portrait (Claude Vision)
 * 2. Generate voiceover (ElevenLabs)
 * 3. Upload files + submit face swap (Magic Hour)
 * 4. Poll until face swap complete
 * 5. Merge new audio into face-swapped video (ffmpeg)
 * 6. Upload final video to S3
 * 7. Update DB record
 */

import * as db from "../db";
import { validatePortrait } from "./portraitValidator";
import { runMagicHourCharacterSwap } from "./magicHour";
import { storagePut } from "../storage";
import ffmpegStatic from "ffmpeg-static";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

// ─── ElevenLabs voiceover generation ─────────────────────────────────────────

async function generateVoiceover(script: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── ffmpeg audio merge ───────────────────────────────────────────────────────

async function mergeAudioIntoVideo(videoUrl: string, audioBuffer: Buffer): Promise<Buffer> {
  const ffmpegBin = ffmpegStatic;
  if (!ffmpegBin) throw new Error("ffmpeg-static binary not found");

  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `faceswap-video-${Date.now()}.mp4`);
  const audioPath = path.join(tmpDir, `faceswap-audio-${Date.now()}.mp3`);
  const outputPath = path.join(tmpDir, `faceswap-output-${Date.now()}.mp4`);

  try {
    // Download face-swapped video
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download face-swapped video: ${videoRes.status}`);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    fs.writeFileSync(videoPath, videoBuffer);

    // Write audio
    fs.writeFileSync(audioPath, audioBuffer);

    // Merge: replace audio track, keep video, trim to shorter of the two
    await execFileAsync(ffmpegBin, [
      "-y",
      "-i", videoPath,
      "-i", audioPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      outputPath,
    ]);

    return fs.readFileSync(outputPath);
  } finally {
    // Cleanup temp files
    for (const p of [videoPath, audioPath, outputPath]) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export interface FaceSwapPipelineInput {
  jobId: number;
  sourceVideoUrl: string;
  portraitBase64: string;
  portraitMimeType: "image/jpeg" | "image/png" | "image/webp";
  portraitS3Url: string;   // Already uploaded to S3
  voiceId?: string;
  voiceoverScript?: string;
  videoDurationSeconds?: number;
}

export async function runFaceSwapPipeline(input: FaceSwapPipelineInput): Promise<void> {
  const {
    jobId,
    sourceVideoUrl,
    portraitBase64,
    portraitMimeType,
    portraitS3Url,
    voiceId,
    voiceoverScript,
    videoDurationSeconds = 30,
  } = input;

  const updateJob = async (data: Record<string, unknown>) => {
    await db.updateFaceSwapJob(jobId, data);
  };

  try {
    // ── Stage 1: Validate portrait ──────────────────────────────────────────
    await updateJob({ status: "validating" });

    const validation = await validatePortrait(portraitBase64, portraitMimeType);
    await updateJob({ portraitValidation: validation as any });

    if (!validation.passed) {
      await updateJob({
        status: "failed",
        errorMessage: `Portrait validation failed: ${validation.summary}`,
      });
      return;
    }

    // ── Stage 2: Generate voiceover (if script + voice provided) ───────────
    let voiceoverS3Url: string | undefined;

    if (voiceId && voiceoverScript) {
      await updateJob({ status: "generating_voice" });

      const audioBuffer = await generateVoiceover(voiceoverScript, voiceId);

      // Upload to S3
      const audioKey = `face-swap-jobs/${jobId}/voiceover-${Date.now()}.mp3`;
      const { url: audioUrl } = await storagePut(audioKey, audioBuffer, "audio/mpeg");
      voiceoverS3Url = audioUrl;

      await updateJob({ voiceoverUrl: audioUrl });
    }

    // ── Stage 3: Magic Hour character swap ──────────────────────────────────
    await updateJob({ status: "swapping" });

    const swapResult = await runMagicHourCharacterSwap({
      sourceVideoUrl,
      portraitUrl: portraitS3Url,
      videoDurationSeconds,
      name: `UGC Clone Job #${jobId}`,
    });

    await updateJob({
      magicHourJobId: swapResult.jobId,
      magicHourStatus: "complete",
      faceSwapVideoUrl: swapResult.outputVideoUrl,
      creditsCharged: swapResult.creditsCharged,
      estimatedCostUsd: swapResult.estimatedCostUsd,
    });

    // ── Stage 4: Merge audio (if voiceover generated) ──────────────────────
    let finalVideoUrl = swapResult.outputVideoUrl;

    if (voiceoverS3Url && voiceId && voiceoverScript) {
      await updateJob({ status: "merging" });

      // Download voiceover
      const voiceRes = await fetch(voiceoverS3Url);
      const audioBuffer = Buffer.from(await voiceRes.arrayBuffer());

      const mergedBuffer = await mergeAudioIntoVideo(swapResult.outputVideoUrl, audioBuffer);

      // Upload merged video to S3
      const mergedKey = `face-swap-jobs/${jobId}/output-${Date.now()}.mp4`;
      const { url: mergedUrl } = await storagePut(mergedKey, mergedBuffer, "video/mp4");
      finalVideoUrl = mergedUrl;
    }

    // ── Stage 5: Complete ───────────────────────────────────────────────────
    await updateJob({
      status: "completed",
      outputVideoUrl: finalVideoUrl,
    });
  } catch (err: any) {
    console.error(`[FaceSwapPipeline] Job ${jobId} failed:`, err.message);
    await updateJob({
      status: "failed",
      errorMessage: err.message || "Unknown error",
    });
  }
}
