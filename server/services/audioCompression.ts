import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

/**
 * Downloads a video from URL, extracts and compresses audio to meet Whisper's 16MB limit
 * Returns path to compressed audio file (caller must delete after use)
 */
export async function compressAudioForWhisper(videoUrl: string): Promise<string> {
  const tempDir = os.tmpdir();
  const randomId = randomBytes(8).toString("hex");
  const inputPath = path.join(tempDir, `video-${randomId}.mp4`);
  const outputPath = path.join(tempDir, `audio-${randomId}.mp3`);

  try {
    // Download video to temp file
    console.log(`[AudioCompression] Downloading video from ${videoUrl}`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await writeFile(inputPath, Buffer.from(buffer));
    console.log(`[AudioCompression] Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB to ${inputPath}`);

    // Extract and compress audio using ffmpeg
    // -vn: no video
    // -ar 16000: 16kHz sample rate (Whisper's native rate)
    // -ac 1: mono audio
    // -b:a 32k: 32kbps bitrate (good enough for speech, very small file)
    // -f mp3: MP3 format
    const ffmpegCmd = `ffmpeg -i "${inputPath}" -vn -ar 16000 -ac 1 -b:a 32k -f mp3 "${outputPath}" -y`;
    console.log(`[AudioCompression] Running: ${ffmpegCmd}`);
    
    const { stdout, stderr } = await execAsync(ffmpegCmd);
    console.log(`[AudioCompression] ffmpeg output:`, stderr.slice(-500)); // Last 500 chars

    // Check output file size
    const { size } = await import("fs/promises").then(m => m.stat(outputPath));
    const sizeMB = size / 1024 / 1024;
    console.log(`[AudioCompression] Compressed audio size: ${sizeMB.toFixed(2)}MB`);

    if (sizeMB > 16) {
      throw new Error(`Compressed audio still too large: ${sizeMB.toFixed(2)}MB (max 16MB)`);
    }

    // Clean up input file
    await unlink(inputPath).catch(() => {});

    return outputPath;
  } catch (error) {
    // Clean up on error
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    throw error;
  }
}
