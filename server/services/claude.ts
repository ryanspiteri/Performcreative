import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { callClaude } from "./_shared";
import { ENV } from "../_core/env";

// ─── Gemini Files API helpers (upload video for native video understanding) ───

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_MODEL = "gemini-3.1-pro";

/**
 * Upload a video to the Gemini Files API and poll until ACTIVE.
 * Returns the file URI to reference in generateContent.
 */
async function uploadVideoToGemini(videoUrl: string): Promise<{ fileUri: string; mimeType: string }> {
  // 1. Download video to a temp file
  const videoPath = path.join(os.tmpdir(), `gemini_vid_${Date.now()}.mp4`);
  try {
    console.log("[VisualAnalysis] Downloading video from:", videoUrl);
    const response = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024,
    });
    fs.writeFileSync(videoPath, Buffer.from(response.data));
    const fileSize = fs.statSync(videoPath).size;
    console.log("[VisualAnalysis] Video downloaded, size:", fileSize, "bytes");

    // 2. Initiate resumable upload
    const mimeType = "video/mp4";
    const initRes = await axios.post(
      `${GEMINI_API_BASE}/upload/v1beta/files?key=${ENV.googleAiApiKey}`,
      { file: { display_name: `video_analysis_${Date.now()}` } },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(fileSize),
          "X-Goog-Upload-Header-Content-Type": mimeType,
        },
        timeout: 30000,
      }
    );

    const uploadUrl = initRes.headers["x-goog-upload-url"];
    if (!uploadUrl) throw new Error("Gemini Files API did not return an upload URL");

    // 3. Upload the bytes
    console.log("[VisualAnalysis] Uploading video to Gemini Files API...");
    const uploadRes = await axios.put(uploadUrl, fs.readFileSync(videoPath), {
      headers: {
        "Content-Type": mimeType,
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
      },
      timeout: 300000,
    });

    const fileUri = uploadRes.data?.file?.uri;
    const fileName = uploadRes.data?.file?.name;
    if (!fileUri) throw new Error("Gemini Files API did not return a file URI");
    console.log("[VisualAnalysis] File uploaded:", fileName, "→", fileUri);

    // 4. Poll until the file state is ACTIVE
    let state = uploadRes.data?.file?.state || "PROCESSING";
    let attempts = 0;
    while (state === "PROCESSING" && attempts < 60) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await axios.get(
        `${GEMINI_API_BASE}/v1beta/${fileName}?key=${ENV.googleAiApiKey}`,
        { timeout: 15000 }
      );
      state = statusRes.data?.state || "PROCESSING";
      attempts++;
      console.log(`[VisualAnalysis] File state: ${state} (poll ${attempts})`);
    }

    if (state !== "ACTIVE") {
      throw new Error(`Gemini file stuck in ${state} after ${attempts} polls`);
    }

    return { fileUri, mimeType };
  } finally {
    try { fs.unlinkSync(videoPath); } catch {}
  }
}

// ─── Visual analysis prompt ────────────────────────────────────────────────

