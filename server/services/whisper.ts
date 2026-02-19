import axios from "axios";
import { ENV } from "../_core/env";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

// Get the ffmpeg binary path from ffmpeg-static package
function getFfmpegPath(): string {
  try {
    // ffmpeg-static exports the path to the bundled ffmpeg binary
    const ffmpegStatic = require("ffmpeg-static") as string;
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      console.log("[Whisper] Using ffmpeg-static binary:", ffmpegStatic);
      return ffmpegStatic;
    }
  } catch (e) {
    console.warn("[Whisper] ffmpeg-static not found, trying system ffmpeg");
  }
  // Fallback to system ffmpeg
  return "ffmpeg";
}

const FFMPEG_PATH = getFfmpegPath();

// Download video and extract audio using ffmpeg
export async function extractAudio(videoUrl: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `video_${Date.now()}.mp4`);
  const audioPath = path.join(tmpDir, `audio_${Date.now()}.mp3`);

  try {
    // Download video
    console.log("[Whisper] Downloading video from:", videoUrl);
    const response = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 120000,
      maxContentLength: 100 * 1024 * 1024, // 100MB max
    });
    fs.writeFileSync(videoPath, Buffer.from(response.data));
    const videoSize = fs.statSync(videoPath).size;
    console.log("[Whisper] Video downloaded, size:", videoSize, "bytes");

    if (videoSize === 0) {
      throw new Error("Downloaded video file is empty");
    }

    // Extract audio with ffmpeg-static binary
    console.log("[Whisper] Extracting audio with ffmpeg at:", FFMPEG_PATH);
    const cmd = `"${FFMPEG_PATH}" -i "${videoPath}" -vn -acodec libmp3lame -ab 128k -ar 44100 -y "${audioPath}"`;
    console.log("[Whisper] Running command:", cmd);
    
    await execAsync(cmd, {
      timeout: 120000,
    });

    const audioSize = fs.statSync(audioPath).size;
    console.log("[Whisper] Audio extracted, size:", audioSize, "bytes");

    if (audioSize === 0) {
      throw new Error("Extracted audio file is empty");
    }

    return audioPath;
  } catch (error: any) {
    console.error("[Whisper] Audio extraction error:", error.message);
    // Clean up video file on error
    try { fs.unlinkSync(videoPath); } catch {}
    try { fs.unlinkSync(audioPath); } catch {}
    throw new Error(`Audio extraction failed: ${error.message}`);
  } finally {
    // Clean up video file (keep audio for transcription)
    try { fs.unlinkSync(videoPath); } catch {}
  }
}

// Transcribe audio using OpenAI Whisper API
export async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    console.log("[Whisper] Transcribing audio file:", audioPath);
    
    const audioSize = fs.statSync(audioPath).size;
    console.log("[Whisper] Audio file size:", audioSize, "bytes");

    if (audioSize > 25 * 1024 * 1024) {
      throw new Error("Audio file exceeds 25MB Whisper API limit");
    }

    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioPath));
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    console.log("[Whisper] Calling OpenAI Whisper API...");
    console.log("[Whisper] API key present:", !!ENV.openaiApiKey, "length:", ENV.openaiApiKey?.length || 0);

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${ENV.openaiApiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 120000,
      }
    );

    const transcript = response.data?.text || "";
    console.log("[Whisper] Transcription complete, length:", transcript.length, "chars");
    return transcript;
  } catch (error: any) {
    console.error("[Whisper] Transcription API error:", error.response?.status, error.response?.data || error.message);
    throw new Error(`Whisper API failed: ${error.response?.data?.error?.message || error.message}`);
  } finally {
    // Clean up audio file
    try { fs.unlinkSync(audioPath); } catch {}
  }
}

// Full pipeline: download video → extract audio → transcribe
export async function transcribeVideo(videoUrl: string): Promise<string> {
  console.log("[Whisper] Starting full transcription pipeline for:", videoUrl);
  const audioPath = await extractAudio(videoUrl);
  return transcribeAudio(audioPath);
}
