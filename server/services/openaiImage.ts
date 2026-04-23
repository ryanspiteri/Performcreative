/**
 * OpenAI gpt-image-1 backend for the static iteration pipeline.
 *
 * Uses the /v1/images/edits endpoint because iteration always has at least
 * two reference images (the winning ad's style + the ONEST product render)
 * and optionally a person reference. Generations are uploaded to our S3 via
 * storagePut so the returned URL matches the Nano Banana result shape.
 *
 * Scaffolded in Day 6-7 of the iteration sign-off plan. The exact API shape
 * of OpenAI's multi-image edit endpoint evolves quickly — if a request
 * fails, inspect the 400 payload and adjust the form fields accordingly.
 */

import axios from "axios";
import { storagePut } from "../storage";
import { ENV } from "../_core/env";
import type { ImageGenerateOptions, ImageGenerateResult } from "./imageGenerator";

// Per-image cost estimate for gpt-image-1 (high quality, square). Off-ratio
// images may cost more; refine after the A/B bakeoff.
const GPT_IMAGE_1_COST_ESTIMATE = 0.15;

async function downloadAsBuffer(url: string, timeoutMs = 30_000): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: timeoutMs });
  const buffer = Buffer.from(res.data);
  const contentType = (res.headers["content-type"] as string) || "image/png";
  return { buffer, contentType };
}

function aspectRatioToSize(aspect: ImageGenerateOptions["aspectRatio"]): string {
  // gpt-image-1 supports 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape).
  // Map common ad ratios to the nearest supported size.
  switch (aspect) {
    case "1:1":
      return "1024x1024";
    case "4:5":
    case "3:4":
    case "2:3":
    case "9:16":
      return "1024x1536";
    case "5:4":
    case "4:3":
    case "3:2":
    case "16:9":
      return "1536x1024";
    default:
      return "1024x1024";
  }
}

export async function generateWithOpenAI(opts: ImageGenerateOptions): Promise<ImageGenerateResult> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const started = Date.now();

  // Assemble reference images: product first (most important, never-drop),
  // then reference style ad, then optional person. OpenAI accepts up to 10
  // input images in an edit request.
  const imageUrls: string[] = [];
  if (opts.productRenderUrl) imageUrls.push(opts.productRenderUrl);
  if (opts.controlImageUrl) imageUrls.push(opts.controlImageUrl);
  if (opts.personImageUrl) imageUrls.push(opts.personImageUrl);

  if (imageUrls.length === 0) {
    throw new Error("OpenAI backend requires at least one reference image (productRenderUrl)");
  }

  const buffers = await Promise.all(imageUrls.map((u) => downloadAsBuffer(u)));

  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", opts.prompt);
  form.append("size", aspectRatioToSize(opts.aspectRatio));
  form.append("n", "1");
  form.append("quality", "high");
  // OpenAI's images/edits accepts multiple files via repeated "image" field.
  buffers.forEach(({ buffer, contentType }, i) => {
    const ext = contentType.includes("jpeg") ? "jpg" : "png";
    form.append("image", buffer, { filename: `ref_${i}.${ext}`, contentType });
  });

  let response;
  try {
    response = await axios.post("https://api.openai.com/v1/images/edits", form, {
      headers: {
        Authorization: `Bearer ${ENV.openaiApiKey}`,
        ...form.getHeaders(),
      },
      timeout: 180_000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    });
  } catch (err: any) {
    const apiMsg = err.response?.data?.error?.message || err.message;
    throw new Error(`OpenAI images.edits failed: ${apiMsg}`);
  }

  const first = response.data?.data?.[0];
  if (!first) {
    throw new Error("OpenAI returned no image in response");
  }

  // gpt-image-1 returns b64_json; older endpoints return url. Handle both.
  let imageBuffer: Buffer;
  if (first.b64_json) {
    imageBuffer = Buffer.from(first.b64_json, "base64");
  } else if (first.url) {
    const downloaded = await downloadAsBuffer(first.url);
    imageBuffer = downloaded.buffer;
  } else {
    throw new Error("OpenAI response had neither b64_json nor url");
  }

  const key = `iteration-variants/openai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { url } = await storagePut(key, imageBuffer, "image/png");

  return {
    imageUrl: url,
    s3Key: key,
    cost: GPT_IMAGE_1_COST_ESTIMATE,
    latencyMs: Date.now() - started,
    backend: "openai_gpt_image",
  };
}
