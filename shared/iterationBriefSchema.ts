import { z } from "zod";

export const AD_ANGLES = [
  "auto",
  "claim_led",
  "before_after",
  "testimonial",
  "ugc_organic",
  "product_hero",
  "lifestyle",
] as const;
export type AdAngle = (typeof AD_ANGLES)[number];

export const STYLE_MODES = [
  "MATCH_REFERENCE",
  "EVOLVE_REFERENCE",
  "DEPART_FROM_REFERENCE",
] as const;
export type StyleMode = (typeof STYLE_MODES)[number];

export const VARIATION_TYPES = [
  "headline_only",
  "background_only",
  "layout_only",
  "benefit_callouts_only",
  "props_only",
  "talent_swap",
  "full_remix",
] as const;
export type VariationType = (typeof VARIATION_TYPES)[number];

export const DETECTED_FX_TYPES = [
  "fire",
  "smoke",
  "lightning",
  "ice",
  "explosion",
  "glow",
  "none",
] as const;
export type DetectedFxType = (typeof DETECTED_FX_TYPES)[number];

export const VISUAL_DESCRIPTION_MAX = 400;

export const iterationBriefVariationV1Schema = z.object({
  number: z.number().int().min(1),
  variationType: z.enum(VARIATION_TYPES),
  angle: z.string().min(1),
  angleDescription: z.string().default(""),
  headline: z.string().min(1),
  subheadline: z.string().default(""),
  visualDescription: z.string().max(VISUAL_DESCRIPTION_MAX).default(""),
  backgroundNote: z.string().default(""),
  benefitCallouts: z.array(z.string()).default([]),
  adAngle: z.enum(AD_ANGLES).optional(),
});

export const iterationBriefV1Schema = z.object({
  version: z.literal(1),
  originalHeadline: z.string().default(""),
  originalAngle: z.string().default(""),
  preserveElements: z.array(z.string()).default([]),
  targetAudience: z.string().default(""),
  referenceFxPresent: z.boolean().default(false),
  detectedFxTypes: z.array(z.enum(DETECTED_FX_TYPES)).default([]),
  variations: z.array(iterationBriefVariationV1Schema).min(1),
});

export type IterationBriefV1 = z.infer<typeof iterationBriefV1Schema>;
export type IterationBriefVariationV1 = z.infer<typeof iterationBriefVariationV1Schema>;

export type ParsedBrief =
  | { version: 1; data: IterationBriefV1 }
  | { version: 0; raw: unknown };

export function parseIterationBrief(raw: string | null | undefined): ParsedBrief | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed && typeof parsed === "object" && (parsed as any).version === 1) {
    const result = iterationBriefV1Schema.safeParse(parsed);
    if (result.success) return { version: 1, data: result.data };
    return null;
  }
  return { version: 0, raw: parsed };
}

export function isLegacyBrief(parsed: ParsedBrief | null): parsed is { version: 0; raw: unknown } {
  return parsed !== null && parsed.version === 0;
}
