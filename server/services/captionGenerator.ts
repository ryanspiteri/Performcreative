/**
 * Caption Generator Service
 *
 * Generates social media post captions for the organic content pipeline
 * using Claude AI. Produces platform-specific variants (Instagram, TikTok,
 * LinkedIn) in Ryan Spiteri's voice, guided by content pillars and purposes.
 */

import { callClaude, runWithConcurrency, CONTENT_PILLARS, CONTENT_PURPOSES, PLATFORMS } from "./_shared";
import * as db from "../db";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CaptionInput {
  pillar: string;
  purpose: string;
  topic: string;
  context?: string;
}

interface CaptionOutput {
  instagram: string;
  tiktok: string;
  linkedin: string;
}

interface CaptionError {
  error: string;
}

// ─── Pillar & purpose guidance ──────────────────────────────────────────────

const PILLAR_GUIDANCE: Record<string, string> = {
  "PTC Value": "Product-focused content. Highlight the product's value, ingredients, benefits, or results. Weave genuine product advocacy into the narrative without sounding like a hard ad.",
  "Story": "Personal narrative content. Share a real story from Ryan's life — vulnerability, lessons learned, pivotal moments. Make the audience feel something.",
  "Edutaining": "Teach + entertain. Deliver real value (a tip, hack, insight) in a way that's engaging and shareable. Think 'I didn't know that' moments.",
  "Trends": "Ride a trending format, sound, or cultural moment. Put Ryan's unique spin on it. Keep it timely and relevant.",
  "Sale": "Sales-driven content. Create urgency, highlight offers, and drive action. Still needs to feel authentic to Ryan's voice.",
  "Motivation": "Inspirational/motivational content. Share mindset, discipline, and ambition. Speak to the grind and the vision.",
  "Life Dump": "Raw, unfiltered life content. Day-in-the-life, behind the scenes, casual and relatable. Low production, high connection.",
  "Workout": "Fitness and training content. Share exercises, routines, form tips, or gym culture moments. Blend expertise with energy.",
};

const PURPOSE_GUIDANCE: Record<string, string> = {
  "Educate": "Teach something specific. The audience should walk away knowing something they didn't before.",
  "Inspire": "Move the audience emotionally. Make them want to take action, believe in themselves, or see things differently.",
  "Entertain": "Make them laugh, react, or share. Engagement is the priority.",
  "Sell": "Drive a specific action — purchase, click, sign-up. Still needs to feel organic and authentic.",
  "Connect": "Build relationship and trust. Make the audience feel seen, heard, or understood.",
};

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(
  pillar: string,
  purpose: string,
  fewShotExamples: Array<{ platform: string; captionText: string; topic: string }>
): string {
  const pillarGuide = PILLAR_GUIDANCE[pillar] || `Content pillar: ${pillar}. Write appropriately for this style.`;
  const purposeGuide = PURPOSE_GUIDANCE[purpose] || `Content purpose: ${purpose}. Write with this intent.`;

  let examplesBlock = "";
  if (fewShotExamples.length > 0) {
    examplesBlock = `

## Few-Shot Examples (Ryan's real captions for reference)

${fewShotExamples.map((ex, i) => `### Example ${i + 1} [${ex.platform}] — Topic: ${ex.topic}
${ex.captionText}`).join("\n\n")}

Use these examples to match Ryan's voice, tone, and style. Do not copy them — use them as calibration.`;
  }

  return `You are a world-class social media copywriter ghostwriting for Ryan Spiteri.

## About Ryan Spiteri
- 2M+ follower fitness/business content creator
- CEO and founder of ONEST Health (premium sports nutrition brand)
- Known for: direct, confident, no-BS communication style
- Vulnerable and real when sharing personal stories
- Balances hustle/grind energy with genuine care for his audience
- Australian, uses casual/conversational language but never sloppy
- Does NOT use corporate speak or generic motivational fluff

## Voice Characteristics
- Direct and confident — says what he means
- Vulnerable when appropriate — not afraid to share failures and lessons
- Conversational — writes like he talks
- Uses short, punchy sentences mixed with longer thoughts
- Occasionally uses slang/informal language naturally
- Never preachy or holier-than-thou
- Authentic — the audience can tell he means it

## Content Pillar: ${pillar}
${pillarGuide}

## Content Purpose: ${purpose}
${purposeGuide}

## Caption Structure
Each caption MUST include:
1. **Hook line** — The first line that stops the scroll. Bold, provocative, curiosity-driven, or emotionally charged. This is the most important line.
2. **Body** — The value, insight, story, or message. Keep it tight — every sentence earns its place.
3. **CTA (Call to Action)** — Soft for organic content. Ask a question, invite a comment, or nudge engagement. NOT a hard sell unless the purpose is "Sell".
4. **Hashtags** — Platform-specific (see below).

## Platform-Specific Rules

### Instagram
- Can be longer (up to 2200 chars) — use the space when the story demands it
- 30 relevant hashtags at the end (mix of broad + niche fitness/business tags)
- Use line breaks for readability
- Emojis are OK but don't overdo it

### TikTok
- Short and punchy — the video does most of the talking
- 3-5 hashtags max, trend-aware
- Keep it under 300 characters ideally
- The caption complements the video, doesn't repeat it

### LinkedIn
- Professional but still Ryan's authentic voice
- No hashtags or minimal (1-3 max)
- Can be longer and more reflective
- Focus on business lessons, leadership, or mindset
- Still conversational — not corporate${examplesBlock}

## Response Format
You MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON.
The JSON must have exactly three keys: "instagram", "tiktok", "linkedin".
Each value is the full caption text as a string for that platform.

Example structure:
{"instagram": "caption here...", "tiktok": "caption here...", "linkedin": "caption here..."}`;
}