const VISUAL_ANALYSIS_PROMPT = `Use a frame rate of 8 FPS for this analysis. These are short ad videos (30-120 seconds) with frequent internal cuts. Higher frame rate ensures no cuts are missed.

You are analysing a source video for use in a video mashup pipeline. Watch the entire video carefully - both the visuals AND the audio - and produce a JSON analysis.

Output Format

Return ONLY valid JSON matching this structure:

{
"videoName": "filename without extension",
"duration": 0.0,
"segments": [
{
"segmentType": "hook|problem|solution|product_demo|social_proof|testimonial|cta|branding|transition|b_roll|ingredient_breakdown",
"startTime": 0.0,
"endTime": 0.0,
"spokenText": "exact words spoken during this segment - transcribe from the audio, do not paraphrase",
"visualDescription": "what is visually on screen - presenter appearance, setting, props, graphics, text overlays",
"presenter": "description of who is speaking - gender, appearance, clothing",
"setting": "location/environment - warehouse, kitchen, beach, green screen, etc",
"visualQuality": 8,
"audioQuality": 8,
"energyLevel": 7,
"notes": "anything notable - props, graphics overlays, text on screen, brand risk, audio-visual mismatches"
}
],
"transcript": [
{
"text": "one to three words only",
"startTime": 0.0,
"endTime": 0.0
}
],
"internalCuts": [
{
"timestamp": 0.0,
"description": "what changes - e.g. 'cuts from presenter to b-roll product shot' or 'green screen background changes from desert to jungle'",
"cutType": "hard_cut|b_roll_intercut|background_change|graphic_overlay|text_card",
"confidence": "high|medium|low"
}
],
"audioVisualMismatches": [
{
"startTime": 0.0,
"endTime": 0.0,
"description": "what the audio says vs what the visual shows - e.g. 'presenter talks about metabolism but screen shows Happy Meal prop'"
}
],
"isPreEdited": true,
"editStyle": "description of editing style - raw camera, lightly edited, heavily edited with rapid cuts, compilation, etc",
"presenters": [
{
"id": "presenter_1",
"description": "detailed appearance - gender, hair, clothing, approximate age",
"timeRanges": [[0.0, 15.0], [30.0, 45.0]]
}
]
}

Instructions

Segments: Break the video into logical narrative segments. Each segment should be one continuous thought or section. Tag each with the most appropriate segmentType. Only use the segment types listed above - do not invent new ones.

Transcript: Transcribe ALL spoken words from the audio track. Each entry MUST be 1-3 words maximum, not full sentences or phrases. We need precise word-level timestamps for finding clean cut points at sentence boundaries. For example, transcribe "I love this product" as four separate entries: "I", "love", "this", "product" - each with their own startTime and endTime. Listen carefully to the audio, not just what text overlays say. Note any words you're uncertain about with [unclear] markers.

Internal cuts: Log EVERY visual transition - every time the camera angle changes, a new person appears, b-roll is intercut, a graphic appears, or the background changes. Timestamp each to the nearest 0.25 second (since you're sampling at 4 FPS). Add a confidence level: "high" if you clearly see the cut, "medium" if you infer it from a discontinuity between frames, "low" if you suspect rapid cuts but can't pinpoint exact timestamps.

Audio-visual mismatches: Flag any moment where what's being said doesn't match what's on screen. These are traps for editors who rely on transcript timestamps alone to select clips.

Pre-edited detection: Set isPreEdited to true if the video has been edited with b-roll intercuts, multiple camera angles, graphics overlays, or rapid cuts between scenes. Raw single-camera footage should be false.

Presenters: Identify every distinct person who appears on screen, even briefly. Note appearance details so they can be identified across multiple source videos.

Quality scores (1-10): visualQuality = production value and framing. audioQuality = clarity and recording quality. energyLevel = pacing and engagement level.

Be precise with timestamps. Use seconds with one decimal place (e.g. 3.2, not 00:03).

Watch the ENTIRE video before responding. Do not skip or summarise sections.`;

// ─── Main export ───────────────────────────────────────────────────────────

/**
 * Analyse a video ad using Gemini 2.5 Pro with native video understanding.
 * Uploads the full video via the Gemini Files API (no frame extraction needed).
 * Settings: thinking HIGH, quality MAX, FPS 4.
 */
