/**
 * Script Generator Pipeline — standalone script creation without reference videos.
 *
 * User picks: product, script style, sub-structure, funnel stage, archetype, concept.
 * Pipeline builds context → generates scripts via Claude → expert review → complete.
 */

import * as db from "../db";
import {
  callClaude,
  buildProductInfoContext,
  withTimeout,
  STEP_TIMEOUT,
  STAGE_4_TIMEOUT,
  runWithConcurrency,
} from "./_shared";
import {
  SCRIPT_STYLES,
  SCRIPT_SUB_STRUCTURES,
  FUNNEL_STAGE_RULES,
  ARCHETYPE_PROFILES,
  PRODUCT_INTELLIGENCE,
  HOOK_BANK,
  CTA_BANK,
  TRANSITION_LOGIC,
  SCRIPT_AUDIT_CHECKLIST,
  COMPLIANCE_RULES,
  DEUTSCH_COPY_FRAMEWORK,
  getStyleSystemPrompt,
  getSubStructurePromptBlock,
  reviewScriptWithPanel,
  fetchWinningExamples,
  type ScriptStyleId,
  type FunnelStage,
  type ActorArchetype,
  type VideoBriefOptions,
} from "./videoPipeline";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScriptPipelineParams {
  product: string;
  scriptStyle: ScriptStyleId;
  subStructureId: string;
  funnelStage: FunnelStage;
  archetype: ActorArchetype;
  angle: string;
  concept: string;
  scriptCount: number;
}

// ─── Main pipeline ──────────────────────────────────────────────────────────