// ─── Core caption generation ────────────────────────────────────────────────

/**
 * Parse Claude's JSON response, with one retry on parse failure.
 */
async function parseClaudeJsonResponse(
  raw: string,
  retryFn: () => Promise<string>
): Promise<CaptionOutput> {
  // Try to extract JSON from the response (handle markdown code fences)
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.instagram || !parsed.tiktok || !parsed.linkedin) {
      throw new Error("Missing required platform keys in response");
    }
    return {
      instagram: parsed.instagram,
      tiktok: parsed.tiktok,
      linkedin: parsed.linkedin,
    };
  } catch (err: any) {
    console.log(`[CaptionGen] JSON parse failed (${err.message}), retrying once...`);

    // Retry once
    const retryRaw = await retryFn();
    let retryStr = retryRaw.trim();
    const retryFenceMatch = retryStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (retryFenceMatch) {
      retryStr = retryFenceMatch[1].trim();
    }

    const retryParsed = JSON.parse(retryStr);
    if (!retryParsed.instagram || !retryParsed.tiktok || !retryParsed.linkedin) {
      throw new Error("Missing required platform keys in retry response");
    }
    return {
      instagram: retryParsed.instagram,
      tiktok: retryParsed.tiktok,
      linkedin: retryParsed.linkedin,
    };
  }
}

/**
 * Generate captions for all 3 platforms (Instagram, TikTok, LinkedIn) in a
 * single Claude call.
 */
export async function generateCaption(input: CaptionInput): Promise<CaptionOutput> {
  const { pillar, purpose, topic, context } = input;

  console.log(`[CaptionGen] Generating captions — pillar="${pillar}" purpose="${purpose}" topic="${topic}"`);

  // Fetch few-shot examples from DB matching pillar + purpose
  let fewShotExamples: Array<{ platform: string; captionText: string; topic: string }> = [];
  try {
    const examples = await db.listCaptionExamples(pillar, purpose);
    fewShotExamples = (examples || []).slice(0, 3).map((ex: any) => ({
      platform: ex.platform,
      captionText: ex.captionText,
      topic: ex.topic,
    }));
    if (fewShotExamples.length > 0) {
      console.log(`[CaptionGen] Found ${fewShotExamples.length} few-shot example(s) for ${pillar}/${purpose}`);
    }
  } catch (err: any) {
    console.log(`[CaptionGen] Could not fetch few-shot examples: ${err.message}`);
  }

  // Build the system prompt
  const systemPrompt = buildSystemPrompt(pillar, purpose, fewShotExamples);

  // Build the user message
  let userMessage = `Write captions for all 3 platforms (Instagram, TikTok, LinkedIn) for the following:

**Content Pillar:** ${pillar}
**Purpose:** ${purpose}
**Topic:** ${topic}`;

  if (context) {
    userMessage += `\n**Additional Context:** ${context}`;
  }

  userMessage += `

Remember: respond with valid JSON only. Keys: "instagram", "tiktok", "linkedin".`;

  const messages = [{ role: "user", content: userMessage }];

  // Call Claude and parse the response
  const callClaudeFn = () => callClaude(messages, systemPrompt, 4096);

  const raw = await callClaudeFn();
  const result = await parseClaudeJsonResponse(raw, callClaudeFn);

  console.log(`[CaptionGen] Successfully generated captions for topic="${topic}"`);
  return result;
}

// ─── Batch caption generation ───────────────────────────────────────────────

/**
 * Generate captions for multiple items concurrently (max 3 at a time).
 * Handles partial failures — continues generating remaining captions if one fails.
 */
export async function generateBatchCaptions(
  items: CaptionInput[]
): Promise<Array<CaptionOutput | CaptionError>> {
  console.log(`[CaptionGen] Starting batch generation for ${items.length} item(s), concurrency=3`);

  const tasks = items.map((item, index) => {
    return async (): Promise<CaptionOutput | CaptionError> => {
      try {
        console.log(`[CaptionGen] Batch item ${index + 1}/${items.length}: "${item.topic}"`);
        return await generateCaption(item);
      } catch (err: any) {
        console.log(`[CaptionGen] Batch item ${index + 1} failed: ${err.message}`);
        return { error: `Failed to generate caption for "${item.topic}": ${err.message}` };
      }
    };
  });

  const results = await runWithConcurrency(tasks, 3);

  const successes = results.filter((r) => !("error" in r)).length;
  const failures = results.length - successes;
  console.log(`[CaptionGen] Batch complete: ${successes} succeeded, ${failures} failed`);

  return results;
}