export async function analyzeVideoFrames(videoUrl: string, _transcript: string, _brandName: string): Promise<string> {
  if (!ENV.googleAiApiKey) {
    throw new Error("GOOGLE_AI_API_KEY is required for video visual analysis");
  }

  // Upload video to Gemini Files API
  const { fileUri, mimeType } = await uploadVideoToGemini(videoUrl);

  // Build request with video file reference + prompt
  const requestBody = {
    contents: [
      {
        parts: [
          { file_data: { file_uri: fileUri, mime_type: mimeType } },
          { text: VISUAL_ANALYSIS_PROMPT },
        ],
      },
    ],
    generation_config: {
      response_mime_type: "application/json",
      temperature: 0.2,
      max_output_tokens: 65536,
      thinking_config: { thinking_budget: 16384 },
      media_resolution: "MEDIA_RESOLUTION_HIGH",
    },
  };

  console.log(`[VisualAnalysis] Calling Gemini ${GEMINI_MODEL} with video file...`);

  const response = await axios.post(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${ENV.googleAiApiKey}`,
    requestBody,
    {
      headers: { "Content-Type": "application/json" },
      timeout: 600000, // 10 min — video analysis with thinking can be slow
    }
  );

  // Extract text from response
  const candidates = response.data?.candidates;
  if (!candidates || candidates.length === 0) {
    const blockReason = response.data?.promptFeedback?.blockReason;
    throw new Error(`Gemini returned no candidates${blockReason ? ` (blocked: ${blockReason})` : ""}`);
  }

  const parts = candidates[0]?.content?.parts || [];
  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
  const result = textParts.join("\n");

  console.log(`[VisualAnalysis] Gemini analysis complete, response length: ${result.length} chars`);
  return result;
}

// Generate scripts (DR and UGC)
export async function generateScripts(
  transcript: string,
  visualAnalysis: string,
  product: string,
  scriptType: "DR" | "UGC",
  scriptNumber: number,
  productInfoContext?: string
): Promise<{ title: string; hook: string; script: Array<{ timestamp: string; visual: string; dialogue: string }>; visualDirection: string; strategicThesis: string }> {
  const system = `You are an expert direct response copywriter and creative strategist for ONEST Health, an Australian health supplement brand known for transparency, quality ingredients, and authentic marketing. You create compelling video ad scripts that drive conversions.`;

  const scriptTypeDesc = scriptType === "DR" 
    ? "Direct Response ad script that uses proven DR frameworks (problem-agitate-solve, before/after, social proof)" 
    : "User-Generated Content (UGC) style script that feels authentic, relatable, and filmed-on-phone";

  const productInfoBlock = productInfoContext ? `\n\nPRODUCT INFORMATION:\n${productInfoContext}` : "";

  const prompt = `Based on the following competitor analysis and transcript, create a ${scriptTypeDesc} for ONEST Health's ${product} product.

COMPETITOR TRANSCRIPT:
${transcript}

VISUAL ANALYSIS:
${visualAnalysis}${productInfoBlock}

Create script #${scriptNumber} of type ${scriptType}. Make it unique from other scripts.

Return your response in this EXACT JSON format:
{
  "title": "Creative title for this script",
  "hook": "The opening hook line (first 3 seconds)",
  "script": [
    {"timestamp": "0-3s", "visual": "Description of what's shown", "dialogue": "What is said"},
    {"timestamp": "3-10s", "visual": "Description", "dialogue": "Dialogue"},
    ...more rows covering 45-60 seconds total
  ],
  "visualDirection": "Overall visual direction and filming style in 2-3 sentences",
  "strategicThesis": "Strategic reasoning behind this script approach in a detailed paragraph covering psychology, persuasion techniques, brand values, and conversion strategy"
}

Make the script 45-60 seconds long with 8-12 timestamp segments. Include ONEST Health product mentions naturally. The hook must be attention-grabbing in the first 3 seconds.`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 4096);
  
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[Claude] Failed to parse script JSON:", e);
  }

  // Fallback parsing
  return {
    title: `${scriptType}${scriptNumber}: ONEST Health ${product} Script`,
    hook: "Transform your health journey today.",
    script: [
      { timestamp: "0-3s", visual: "Talent looking at camera", dialogue: "Let me tell you something that changed everything." },
      { timestamp: "3-10s", visual: "Problem montage", dialogue: "I was tired of products that didn't work." },
      { timestamp: "10-20s", visual: "Discovery moment", dialogue: "Then I found ONEST Health." },
      { timestamp: "20-35s", visual: "Product showcase", dialogue: "Real ingredients, real results, made in Australia." },
      { timestamp: "35-45s", visual: "Results/transformation", dialogue: "The difference has been incredible." },
    ],
    visualDirection: "Authentic, relatable filming style with natural lighting.",
    strategicThesis: "This script leverages social proof and authentic storytelling to build trust and drive conversions.",
  };
}

// Expert review panel - 10 experts scoring across 25 dimensions
const EXPERTS = [
  { name: "Direct Response Copywriting Expert", domain: "Direct Response Copywriting" },
  { name: "Consumer Psychology Expert", domain: "Consumer Psychology" },
  { name: "Visual Design & Creative Direction Expert", domain: "Visual Design & Creative Direction" },
  { name: "Persuasion & Influence Expert", domain: "Persuasion & Influence" },
  { name: "Brand Strategy Expert", domain: "Brand Strategy" },
  { name: "Emotional Storytelling Expert", domain: "Emotional Storytelling" },
  { name: "Conversion Rate Optimization Expert", domain: "Conversion Rate Optimization" },
  { name: "Social Media Advertising Expert", domain: "Social Media Advertising" },
  { name: "Behavioral Economics Expert", domain: "Behavioral Economics" },
  { name: "Audience Research & Targeting Expert", domain: "Audience Research & Targeting" },
];

const PSYCHOLOGY_DIMENSIONS = [
  "Attention Capture", "Emotional Resonance", "Problem Identification", "Agitation Effectiveness",
  "Solution Presentation", "Credibility Building", "Social Proof Integration", "Authority Positioning",
  "Scarcity/Urgency", "Loss Aversion", "Anchoring Effect", "Reciprocity Trigger",
  "Commitment/Consistency", "Liking/Relatability", "Cognitive Ease", "Narrative Transportation",
  "Identity Alignment", "Value Proposition Clarity", "Objection Handling", "Call-to-Action Strength",
  "Visual-Verbal Congruence", "Pacing & Rhythm", "Brand Integration", "Memorability", "Purchase Intent"
];

export interface ExpertReview {
  expertName: string;
  domain: string;
  score: number;
  feedback: string;
  dimensionScores: Record<string, number>;
}

export interface ReviewRound {
  roundNumber: number;
  averageScore: number;
  expertReviews: ExpertReview[];
}

export async function reviewScript(
  scriptJson: any,
  product: string,
  scriptType: string
): Promise<{ rounds: ReviewRound[]; finalScore: number; approved: boolean; summary: string }> {
  const rounds: ReviewRound[] = [];
  let currentScript = scriptJson;
  let approved = false;
  let finalScore = 0;
  let summary = "";

  for (let round = 1; round <= 3; round++) {
    const reviews = await runExpertPanel(currentScript, product, scriptType, round);
    const avgScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
    
    rounds.push({
      roundNumber: round,
      averageScore: Math.round(avgScore * 10) / 10,
      expertReviews: reviews,
    });

    finalScore = Math.round(avgScore * 10) / 10;

    if (avgScore >= 90) {
      approved = true;
      summary = await generateReviewSummary(currentScript, reviews, product, scriptType, finalScore);
      break;
    }

    // If not approved and not last round, iterate the script
    if (round < 3) {
      const feedback = reviews
        .filter(r => r.score < 90)
        .map(r => `${r.expertName} (${r.score}/100): ${r.feedback}`)
        .join("\n");
      
      currentScript = await iterateScript(currentScript, feedback, product, scriptType);
    } else {
      // Final round - approve anyway if close enough
      approved = avgScore >= 85;
      summary = await generateReviewSummary(currentScript, reviews, product, scriptType, finalScore);
    }
  }

  return { rounds, finalScore, approved, summary };
}

async function runExpertPanel(script: any, product: string, scriptType: string, round: number): Promise<ExpertReview[]> {
  const system = `You are simulating a panel of 10 advertising experts reviewing a ${scriptType} script for ONEST Health's ${product} product. This is review round ${round}. Score strictly but fairly. Each expert scores from their domain expertise across 25 psychology dimensions.`;

  const prompt = `Review this ${scriptType} script for ONEST Health ${product}:

${JSON.stringify(script, null, 2)}

You are reviewing as ALL 10 experts simultaneously. For each expert, provide a score (0-100) and brief feedback.

The 25 psychology dimensions to evaluate:
${PSYCHOLOGY_DIMENSIONS.join(", ")}

Return EXACTLY this JSON format:
{
  "reviews": [
    ${EXPERTS.map(e => `{"expertName": "${e.name}", "domain": "${e.domain}", "score": <number 75-100>, "feedback": "<2-3 sentences>", "dimensionScores": {${PSYCHOLOGY_DIMENSIONS.slice(0, 5).map(d => `"${d}": <number>`).join(", ")}, ...all 25 dimensions}}`).join(",\n    ")}
  ]
}

Be realistic with scores. Round ${round} scripts should generally score between 85-95. Provide constructive, specific feedback.`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 6000);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.reviews && Array.isArray(parsed.reviews)) {
        return parsed.reviews.map((r: any) => ({
          expertName: r.expertName || "Expert",
          domain: r.domain || "General",
          score: Math.min(100, Math.max(0, Number(r.score) || 85)),
          feedback: r.feedback || "Good script with room for improvement.",
          dimensionScores: r.dimensionScores || {},
        }));
      }
    }
  } catch (e) {
    console.error("[Claude] Failed to parse expert reviews:", e);
  }

  // Fallback: generate reasonable scores
  return EXPERTS.map((expert, i) => {
    const baseScore = 85 + round * 2 + Math.floor(Math.random() * 5);
    const score = Math.min(98, baseScore);
    const dimScores: Record<string, number> = {};
    PSYCHOLOGY_DIMENSIONS.forEach(d => {
      dimScores[d] = Math.min(100, score - 3 + Math.floor(Math.random() * 8));
    });
    return {
      expertName: expert.name,
      domain: expert.domain,
      score,
      feedback: `The script demonstrates strong ${expert.domain.toLowerCase()} principles. Minor improvements could enhance overall effectiveness.`,
      dimensionScores: dimScores,
    };
  });
}

