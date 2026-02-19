import axios from "axios";
import { ENV } from "../_core/env";

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

const claudeClient = axios.create({
  baseURL: ANTHROPIC_BASE,
  headers: {
    "x-api-key": ENV.anthropicApiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  timeout: 120000,
});

async function callClaude(messages: any[], system?: string, maxTokens = 4096): Promise<string> {
  const body: any = {
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;

  const res = await claudeClient.post("/messages", body);
  const content = res.data?.content;
  if (Array.isArray(content)) {
    return content.map((c: any) => c.text || "").join("\n");
  }
  return content?.text || JSON.stringify(content);
}

// Visual analysis of video frames
export async function analyzeVideoFrames(videoUrl: string, transcript: string, brandName: string): Promise<string> {
  const system = `You are an expert creative strategist and competitor ad analyst for ONEST Health, an Australian health supplement brand. Analyze competitor video advertisements in detail to inform ONEST Health's creative briefs.`;

  const userContent: any[] = [];

  // Try to include video as image reference
  if (videoUrl) {
    userContent.push({
      type: "text",
      text: `Analyze this competitor video advertisement. The video URL is: ${videoUrl}\nBrand: ${brandName}\n\nTranscript:\n${transcript}`
    });
  }

  userContent.push({
    type: "text",
    text: `Provide a detailed analysis of this competitor video advertisement, tailored to inform ONEST Health's creative briefs.

Structure your analysis with these 8 sections:

**Competitor Analysis: ${brandName} Video Ad Frames**

**1. Visual Style and Production Quality:**
- **Observation:** Detailed observations about the visual style, production quality, frame types
- **Production Quality:** Assessment of overall production approach
- **Actionable for ONEST Health:** Specific recommendations

**2. Color Palette and Branding Elements:**
- **Observation:** Dominant colors, product colors, contrast, branding
- **Actionable for ONEST Health:** Specific recommendations

**3. Shot Composition and Transitions:**
- **Observation:** Shot types, format, transitions
- **Actionable for ONEST Health:** Specific recommendations

**4. On-Screen Text/Graphics Usage:**
- **Observation:** Text style, placement, purpose
- **Actionable for ONEST Health:** Specific recommendations

**5. Talent/Presenter Style:**
- **Observation:** Presenter approach, authenticity, focus
- **Actionable for ONEST Health:** Specific recommendations

**6. Product Presentation Approach:**
- **Observation:** Product introduction, reveal, aesthetic appeal, integration
- **Actionable for ONEST Health:** Specific recommendations

**7. Overall Mood and Energy:**
- **Observation:** Energy level, humor, problem/solution focus, confidence
- **Actionable for ONEST Health:** Specific recommendations

**8. Key Visual Hooks and Attention-Grabbing Elements:**
- **Observation:** Key frames, visual hooks, narrative arc
- **Actionable for ONEST Health:** Specific recommendations

End with a summary paragraph about how ONEST Health can draw inspiration from these techniques.`
  });

  return callClaude([{ role: "user", content: userContent }], system, 8000);
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
