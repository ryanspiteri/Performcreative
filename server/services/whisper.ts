import axios from "axios";
import { ENV } from "../_core/env";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

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
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024, // 100MB max
    });
    fs.writeFileSync(videoPath, Buffer.from(response.data));
    console.log("[Whisper] Video downloaded, size:", fs.statSync(videoPath).size);

    // Extract audio with ffmpeg
    console.log("[Whisper] Extracting audio with ffmpeg...");
    await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -ab 128k -ar 44100 -y "${audioPath}"`, {
      timeout: 60000,
    });
    console.log("[Whisper] Audio extracted, size:", fs.statSync(audioPath).size);

    return audioPath;
  } catch (error: any) {
    // Clean up video file on error
    try { fs.unlinkSync(videoPath); } catch {}
    throw new Error(`Audio extraction failed: ${error.message}`);
  } finally {
    // Clean up video file
    try { fs.unlinkSync(videoPath); } catch {}
  }
}

// Transcribe audio using OpenAI Whisper API
export async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    console.log("[Whisper] Transcribing audio file:", audioPath);
    
    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioPath));
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${ENV.openaiApiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 60000,
      }
    );

    console.log("[Whisper] Transcription complete");
    return response.data?.text || "";
  } finally {
    // Clean up audio file
    try { fs.unlinkSync(audioPath); } catch {}
  }
}

// Full pipeline: download video → extract audio → transcribe
export async function transcribeVideo(videoUrl: string): Promise<string> {
  const audioPath = await extractAudio(videoUrl);
  return transcribeAudio(audioPath);
}