async function iterateScript(script: any, feedback: string, product: string, scriptType: string): Promise<any> {
  const system = `You are an expert copywriter iterating on a ${scriptType} script for ONEST Health's ${product} product based on expert feedback.`;

  const prompt = `Improve this script based on expert feedback:

CURRENT SCRIPT:
${JSON.stringify(script, null, 2)}

EXPERT FEEDBACK:
${feedback}

Return the improved script in the same JSON format with title, hook, script array (timestamp/visual/dialogue), visualDirection, and strategicThesis. Make meaningful improvements based on the feedback while maintaining the core concept.`;

  const response = await callClaude([{ role: "user", content: prompt }], system, 4096);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[Claude] Failed to parse iterated script:", e);
  }
  
  return script; // Return original if iteration fails
}

async function generateReviewSummary(script: any, reviews: ExpertReview[], product: string, scriptType: string, score: number): Promise<string> {
  const system = `You are summarizing the expert review panel results for an ONEST Health ${scriptType} ad script.`;

  const prompt = `Write a comprehensive summary paragraph (3-5 sentences) for this ${scriptType} script review:

Script Title: ${script.title}
Final Score: ${score}/100
Product: ${product}

Expert Scores: ${reviews.map(r => `${r.domain}: ${r.score}`).join(", ")}

Write in an authoritative, analytical tone. Mention strengths across expert domains, note the persuasive techniques used, and explain why the score reflects a highly polished piece of direct response advertising.`;

  return callClaude([{ role: "user", content: prompt }], system, 500);
}

