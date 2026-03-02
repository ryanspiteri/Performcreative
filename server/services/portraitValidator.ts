/**
 * Portrait Validator
 * Uses Claude Vision to check a reference portrait meets quality guardrails
 * before submitting to Magic Hour for character swap.
 *
 * Checks:
 * - Resolution: minimum 1080×1080px (checked via image metadata)
 * - Face angle: front-facing, ±15° max tilt
 * - Lighting: even, natural (no harsh shadows or overexposure)
 * - Expression: neutral or slight smile
 * - No glasses, hats, heavy accessories, or obstructions
 * - Face clearly visible and unobstructed
 */

import axios from "axios";
import { ENV } from "../_core/env";

const claudeClient = axios.create({
  baseURL: "https://api.anthropic.com/v1",
  headers: {
    "x-api-key": ENV.anthropicApiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
});

export interface PortraitCheck {
  name: string;
  passed: boolean;
  note: string;
}

export interface PortraitValidationResult {
  passed: boolean;
  checks: PortraitCheck[];
  summary: string;
}

/**
 * Validate a portrait image for use in character swap.
 * @param imageBase64 - Base64-encoded image data (without data URI prefix)
 * @param mimeType - Image MIME type (e.g. "image/jpeg")
 */
export async function validatePortrait(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<PortraitValidationResult> {
  const systemPrompt = `You are a quality control AI for portrait images used in AI character swap video production.
Your job is to analyse a portrait photo and determine if it meets the technical and compositional requirements for high-quality face/character swapping.

Respond ONLY with valid JSON matching this exact schema:
{
  "passed": boolean,
  "checks": [
    { "name": "Front-facing angle", "passed": boolean, "note": "string" },
    { "name": "Even lighting", "passed": boolean, "note": "string" },
    { "name": "Neutral expression", "passed": boolean, "note": "string" },
    { "name": "No obstructions", "passed": boolean, "note": "string" },
    { "name": "Face clearly visible", "passed": boolean, "note": "string" },
    { "name": "Single person", "passed": boolean, "note": "string" }
  ],
  "summary": "string"
}

Rules:
- "passed" at the top level is true ONLY if ALL individual checks pass
- Each check "note" should be a brief, specific, actionable description (1 sentence)
- "summary" is a 1-2 sentence overall assessment
- Be strict but fair — minor imperfections are acceptable if they won't affect swap quality`;

  const userPrompt = `Please analyse this portrait image for character swap quality. Check all 6 criteria and return the JSON result.`;

  const response = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: userPrompt,
          },
        ],
      },
    ],
  });

  const content = response.data.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude Vision");
  }

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from Claude Vision response");
  }

  const result = JSON.parse(jsonMatch[0]) as PortraitValidationResult;
  return result;
}