export async function runScriptPipeline(
  runId: number,
  params: ScriptPipelineParams
): Promise<void> {
  const {
    product,
    scriptStyle,
    subStructureId,
    funnelStage,
    archetype,
    angle,
    concept,
    scriptCount,
  } = params;

  try {
    await db.updatePipelineRun(runId, {
      status: "running",
      scriptStage: "stage_1_context",
    });

    // ── Stage 1: Build context ────────────────────────────────────────────
    console.log(`[ScriptPipeline] Run #${runId} — Stage 1: Building context`);

    const productInfoContext = await withTimeout(
      buildProductInfoContext(product),
      STEP_TIMEOUT,
      "buildProductInfoContext"
    );

    const productIntel = PRODUCT_INTELLIGENCE[product];

    // Resolve sub-structure: DB first (custom structures), fall back to hardcoded
    const hardcodedSubStructure = SCRIPT_SUB_STRUCTURES.find(s => s.id === subStructureId);
    let subStructure: { name: string; awarenessLevel: string; psychologicalLever: string } | undefined = hardcodedSubStructure;
    if (!subStructure && subStructureId) {
      const dbStructure = await db.getScriptStructure(subStructureId).catch(() => null);
      if (dbStructure) {
        const d = dbStructure.data as any;
        subStructure = {
          name: dbStructure.name,
          awarenessLevel: d?.awarenessLevel || "PROBLEM_AWARE",
          psychologicalLever: d?.psychologicalLever || "Product-benefit driven",
        };
      }
    }

    const styleLabel = SCRIPT_STYLES.find(s => s.id === scriptStyle)?.label || scriptStyle;
    const funnelRules = FUNNEL_STAGE_RULES[funnelStage];

    // Resolve archetype profile: DB first (custom audiences), fall back to hardcoded
    let archetypeProfile: { label: string; lifeContext: string; languageRegister: string; preProductObjection: string } | undefined =
      ARCHETYPE_PROFILES[archetype as ActorArchetype];
    if (!archetypeProfile) {
      const dbAudience = await db.getScriptAudience(archetype).catch(() => null);
      if (dbAudience) {
        const d = dbAudience.data as any;
        archetypeProfile = {
          label: dbAudience.label,
          lifeContext: d?.lifeContext || "",
          languageRegister: d?.languageRegister || "",
          preProductObjection: d?.preProductObjection || "",
        };
      }
    }
    // Last-resort safety net so the pipeline never crashes on a missing archetype
    if (!archetypeProfile) {
      archetypeProfile = {
        label: archetype || "General audience",
        lifeContext: "",
        languageRegister: "",
        preProductObjection: "",
      };
    }

    const otherLevers = productIntel
      ? productIntel.copyLevers.filter(l => l !== angle)
      : [];

    const productIntelBlock = productIntel
      ? `
=== PRODUCT INTELLIGENCE (YOU MUST USE THIS) ===
${productIntel.fullName} — ${productIntel.category}
Primary Benefit: ${productIntel.primaryBenefit}
Differentiator: ${productIntel.differentiator}
Key Ingredients: ${productIntel.keyIngredients.join(", ")}

PRIMARY SELLING ANGLE (emphasize this above all others — this is the core message of the script):
${angle}

OTHER PRODUCT LEVERS (secondary context — weave in naturally if relevant):
${otherLevers.map((l, i) => `${i + 1}. ${l}`).join("\n")}

COPY TRAPS (AVOID these):
${productIntel.copyTraps.map((t, i) => `${i + 1}. ${t}`).join("\n")}
=== END PRODUCT INTELLIGENCE ===`
      : `
=== SELLING ANGLE (YOU MUST USE THIS) ===
PRIMARY SELLING ANGLE (emphasize this above all others):
${angle}
=== END SELLING ANGLE ===`;

    // Fetch winning examples for few-shot injection (non-blocking — empty string on failure)
    const winningExamplesBlock = await fetchWinningExamples(product, funnelStage, scriptStyle);
    if (winningExamplesBlock) {
      console.log(`[ScriptPipeline] Run #${runId} — Winning examples loaded (${winningExamplesBlock.length} chars)`);
    }

    await db.updatePipelineRun(runId, { scriptStage: "stage_2_generation" });

    // ── Stage 2: Generate scripts ─────────────────────────────────────────
    console.log(`[ScriptPipeline] Run #${runId} — Stage 2: Generating ${scriptCount} scripts`);

    const duration = 60; // default 60s scripts
    const durationRange = "50-65";
    const segmentCount = "8-12";

    const system = getStyleSystemPrompt(scriptStyle, product, duration, funnelStage);

    // Build sub-structure block from the resolved structure (works for both hardcoded + DB structures)
    const subStructureBlock = subStructure
      ? `
ASSIGNED SUB-STRUCTURE: ${subStructureId} — ${subStructure.name}
Awareness: ${subStructure.awarenessLevel}
Psychological lever: ${subStructure.psychologicalLever}

Follow this sub-structure's progression in the script.
`
      : getSubStructurePromptBlock(subStructureId);

    const scriptTypeDesc =
      scriptStyle === "DR" ? "direct response script"
      : scriptStyle === "UGC" ? "UGC (user-generated content) script"
      : scriptStyle === "FOUNDER" ? "founder-led script"
      : scriptStyle === "BRAND" ? "brand/equity script"
      : scriptStyle === "EDUCATION" ? "educational script"
      : scriptStyle === "LIFESTYLE" ? "lifestyle script"
      : scriptStyle === "DEMO" ? "product demo script"
      : `${styleLabel} script`;

    // Testimonial-flavoured styles where the voice IS the character.
    // All other styles (DR, EDUCATION, DEMO, BRAND, custom) should NOT speak in first person —
    // the archetype is the target viewer, not the narrator.
    const isTestimonialStyle = scriptStyle === "UGC" || scriptStyle === "LIFESTYLE" || scriptStyle === "FOUNDER";

    const audienceBlock = isTestimonialStyle
      ? `AUDIENCE ARCHETYPE (your character's voice — speak AS this person):
Label: ${archetypeProfile.label}
Life context: ${archetypeProfile.lifeContext}
Language register: ${archetypeProfile.languageRegister}
Pre-product objection: ${archetypeProfile.preProductObjection}

Apply this voice profile throughout the script. The character's life context, language register, and pre-product objection must be woven into the dialogue naturally.`
      : `TARGET VIEWER (who you are writing TO — NOT who you are writing AS):
Label: ${archetypeProfile.label}
Life context: ${archetypeProfile.lifeContext}
Their primary objection before buying: ${archetypeProfile.preProductObjection}

Use this to understand the viewer's situation and pain points. The script's voice must remain the ${styleLabel} voice defined in the system prompt — do NOT write in first person or mimic the viewer's tone.`;

    const styleGuardrail = isTestimonialStyle
      ? ""
      : `
CRITICAL STYLE ENFORCEMENT: This is a ${scriptTypeDesc}, NOT a UGC testimonial. Do NOT write in first person ("I've been...", "I was struggling..."). Do NOT narrate personal experience. Do NOT sound like a customer review. Write scripted ad copy in the voice of the ${styleLabel} format.
`;

    const generateOne = async (index: number) => {
      const variationNote = scriptCount > 1
        ? `This is variation ${index + 1} of ${scriptCount}. Make each variation DISTINCTLY DIFFERENT — use a different hook archetype, different proof structure, and different emotional arc. Do NOT repeat hooks or structures from other variations.`
        : "";

      const prompt = `Write a ${scriptTypeDesc} for ONEST Health's ${product} based on the user's creative concept.
${styleGuardrail}
CREATIVE CONCEPT (from the user):
${concept}

${variationNote}

${subStructureBlock}

FUNNEL STAGE: ${funnelStage}
${funnelRules}

${audienceBlock}

${HOOK_BANK}

${CTA_BANK}

${TRANSITION_LOGIC}

${DEUTSCH_COPY_FRAMEWORK}

${SCRIPT_AUDIT_CHECKLIST}

${COMPLIANCE_RULES}

=== PRODUCT INFORMATION (YOU MUST USE THIS) ===
${productInfoContext || `Product: ONEST ${product}. Brand: ONEST Health. Website: onest.com.au.`}
${productIntelBlock}
=== END PRODUCT INFORMATION ===
${winningExamplesBlock}
Return your response in this EXACT JSON format:
{
  "title": "Short descriptive title for this script",
  "hook": "exact opening line — stops the scroll as a complete idea in under 3 seconds",
  "script": [
    {
      "timestamp": "0-3s",
      "visual": "what the viewer sees",
      "dialogue": "what is said — every line serves the sale",
      "transitionLine": "single sentence closing this segment and opening the next"
    },
    ...more rows covering ${durationRange} seconds total (${segmentCount} segments)
  ],
  "visualDirection": "2-3 sentences describing the visual style and production approach.",
  "strategicThesis": "Paragraph: (1) how this concept drives interest, (2) how it sells ONEST ${product} specifically, (3) what psychological triggers drive purchase intent, (4) why the CTA approach will convert"
}

CRITICAL: Every script segment MUST include a transitionLine field (except the final CTA segment). The transitionLine is a single sentence that closes the current segment and opens the next, making the structural shift feel inevitable rather than engineered.

Make the script ~${duration} seconds long with ${segmentCount} timestamp segments.`;

      const response = await withTimeout(
        callClaude([{ role: "user", content: prompt }], system, 6000),
        STEP_TIMEOUT,
        `generateScript_${index + 1}`
      );

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsed.subStructureId = subStructureId;
          parsed.scriptMetadata = {
            product: `ONEST ${product}`,
            targetPersona: productIntel?.targetPersona || archetypeProfile.label,
            awarenessLevel: subStructure?.awarenessLevel || "PROBLEM_AWARE",
            funnelStage,
            scriptStyle: styleLabel,
            subStructure: subStructureId,
            hookArchetype: "CONCEPT_DRIVEN",
            testHypothesis: `Testing ${subStructureId} structure with ${archetype} archetype for ${product} at ${funnelStage} funnel stage`,
            primaryObjection: archetypeProfile.preProductObjection,
            actorArchetype: archetype,
          };
          if (!parsed.visualDirectionBrief) {
            parsed.visualDirectionBrief = {
              overallStyle: scriptStyle === "UGC" ? "Phone-filmed, natural lighting, real environment" : "Polished direct response energy",
              colorPalette: "ONEST brand colours",
              pacing: "Medium pacing",
              shots: [],
            };
          }
          return parsed;
        }
      } catch (e) {
        console.error(`[ScriptPipeline] Failed to parse script ${index + 1}:`, e);
      }

      // Fallback
      return {
        title: `${styleLabel} Script ${index + 1}`,
        hook: "Opening hook",
        script: [
          { timestamp: "0-3s", visual: "Opening shot", dialogue: "Hook line", transitionLine: "But here's what most people don't realise..." },
          { timestamp: "3-15s", visual: "Problem setup", dialogue: "Problem statement", transitionLine: "And that's exactly why this matters." },
          { timestamp: "15-35s", visual: "Solution", dialogue: `ONEST ${product} changes everything.`, transitionLine: "The results speak for themselves." },
          { timestamp: "35-50s", visual: "Proof", dialogue: "Social proof and results.", transitionLine: "So here's what you can do right now." },
          { timestamp: "50-60s", visual: "CTA", dialogue: "Click the link below." },
        ],
        visualDirection: "Standard production approach.",
        strategicThesis: "Concept-driven script for ONEST.",
        subStructureId,
        scriptMetadata: {
          product: `ONEST ${product}`,
          targetPersona: archetypeProfile.label,
          awarenessLevel: "PROBLEM_AWARE",
          funnelStage,
          scriptStyle: styleLabel,
          subStructure: subStructureId,
          hookArchetype: "CONCEPT_DRIVEN",
          testHypothesis: "Concept-driven script generation",
          primaryObjection: archetypeProfile.preProductObjection,
          actorArchetype: archetype,
        },
        visualDirectionBrief: {
          overallStyle: "Standard",
          colorPalette: "ONEST brand colours",
          pacing: "Medium pacing",
          shots: [],
        },
      };
    };

    const tasks = Array.from({ length: scriptCount }, (_, i) => () => generateOne(i));
    const scripts = await withTimeout(
      runWithConcurrency(tasks, 2),
      STAGE_4_TIMEOUT,
      "scriptGeneration"
    );

    await db.updatePipelineRun(runId, {
      scriptsJson: scripts,
      scriptStage: "stage_3_review",
    });

    // ── Stage 3: Expert review ────────────────────────────────────────────
    console.log(`[ScriptPipeline] Run #${runId} — Stage 3: Expert review`);

    // Build a synthetic brief for the review function
    const syntheticBrief: VideoBriefOptions = {
      funnelStage,
      competitorConceptAnalysis: concept,
      hookStyle: "Concept-driven (standalone script generator)",
      hookArchetype: "CONCEPT_DRIVEN",
      narrativeFramework: subStructure?.name || styleLabel,
      persuasionMechanism: subStructure?.psychologicalLever || "Product-benefit driven",
      productSellingAngle: concept,
      onestAdaptation: concept,
      concepts: [],
      targetAudience: archetypeProfile.label,
      toneAndEnergy: scriptStyle === "UGC" ? "Authentic, conversational" : scriptStyle === "FOUNDER" ? "Authoritative, passionate" : "Professional, persuasive",
      awarenessLevel: subStructure?.awarenessLevel || "PROBLEM_AWARE",
      primaryObjection: archetypeProfile.preProductObjection,
      competitiveRepositioning: "N/A — standalone script",
      stackOpportunity: "N/A",
    };

    const reviewedScripts = [];
    for (let i = 0; i < scripts.length; i++) {
      console.log(`[ScriptPipeline] Run #${runId} — Reviewing script ${i + 1}/${scripts.length}`);
      try {
        const review = await withTimeout(
          reviewScriptWithPanel(
            scripts[i],
            product,
            styleLabel,
            syntheticBrief,
            productInfoContext,
            funnelStage
          ),
          STAGE_4_TIMEOUT,
          `reviewScript_${i + 1}`
        );
        reviewedScripts.push({
          ...scripts[i],
          review,
        });
      } catch (err: any) {
        console.error(`[ScriptPipeline] Review failed for script ${i + 1}:`, err.message);
        reviewedScripts.push({
          ...scripts[i],
          review: {
            rounds: [],
            finalScore: 0,
            approved: false,
            summary: `Review failed: ${err.message}`,
          },
        });
      }

      // Save progress after each review
      await db.updatePipelineRun(runId, {
        scriptsJson: reviewedScripts,
      });
    }

    // ── Stage 4: Complete ─────────────────────────────────────────────────
    console.log(`[ScriptPipeline] Run #${runId} — Stage 4: Complete`);

    await db.updatePipelineRun(runId, {
      status: "completed",
      scriptStage: "stage_4_complete",
      scriptsJson: reviewedScripts,
      completedAt: new Date(),
    });

    console.log(`[ScriptPipeline] Run #${runId} — Pipeline completed successfully`);
  } catch (err: any) {
    console.error(`[ScriptPipeline] Run #${runId} — Pipeline failed:`, err.message);
    await db.updatePipelineRun(runId, {
      status: "failed",
      errorMessage: err.message || "Unknown error in script pipeline",
    }).catch(() => {});
  }
}