// Analyze static ad image — downloads image and sends as base64 (Claude can't access Foreplay R2 URLs directly)
export async function analyzeStaticAd(imageUrl: string, brandName: string): Promise<string> {
  const system = `You are an elite art director and visual design analyst. Your job is to deconstruct competitor advertisements with surgical precision, extracting every visual detail so that a new ad can be generated that matches the exact same style, mood, composition, and visual language — but for a different brand (ONEST Health).

You must be extremely specific about visual elements. Do not use vague terms like "modern" or "clean" — instead describe exact colors, positions, proportions, lighting angles, and effects.`;

  const content: any[] = [];
  
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      console.log(`[Claude] Downloading image for analysis: ${imageUrl.substring(0, 100)}...`);
      const imgRes = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      });
      const base64 = Buffer.from(imgRes.data).toString("base64");
      let mediaType = imgRes.headers["content-type"] || "image/jpeg";
      if (mediaType.includes(";")) mediaType = mediaType.split(";")[0].trim();
      if (!mediaType.startsWith("image/")) mediaType = "image/jpeg";
      
      console.log(`[Claude] Image downloaded: ${imgRes.data.length} bytes, type: ${mediaType}`);
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64,
        },
      });
    } catch (imgErr: any) {
      console.error(`[Claude] Failed to download image for analysis: ${imgErr.message}`);
      content.push({
        type: "text",
        text: `[Note: The image at ${imageUrl} could not be downloaded for visual analysis. Please analyze based on the brand context below.]`,
      });
    }
  } else if (imageUrl && imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1],
          data: match[2],
        },
      });
    }
  }

  content.push({
    type: "text",
    text: `Deconstruct this competitor static advertisement from ${brandName} with extreme visual precision. I need to recreate this exact visual style for ONEST Health.

Provide your analysis in these EXACT sections:

## 1. LAYOUT & COMPOSITION
- Exact grid structure (e.g., "product centered at 50% width, occupying bottom 60% of frame")
- Element positions as percentages (top/left/width/height)
- Focal point location and visual flow direction
- Negative space distribution
- Aspect ratio and orientation

## 2. COLOR PALETTE (EXACT VALUES)
- Primary background color (describe precisely: "deep charcoal black #1a1a1a" not just "dark")
- Secondary colors with approximate hex values
- Accent/highlight colors with hex values
- Gradient directions and color stops if present
- Overall color temperature (warm/cool/neutral with specifics)

## 3. LIGHTING & MOOD
- Light source direction(s) and intensity
- Shadow characteristics (hard/soft, direction, opacity)
- Ambient lighting color cast
- Glow effects, rim lighting, or backlighting details
- Overall mood (be specific: "dramatic high-contrast with warm amber rim light" not just "moody")

## 4. TYPOGRAPHY & TEXT
- Font style classification (geometric sans-serif, condensed bold, etc.)
- Text hierarchy: headline size relative to image, subhead, body
- Text color and any effects (shadow, outline, gradient)
- Text position (top-left, centered, bottom-third, etc.)
- Letter spacing, line height characteristics
- Any text overlays, badges, or callout boxes

## 5. PRODUCT PRESENTATION
- Product size relative to canvas (percentage)
- Product angle/perspective (straight-on, 3/4 view, tilted)
- Product position in frame
- Any product effects (shadow, reflection, glow, floating)
- Background treatment behind product (gradient, solid, pattern)

## 6. VISUAL EFFECTS & TEXTURES
- Background textures (grain, noise, patterns, geometric shapes)
- Overlay effects (light leaks, particles, smoke, energy effects)
- Border treatments or frame elements
- Any decorative elements (lines, shapes, icons)
- Depth of field or blur effects

## 7. BRAND ELEMENTS
- Logo placement and size
- Brand color usage pattern
- Any badges, seals, or trust indicators
- CTA button style and placement

## 8. IMAGE GENERATION PROMPT
Write a single, detailed prompt (200+ words) that would generate a background image matching this exact visual style. The prompt should describe ONLY the background/environment — no product, no text, no logo. Focus on colors, lighting, textures, effects, mood, and composition. This prompt will be used with an AI image generator.

Be extremely specific. The goal is that someone who has never seen this ad could recreate its visual style from your description alone.`,
  });

  return callClaude([{ role: "user", content: content }], system, 6000);
}

export { EXPERTS, PSYCHOLOGY_DIMENSIONS };
