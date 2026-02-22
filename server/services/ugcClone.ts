/**
 * UGC Clone Engine Service
 * 
 * Handles transcription, structure extraction, and variant generation
 * for uploaded winning UGC videos.
 */

import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";

export interface StructureBlueprint {
  hook: {
    text: string;
    startTime: number;
    endTime: number;
    strength: "strong" | "medium" | "weak";
  };
  body: {
    text: string;
    startTime: number;
    endTime: number;
    keyPoints: string[];
  };
  cta: {
    text: string;
    startTime: number;
    endTime: number;
    urgency: "high" | "medium" | "low";
  };
  pacing: {
    wordsPerMinute: number;
    pauseCount: number;
    energyLevel: "high" | "medium" | "low";
  };
  complianceLanguage: string[]; // Exact phrases that must be preserved
  structuralNotes: string;
}

export interface VariantGenerationConfig {
  uploadId: number;
  product: string;
  audienceTag?: string;
  desiredOutputVolume: number;
  structureBlueprint: StructureBlueprint;
  transcript: string;
}

export interface GeneratedVariant {
  variantNumber: number;
  actorArchetype: string;
  voiceTone: string;
  energyLevel: "low" | "medium" | "high";
  scriptText: string;
  hookVariation: string;
  ctaVariation: string;
  runtime: number; // estimated seconds
}

/**
 * Extract structure blueprint from transcript using Claude Vision + timestamps
 */
export async function extractStructureBlueprint(
  transcript: string,
  videoUrl: string
): Promise<StructureBlueprint> {
  const prompt = `You are analyzing a winning UGC video transcript to extract its structural blueprint.

TRANSCRIPT:
${transcript}

Your task:
1. Identify the HOOK (first 3-5 seconds) — the attention-grabbing opening
2. Identify the BODY — the main content with key selling points
3. Identify the CTA — the call-to-action at the end
4. Detect pacing characteristics (words per minute, energy level)
5. Extract any compliance language that must be preserved exactly (e.g., disclaimers, claims)

CRITICAL RULES:
- Preserve the structural timing — hook length, body flow, CTA placement
- Identify what makes the hook STRONG (pattern interrupt, question, bold claim, relatability)
- Note the energy level (high/medium/low) based on pacing and tone
- Flag any compliance phrases that cannot be altered

Return a detailed structural analysis.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a UGC video structure analyst. You extract winning patterns from transcripts." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "structure_blueprint",
        strict: true,
        schema: {
          type: "object",
          properties: {
            hook: {
              type: "object",
              properties: {
                text: { type: "string" },
                startTime: { type: "number" },
                endTime: { type: "number" },
                strength: { type: "string", enum: ["strong", "medium", "weak"] },
              },
              required: ["text", "startTime", "endTime", "strength"],
              additionalProperties: false,
            },
            body: {
              type: "object",
              properties: {
                text: { type: "string" },
                startTime: { type: "number" },
                endTime: { type: "number" },
                keyPoints: { type: "array", items: { type: "string" } },
              },
              required: ["text", "startTime", "endTime", "keyPoints"],
              additionalProperties: false,
            },
            cta: {
              type: "object",
              properties: {
                text: { type: "string" },
                startTime: { type: "number" },
                endTime: { type: "number" },
                urgency: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["text", "startTime", "endTime", "urgency"],
              additionalProperties: false,
            },
            pacing: {
              type: "object",
              properties: {
                wordsPerMinute: { type: "number" },
                pauseCount: { type: "number" },
                energyLevel: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["wordsPerMinute", "pauseCount", "energyLevel"],
              additionalProperties: false,
            },
            complianceLanguage: { type: "array", items: { type: "string" } },
            structuralNotes: { type: "string" },
          },
          required: ["hook", "body", "cta", "pacing", "complianceLanguage", "structuralNotes"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content || typeof content !== "string") throw new Error("No structure blueprint generated");

  return JSON.parse(content) as StructureBlueprint;
}

/**
 * Generate N controlled variants from the structure blueprint
 */
export async function generateVariants(
  config: VariantGenerationConfig
): Promise<GeneratedVariant[]> {
  const { desiredOutputVolume, structureBlueprint, transcript, product, audienceTag } = config;

  // Define actor archetypes and voice tones to distribute across
  const actorArchetypes = [
    "fitness enthusiast",
    "busy mum",
    "athlete",
    "biohacker",
    "wellness advocate",
    "gym regular",
    "health-conscious professional",
  ];

  const voiceTones = ["energetic", "calm", "authoritative", "relatable", "conversational"];
  const energyLevels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];

  const prompt = `You are generating ${desiredOutputVolume} controlled UGC script variants from a winning structure.

ORIGINAL TRANSCRIPT:
${transcript}

STRUCTURE BLUEPRINT:
- Hook: "${structureBlueprint.hook.text}" (${structureBlueprint.hook.strength} strength)
- Body: ${structureBlueprint.body.keyPoints.join(", ")}
- CTA: "${structureBlueprint.cta.text}" (${structureBlueprint.cta.urgency} urgency)
- Pacing: ${structureBlueprint.pacing.wordsPerMinute} WPM, ${structureBlueprint.pacing.energyLevel} energy
- Compliance: ${structureBlueprint.complianceLanguage.join("; ")}

PRODUCT: ${product}
AUDIENCE: ${audienceTag || "general fitness audience"}

CRITICAL RULES:
1. PRESERVE STRUCTURE — same hook/body/CTA timing and flow
2. PRESERVE COMPLIANCE LANGUAGE — use exact phrases from complianceLanguage array
3. MUTATE SURFACE ONLY — change phrasing, actor archetype, tone, energy
4. NO NEW CLAIMS — only rephrase existing benefits
5. MAINTAIN FIRST 3 SECONDS STRENGTH — hook must grab attention immediately
6. RESPECT PACING — match approximate word count and rhythm

Generate ${desiredOutputVolume} variants distributed across:
- Actor archetypes: ${actorArchetypes.slice(0, Math.min(7, desiredOutputVolume)).join(", ")}
- Voice tones: ${voiceTones.join(", ")}
- Energy levels: low, medium, high

Each variant should feel like a different person saying the same winning message.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a UGC script variant generator. You create controlled mutations of winning structures." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "variant_batch",
        strict: true,
        schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  variantNumber: { type: "number" },
                  actorArchetype: { type: "string" },
                  voiceTone: { type: "string" },
                  energyLevel: { type: "string", enum: ["low", "medium", "high"] },
                  scriptText: { type: "string" },
                  hookVariation: { type: "string" },
                  ctaVariation: { type: "string" },
                  runtime: { type: "number" },
                },
                required: ["variantNumber", "actorArchetype", "voiceTone", "energyLevel", "scriptText", "hookVariation", "ctaVariation", "runtime"],
                additionalProperties: false,
              },
            },
          },
          required: ["variants"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content || typeof content !== "string") throw new Error("No variants generated");

  const parsed = JSON.parse(content) as { variants: GeneratedVariant[] };
  return parsed.variants;
}
