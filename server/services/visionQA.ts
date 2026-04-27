/**
 * Vision QA — validate-and-retry for product-label fidelity.
 *
 * After Gemini generates a variation, we ask Claude Vision to score the
 * output against the canonical /product-info render on five structural
 * criteria. The criteria are intentionally lenient on text (small text
 * drift is acceptable) but strict on structural design failures (wrong
 * body colour, wrong swoosh colour, missing wordmark, missing flavour
 * strip).
 *
 * On FAIL the caller (iterationPipeline.ts Stage 3) retries the variation
 * up to 2 times. If still failing, the variation is marked failed and the
 * other variations in the batch still ship via the partial-success path
 * from PR #27.
 *
 * Defensive defaults: any error in the QA path itself (Vision API down,
 * parse failure, missing canonical URL) returns PASS. We never block the
 * pipeline on QA hiccups — the QA exists to catch generation failures,
 * not become a new failure mode.
 */

import axios from "axios";
import { ENV } from "../_core/env";
import { claudeClient } from "./_shared";

export interface VisionQAResult {
  pass: boolean;
  reason?: string;
}

const VISION_QA_TIMEOUT_MS = 30_000;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a strict QA validator for product packaging fidelity in AI-generated ads. You compare a GENERATED ad image against a CANONICAL product reference render.

You score on 5 STRUCTURAL criteria. Be lenient on text accuracy (small text drift is acceptable) but strict on structural design.

For each criterion, mark PASS or FAIL:
1. body — does the tub body match the canonical's body colour family? (Catastrophic mismatch like white-vs-black is FAIL. Slight tonal drift is PASS.)
2. swoosh — does the swoosh / graphic match the canonical's colour family? (Wrong colour family like silver-instead-of-pink is FAIL. Mild drift is PASS.)
3. wordmark — is the brand wordmark visible and approximately the right typography? (Hallucinated text replacing the wordmark is FAIL. Slight kerning differences PASS.)
4. subtext — is there a subtext line under the wordmark? (Missing line is FAIL. Hallucinated text on the line is PASS — we don't score exact text accuracy.)
5. flavour_strip — is there a flavour label strip across the front in approximately the right colour family? (Missing strip is FAIL. Wrong text on the strip is PASS.)

Return ONLY valid JSON, no prose, no markdown fences:
{"criteria":{"body":"PASS|FAIL","swoosh":"PASS|FAIL","wordmark":"PASS|FAIL","subtext":"PASS|FAIL","flavour_strip":"PASS|FAIL"},"overall":"PASS|FAIL","reason":"short explanation under 100 chars"}

Overall is FAIL if ANY of the 5 criteria are FAIL. Otherwise PASS.`;

async function fetchImageBase64(url: string): Promise<{ data: string; mediaType: string }> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: IMAGE_FETCH_TIMEOUT_MS,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const buf = Buffer.from(res.data);
  let mediaType = (res.headers["content-type"] as string) || "image/png";
  if (mediaType.includes(";")) mediaType = mediaType.split(";")[0].trim();
  if (!mediaType.startsWith("image/")) mediaType = "image/png";
  return { data: buf.toString("base64"), mediaType };
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/**
 * Validate that a generated variation matches the canonical product render
 * on five structural criteria. Returns PASS/FAIL with a short reason on FAIL.
 *
 * Defensive defaults — returns PASS in any of these cases (we do NOT want
 * the QA to become a new failure mode for the pipeline):
 *   - ENV.disableVisionQA is true
 *   - generatedUrl or canonicalUrl is missing
 *   - Vision API call errors / times out
 *   - Vision response can't be parsed as JSON
 *   - Vision returns an unrecognised "overall" value
 *
 * The intended consumer is the Stage 3 retry loop in iterationPipeline.ts.
 */
export async function validateProductFidelity(
  generatedUrl: string | undefined,
  canonicalUrl: string | undefined,
): Promise<VisionQAResult> {
  if (ENV.disableVisionQA) {
    return { pass: true, reason: "vision QA disabled via env" };
  }

  if (!generatedUrl || !canonicalUrl) {
    console.warn(`[VQA] Missing URL (generated=${!!generatedUrl}, canonical=${!!canonicalUrl}), defaulting to PASS`);
    return { pass: true, reason: "missing reference image" };
  }

  try {
    const [generated, canonical] = await Promise.all([
      fetchImageBase64(generatedUrl),
      fetchImageBase64(canonicalUrl),
    ]);

    const userContent = [
      { type: "text", text: "GENERATED IMAGE (the AI output you are validating):" },
      {
        type: "image",
        source: { type: "base64", media_type: generated.mediaType, data: generated.data },
      },
      { type: "text", text: "CANONICAL REFERENCE (the truth — what the product should look like):" },
      {
        type: "image",
        source: { type: "base64", media_type: canonical.mediaType, data: canonical.data },
      },
      { type: "text", text: "Score the generated image against the canonical. Return JSON only." },
    ];

    const res = await claudeClient.post(
      "/messages",
      {
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      },
      { timeout: VISION_QA_TIMEOUT_MS },
    );

    const content = res.data?.content;
    const text = Array.isArray(content)
      ? content.map((c: any) => c.text || "").join("")
      : (content?.text ?? "");

    const jsonText = stripJsonFences(text);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.warn(`[VQA] Could not parse Claude response as JSON: ${text.slice(0, 200)}, defaulting to PASS`);
      return { pass: true, reason: "vqa parse failed" };
    }

    const overall = String(parsed?.overall ?? "").toUpperCase();
    if (overall === "PASS") {
      console.log(`[VQA] PASS`);
      return { pass: true };
    }
    if (overall === "FAIL") {
      const reason = String(parsed?.reason ?? "structural mismatch").slice(0, 200);
      console.warn(`[VQA] FAIL: ${reason}`);
      return { pass: false, reason };
    }
    console.warn(`[VQA] Unknown overall value "${overall}", defaulting to PASS`);
    return { pass: true, reason: "unknown vqa response" };
  } catch (err: any) {
    const msg = err?.message || "unknown error";
    console.warn(`[VQA] Vision call failed: ${msg}, defaulting to PASS`);
    return { pass: true, reason: `vqa error: ${msg}` };
  }
}
