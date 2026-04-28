/**
 * Brand Logo Overlay
 *
 * After Gemini generates a variation, sharp composites the canonical
 * ONEST brand-logo PNG on top so the output has the correct logo
 * regardless of what (if anything) Gemini drew. Avoids text-rendering
 * hallucination on the logo wordmark and the "Gemini copied the
 * competitor's logo from the reference ad" failure mode.
 *
 * Position default: top-left corner with a small inset, ~12% of frame
 * width. Tweak via the options if a logo needs different placement.
 *
 * Defensive defaults: any error in this service returns the ORIGINAL
 * generated URL unchanged. The overlay is a quality-of-life win, not a
 * correctness gate — never block the pipeline on an overlay failure.
 */

import sharp from "sharp";
import axios from "axios";
import { storagePut } from "../storage";

export type LogoPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export interface OverlayOptions {
  /** Background image URL — the Gemini-generated variation. */
  backgroundUrl: string;
  /** Brand-logo PNG URL — the literal upload from /brand-logos. */
  logoUrl: string;
  /** Where on the frame to place the logo. Default: "top-left". */
  position?: LogoPosition;
  /** Logo width as a fraction of the frame width. Default: 0.12 (12%). */
  scale?: number;
  /** Inset in pixels from the chosen edge. Default: 5% of frame width. */
  inset?: number;
}

export interface OverlayResult {
  imageUrl: string;
  s3Key: string;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 30_000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return Buffer.from(res.data);
}

function calculateLogoPosition(
  frameWidth: number,
  frameHeight: number,
  logoWidth: number,
  logoHeight: number,
  position: LogoPosition,
  inset: number,
): { left: number; top: number } {
  let left: number;
  let top: number;
  switch (position) {
    case "top-left":
      left = inset;
      top = inset;
      break;
    case "top-center":
      left = Math.round((frameWidth - logoWidth) / 2);
      top = inset;
      break;
    case "top-right":
      left = frameWidth - logoWidth - inset;
      top = inset;
      break;
    case "bottom-left":
      left = inset;
      top = frameHeight - logoHeight - inset;
      break;
    case "bottom-center":
      left = Math.round((frameWidth - logoWidth) / 2);
      top = frameHeight - logoHeight - inset;
      break;
    case "bottom-right":
      left = frameWidth - logoWidth - inset;
      top = frameHeight - logoHeight - inset;
      break;
    default:
      left = inset;
      top = inset;
  }
  // Clamp to canvas bounds.
  left = Math.max(0, Math.min(left, frameWidth - logoWidth));
  top = Math.max(0, Math.min(top, frameHeight - logoHeight));
  return { left, top };
}

/**
 * Composite the brand logo onto a Gemini-generated variation. Returns the
 * S3-uploaded composite. On ANY error, returns the original backgroundUrl
 * unchanged so the pipeline isn't blocked by overlay hiccups.
 */
export async function overlayBrandLogo(options: OverlayOptions): Promise<OverlayResult> {
  const {
    backgroundUrl,
    logoUrl,
    position = "top-left",
    scale = 0.12,
    inset,
  } = options;

  try {
    console.log(`[LogoOverlay] Compositing ${logoUrl} onto ${backgroundUrl} at ${position} (scale ${scale})`);

    const [bgBuffer, logoBuffer] = await Promise.all([
      fetchBuffer(backgroundUrl),
      fetchBuffer(logoUrl),
    ]);

    const bgMeta = await sharp(bgBuffer).metadata();
    const frameWidth = bgMeta.width || 1024;
    const frameHeight = bgMeta.height || 1024;

    const logoTargetWidth = Math.round(frameWidth * scale);
    const resolvedInset = inset ?? Math.round(frameWidth * 0.05);

    // Resize the logo, preserving alpha and aspect ratio.
    const resizedLogo = await sharp(logoBuffer)
      .resize({ width: logoTargetWidth, fit: "inside", withoutEnlargement: false })
      .ensureAlpha()
      .toBuffer();

    const logoMeta = await sharp(resizedLogo).metadata();
    const logoWidth = logoMeta.width || logoTargetWidth;
    const logoHeight = logoMeta.height || logoTargetWidth;

    const { left, top } = calculateLogoPosition(
      frameWidth,
      frameHeight,
      logoWidth,
      logoHeight,
      position,
      resolvedInset,
    );

    const composited = await sharp(bgBuffer)
      .composite([{ input: resizedLogo, left, top, blend: "over" }])
      .png({ quality: 95 })
      .toBuffer();

    const timestamp = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    const s3Key = `iteration-variants/with-logo-${timestamp}-${suffix}.png`;
    const { url } = await storagePut(s3Key, composited, "image/png");

    console.log(`[LogoOverlay] Done. Logo at left=${left}, top=${top}, size ${logoWidth}x${logoHeight} on ${frameWidth}x${frameHeight} frame.`);
    return { imageUrl: url, s3Key };
  } catch (err: any) {
    console.warn(`[LogoOverlay] Failed: ${err?.message || err}. Returning original image.`);
    // Defensive: return the original background URL unchanged. The s3Key
    // is best-effort here — strip the URL prefix to get a usable key.
    return {
      imageUrl: backgroundUrl,
      s3Key: backgroundUrl.split("/").pop() || "",
    };
  }
}
