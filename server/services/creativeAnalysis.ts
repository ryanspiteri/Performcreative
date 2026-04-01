/**
 * AI-powered creative analysis — summary, quality scoring, and pipeline config suggestion.
 * Uses a single Claude call per ad to minimize cost and latency.
 * Called lazily when a user views an ad that hasn't been analyzed yet.
 */

import { callClaude } from "./_shared";
import * as db from "../db";
import { ACTIVE_PRODUCTS } from "../../drizzle/schema";

export interface CreativeAnalysisResult {
  summary: string;
  qualityScore: number;
  suggestedConfig: {
    product: string;
    funnelStage: "cold" | "warm" | "retargeting" | "retention";
    duration: number;
    styleConfig: Array<{ styleId: string; quantity: number }>;
    actorArchetype: string | null;
  };
}

const ANALYSIS_SYSTEM = `You are an expert ad creative analyst for ONEST Health, an Australian health supplement brand. You analyze competitor advertisements and return structured JSON.

Available ONEST products: ${ACTIVE_PRODUCTS.join(", ")}

Script styles: DR (Direct Response), UGC (Testimonial), FOUNDER (Founder-Led), EDUCATION (Education/Myth-Busting), LIFESTYLE (Lifestyle/Aspiration), DEMO (Problem/Solution Demo)

Actor archetypes: FitnessEnthusiast, BusyMum, Athlete, Biohacker, WellnessAdvocate

Funnel stages: cold (new audiences), warm (engaged), retargeting (visited site), retention (existing customers)`;

/**
 * Analyze a creative and return summary, quality score, and suggested pipeline config.
 * Returns null if analysis fails (caller should handle gracefully).
 */
export async function analyzeCreative(ad: {
  id: number;
  title: string | null;
  brandName: string | null;
  description: string | null;
  transcription: string | null;
  type: "VIDEO" | "STATIC";
}): Promise<CreativeAnalysisResult | null> {
  const adContext = [
    `Type: ${ad.type}`,
    ad.title ? `Title: ${ad.title}` : null,
    ad.brandName ? `Brand: ${ad.brandName}` : null,
    ad.description ? `Description: ${ad.description.slice(0, 2000)}` : null,
    ad.transcription ? `Transcription: ${ad.transcription.slice(0, 3000)}` : null,
  ].filter(Boolean).join("\n");

  if (!adContext || adContext.length < 20) {
    // Not enough content to analyze meaningfully
    return null;
  }

  const prompt = `Analyze this competitor ad and return a JSON object with exactly this structure:

{
  "summary": "<one-line summary, max 80 chars, e.g. 'DR testimonial, pre-workout focus, social proof hook, strong CTA'>",
  "qualityScore": <1-10 integer rating: hook strength, CTA clarity, production value, category relevance>,
  "suggestedConfig": {
    "product": "<most relevant ONEST product to counter this ad>",
    "funnelStage": "<cold|warm|retargeting|retention>",
    "duration": <45|60|90>,
    "styleConfig": [{"styleId": "<best matching style>", "quantity": 1}],
    "actorArchetype": "<best matching archetype or null>"
  }
}

Return ONLY valid JSON, no markdown fences, no explanation.

Ad to analyze:
${adContext}`;

  try {
    const raw = await callClaude(
      [{ role: "user", content: prompt }],
      ANALYSIS_SYSTEM,
      1024
    );

    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.summary || typeof parsed.qualityScore !== "number" || !parsed.suggestedConfig) {
      console.warn(`[CreativeAnalysis] Malformed response for ad ${ad.id}: missing required fields`);
      return null;
    }

    // Clamp score to 1-10
    parsed.qualityScore = Math.max(1, Math.min(10, Math.round(parsed.qualityScore)));

    // Validate product is from known list
    if (!ACTIVE_PRODUCTS.includes(parsed.suggestedConfig.product as any)) {
      parsed.suggestedConfig.product = "Hyperburn"; // safe default
    }

    return parsed as CreativeAnalysisResult;
  } catch (err: any) {
    console.error(`[CreativeAnalysis] Failed to analyze ad ${ad.id}:`, err.message?.slice(0, 200));
    return null;
  }
}

/**
 * Analyze a creative and persist the results to the database.
 * Returns the analysis result, or null if analysis failed.
 */
export async function analyzeAndPersist(adId: number): Promise<CreativeAnalysisResult | null> {
  const dbConn = await db.getDb();
  if (!dbConn) return null;

  // Fetch the ad
  const ad = await db.getForeplayCreativeById(adId);
  if (!ad) return null;

  // Skip if already analyzed
  if (ad.summary && ad.qualityScore !== null) {
    return {
      summary: ad.summary,
      qualityScore: ad.qualityScore,
      suggestedConfig: ad.suggestedConfig as CreativeAnalysisResult["suggestedConfig"],
    };
  }

  const result = await analyzeCreative(ad);
  if (!result) return null;

  // Persist to DB
  await db.updateForeplayCreativeAnalysis(adId, {
    summary: result.summary,
    qualityScore: result.qualityScore,
    suggestedConfig: result.suggestedConfig,
  });

  return result;
}
