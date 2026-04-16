/**
 * Auto-Generator — kick off script generation runs from winning patterns.
 *
 * Queries the intelligence system (performanceBanks + patternInsights) to find
 * the top winning combinations per product, then creates a pipeline_runs row
 * for each and fires runScriptPipeline in the background. Runs are stamped
 * with creativeSource='ai-playbook' for downstream A/B performance tracking.
 *
 * Admin-triggered via POST endpoint; also safe to schedule.
 */

import * as db from "../../db";
import { runScriptPipeline } from "../scriptPipeline";
import { buildIntelligenceBrief } from "./performanceBanks";
import { SCRIPT_STYLES, ARCHETYPE_PROFILES } from "../videoPipeline";
import type { ScriptStyleId, FunnelStage, ActorArchetype } from "../videoPipeline";

const TAG = "[AutoGenerator]";

// Same mapping as ScriptGenerator.tsx (client) — kept in sync manually.
const HOOK_TACTIC_TO_STRUCTURE: Record<string, { scriptStyle: string; subStructureId: string }> = {
  before_after:     { scriptStyle: "DR",      subStructureId: "DR-2" },
  question:         { scriptStyle: "DR",      subStructureId: "DR-5" },
  bold_claim:       { scriptStyle: "UGC",     subStructureId: "UGC-4" },
  ugc_testimonial:  { scriptStyle: "UGC",     subStructureId: "UGC-1" },
  product_demo:     { scriptStyle: "DEMO",    subStructureId: "UGC-6" },
  storytelling:     { scriptStyle: "DR",      subStructureId: "DR-7" },
  controversy:      { scriptStyle: "DR",      subStructureId: "DR-4" },
  listicle:         { scriptStyle: "EDUCATION", subStructureId: "UGC-6" },
};

export interface AutoGenerateOptions {
  /** Target product. If omitted, generates for all products with enough data. */
  product?: string;
  /** Funnel stage for the generated scripts. Default: cold. */
  funnelStage?: FunnelStage;
  /** How many scripts to generate per winning pattern. Default: 2. */
  scriptsPerPattern?: number;
  /** Max number of distinct patterns to generate from. Default: 3. */
  maxPatterns?: number;
  /** Default archetype when no data-driven pick exists. Default: first available. */
  defaultArchetype?: ActorArchetype;
}

export interface AutoGenerateResult {
  product: string;
  runsCreated: number;
  runIds: number[];
  errors: string[];
  patternsUsed: Array<{
    hookTactic?: string;
    messagingAngle?: string;
    scriptStyle: string;
    subStructureId: string;
  }>;
}

/**
 * Auto-generate scripts from winning patterns for a single product.
 */
export async function autoGenerateFromPatterns(
  options: AutoGenerateOptions = {}
): Promise<AutoGenerateResult> {
  const {
    product,
    funnelStage = "cold",
    scriptsPerPattern = 2,
    maxPatterns = 3,
    defaultArchetype,
  } = options;

  if (!product) {
    throw new Error("product is required for now — multi-product support coming in Wave 3");
  }

  const result: AutoGenerateResult = {
    product,
    runsCreated: 0,
    runIds: [],
    errors: [],
    patternsUsed: [],
  };

  try {
    // Build the intelligence brief for this product
    const brief = await buildIntelligenceBrief(product);
    if (!brief || brief.creativeCount < 3) {
      result.errors.push(`Insufficient data for ${product} (${brief?.creativeCount || 0} creatives). Need at least 3.`);
      return result;
    }

    // Build patterns to generate from: start with top hook tactic
    const patterns: Array<{ hookTactic?: string; messagingAngle?: string; scriptStyle: string; subStructureId: string }> = [];

    if (brief.topHookTactic && HOOK_TACTIC_TO_STRUCTURE[brief.topHookTactic.tactic]) {
      const mapped = HOOK_TACTIC_TO_STRUCTURE[brief.topHookTactic.tactic];
      patterns.push({
        hookTactic: brief.topHookTactic.tactic,
        messagingAngle: brief.topMessagingAngle?.angle,
        scriptStyle: mapped.scriptStyle,
        subStructureId: mapped.subStructureId,
      });
    }

    // Get a few more diverse patterns: query other high-scoring combinations
    // For now we keep it simple — just the top hook tactic. Expand later.

    const trimmed = patterns.slice(0, maxPatterns);
    if (trimmed.length === 0) {
      result.errors.push(`No mappable patterns found for ${product}`);
      return result;
    }

    // Pick a default archetype: first one that exists
    const archetype: ActorArchetype = defaultArchetype || (Object.keys(ARCHETYPE_PROFILES)[0] as ActorArchetype);
    const archetypeLabel = ARCHETYPE_PROFILES[archetype]?.label || archetype;

    for (const pattern of trimmed) {
      try {
        const angle = pattern.messagingAngle
          ? pattern.messagingAngle.replace(/_/g, " ")
          : "Performance-driven angle";

        const concept = `Auto-generated from winning pattern. Top hook tactic: ${pattern.hookTactic?.replace(/_/g, " ") || "unknown"}. Top messaging angle: ${angle}. Build a fresh ${scriptsPerPattern}-variant script package that captures these winning patterns for ${archetypeLabel}.`;

        const styleLabel = SCRIPT_STYLES.find(s => s.id === pattern.scriptStyle)?.label || pattern.scriptStyle;

        // Create pipeline run stamped as ai-playbook
        const runId = await db.createPipelineRun({
          pipelineType: "script",
          status: "pending",
          product,
          priority: "Medium",
          triggerSource: "auto_generator",
          scriptStyle: pattern.scriptStyle,
          scriptSubStructure: pattern.subStructureId,
          scriptFunnelStage: funnelStage,
          scriptArchetype: archetype,
          scriptAngle: angle,
          scriptConcept: concept,
          scriptCount: scriptsPerPattern,
          scriptStage: "pending",
          creativeSource: "ai-playbook",
        });

        result.runIds.push(runId);
        result.runsCreated++;
        result.patternsUsed.push(pattern);

        // Fire the pipeline in the background
        runScriptPipeline(runId, {
          product,
          scriptStyle: pattern.scriptStyle as ScriptStyleId,
          subStructureId: pattern.subStructureId,
          funnelStage,
          archetype,
          angle,
          concept,
          scriptCount: scriptsPerPattern,
        }).catch(err => {
          console.error(`${TAG} Background error for run #${runId}:`, err.message);
        });

        console.log(`${TAG} Created run #${runId} for pattern ${pattern.hookTactic}+${pattern.messagingAngle} (${styleLabel})`);
      } catch (err: any) {
        console.error(`${TAG} Failed to create run for pattern:`, err.message);
        result.errors.push(err.message);
      }
    }

    return result;
  } catch (err: any) {
    console.error(`${TAG} autoGenerateFromPatterns failed:`, err.message);
    result.errors.push(err.message);
    return result;
  }
}
