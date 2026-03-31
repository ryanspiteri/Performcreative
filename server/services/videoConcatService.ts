/**
 * Video Concatenation Service
 *
 * Downloads multiple video clips, concatenates them in order using ffmpeg's
 * concat demuxer, uploads the result to S3, and cleans up temp files.
 */

// @ts-expect-error -- no @types/fluent-ffmpeg; package ships untyped JS
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import ffmpegStatic from "ffmpeg-static";

import { storagePut } from "../storage";
import { withTimeout } from "./_shared";

// Point fluent-ffmpeg at the ffmpeg-static binary when available
if (ffmpegStatic && typeof ffmpegStatic === "string" && fs.existsSync(ffmpegStatic)) {
  (ffmpeg as any).setFfmpegPath(ffmpegStatic);
}

const CONCAT_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Concatenate multiple video URLs into a single video file.
 *
 * 1. Downloads each video to a temp directory
 * 2. Creates an ffmpeg concat list file
 * 3. Runs ffmpeg concat demuxer (stream copy — no re-encoding)
 * 4. Uploads the result to S3
 * 5. Cleans up all temp files
 *
 * @param urls   - Ordered list of video URLs to concatenate
 * @param runId  - Pipeline run ID for S3 key namespacing
 * @returns S3 URL of the concatenated video
 */
export async function concatVideos(urls: string[], runId: number): Promise<string> {
  if (urls.length === 0) throw new Error("No video URLs provided for concatenation");
  if (urls.length === 1) throw new Error("concatVideos requires 2+ URLs; use the single URL directly");

  const run = async (): Promise<string> => {
    const tmpDir = os.tmpdir();
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const workDir = path.join(tmpDir, `concat_${uid}`);
    fs.mkdirSync(workDir, { recursive: true });

    const clipPaths: string[] = [];
    const listPath = path.join(workDir, "concat_list.txt");
    const outputPath = path.join(workDir, "concatenated.mp4");

    try {
      // 1. Download each video clip
      for (let i = 0; i < urls.length; i++) {
        const clipPath = path.join(workDir, `clip_${i}.mp4`);
        console.log(`[VideoConcat] Downloading clip ${i + 1}/${urls.length}: ${urls[i].slice(0, 80)}...`);

        const response = await axios.get(urls[i], {
          responseType: "arraybuffer",
          timeout: 120_000,
          maxContentLength: 500 * 1024 * 1024,
        });

        fs.writeFileSync(clipPath, Buffer.from(response.data));
        clipPaths.push(clipPath);
        console.log(`[VideoConcat] Clip ${i + 1} downloaded: ${fs.statSync(clipPath).size} bytes`);
      }

      // 2. Create concat list file
      const listContent = clipPaths.map((p) => `file '${p}'`).join("\n");
      fs.writeFileSync(listPath, listContent, "utf-8");
      console.log(`[VideoConcat] Concat list written with ${clipPaths.length} clips`);

      // 3. Run ffmpeg concat demuxer (stream copy — fast, no re-encoding)
      console.log("[VideoConcat] Running ffmpeg concat...");
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .outputOptions(["-c", "copy"])
          .output(outputPath)
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      const outputSize = fs.statSync(outputPath).size;
      console.log(`[VideoConcat] Concatenation complete: ${outputSize} bytes`);

      if (outputSize === 0) {
        throw new Error("Concatenated video file is empty");
      }

      // 4. Upload to S3
      const outputKey = `organic-videos/${runId}/concatenated_${Date.now()}.mp4`;
      console.log(`[VideoConcat] Uploading concatenated video to: ${outputKey}`);
      const videoData = fs.readFileSync(outputPath);
      const { url } = await storagePut(outputKey, videoData, "video/mp4");
      console.log(`[VideoConcat] Upload complete: ${url}`);

      return url;
    } finally {
      // 5. Clean up temp files
      for (const f of [...clipPaths, listPath, outputPath]) {
        try { fs.unlinkSync(f); } catch {}
      }
      try { fs.rmdirSync(workDir); } catch {}
    }
  };

  return withTimeout(run(), CONCAT_TIMEOUT, "Video concatenation");
}
