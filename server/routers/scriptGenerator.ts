import { protectedProcedure, publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { runScriptPipeline } from "../services/scriptPipeline";
import { createMultipleScriptTasks } from "../services/clickup";
import { callClaude, buildProductInfoContext } from "../services/_shared";
import {
  SCRIPT_STYLES,
  SCRIPT_SUB_STRUCTURES,
  ARCHETYPE_PROFILES,
  PRODUCT_INTELLIGENCE,
  type ScriptStyleId,
  type FunnelStage,
  type ActorArchetype,
} from "../services/videoPipeline";

// ─── ClickUp formatter ───────────────────────────────────────────────────────

export function formatScriptForClickUp(script: any): string {
  const lines: string[] = [];

  if (script.hook) {
    lines.push(`**HOOK:** ${script.hook}`, "");
  }

  if (Array.isArray(script.script)) {
    lines.push("**SCRIPT:**", "");
    for (const seg of script.script) {
      lines.push(`**${seg.timestamp ?? ""}**`);
      if (seg.visual) lines.push(`_Visual:_ ${seg.visual}`);
      if (seg.dialogue) lines.push(`_Dialogue:_ ${seg.dialogue}`);
      if (seg.transitionLine) lines.push(`_Transition:_ ${seg.transitionLine}`);
      lines.push("");
    }
  }

  if (script.visualDirection) {
    lines.push(`**VISUAL DIRECTION:** ${script.visualDirection}`, "");
  }

  if (script.strategicThesis) {
    lines.push(`**STRATEGIC THESIS:** ${script.strategicThesis}`, "");
  }

  return lines.join("\n").trim();
}

// ─── Structure schema ─────────────────────────────────────────────────────────

const structureDataSchema = z.object({
  funnelStages: z.array(z.string()),
  awarenessLevel: z.string(),
  psychologicalLever: z.string(),
  whyItConverts: z.string(),
  stages: z.array(z.object({ stage: z.string(), function: z.string() })),
});

const audienceDataSchema = z.object({
  lifeContext: z.string(),
  languageRegister: z.string(),
  preProductObjection: z.string(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const scriptGeneratorRouter = router({

  // ── Options ──────────────────────────────────────────────────────────────

  options: publicProcedure.query(async () => {
    const [dbStructures, dbAudiences] = await Promise.all([
      db.getScriptStructures().catch(() => [] as any[]),
      db.getScriptAudiences().catch(() => [] as any[]),
    ]);

    // Fall back to hardcoded defaults when a table is empty — avoids a blank
    // dropdown before an admin runs "Seed Defaults". Any rows in the DB
    // override the defaults completely so admin edits stay authoritative.
    const structures = dbStructures.length > 0
      ? dbStructures.map(s => ({
          id: s.structureId,
          name: s.name,
          category: s.category,
          data: s.data as any,
        }))
      : SCRIPT_SUB_STRUCTURES.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          data: {
            funnelStages: s.funnelStages,
            awarenessLevel: s.awarenessLevel,
            psychologicalLever: s.psychologicalLever,
            whyItConverts: s.whyItConverts,
            stages: s.stages,
          },
        }));

    const audiences = dbAudiences.length > 0
      ? dbAudiences.map(a => ({
          id: a.audienceId,
          label: a.label,
          data: a.data as any,
        }))
      : Object.entries(ARCHETYPE_PROFILES).map(([id, profile]) => ({
          id,
          label: profile.label,
          data: {
            lifeContext: profile.lifeContext,
            languageRegister: profile.languageRegister,
            preProductObjection: profile.preProductObjection,
          },
        }));

    const angles: Record<string, string[]> = {};
    for (const [product, intel] of Object.entries(PRODUCT_INTELLIGENCE)) {
      angles[product] = intel.copyLevers;
    }

    return {
      styles: SCRIPT_STYLES.map(s => ({ id: s.id, label: s.label, description: s.description })),
      structures,
      audiences,
      angles,
    };
  }),

  // ── Generate scripts ──────────────────────────────────────────────────────

  create: protectedProcedure
    .input(z.object({
      product: z.string().min(1),
      scriptStyle: z.string().min(1),
      subStructureId: z.string().optional(),
      funnelStage: z.enum(["cold", "warm", "retargeting", "retention"]),
      archetype: z.string().min(1),
      angle: z.string().min(1),
      concept: z.string().min(10, "Concept must be at least 10 characters"),
      scriptCount: z.number().int().min(1).max(5).default(3),
    }))
    .mutation(async ({ input }) => {
      const runId = await db.createPipelineRun({
        pipelineType: "script",
        status: "pending",
        product: input.product,
        priority: "Medium",
        triggerSource: "script_generator",
        scriptStyle: input.scriptStyle,
        scriptSubStructure: input.subStructureId,
        scriptFunnelStage: input.funnelStage as FunnelStage,
        scriptArchetype: input.archetype,
        scriptAngle: input.angle,
        scriptConcept: input.concept,
        scriptCount: input.scriptCount,
        scriptStage: "pending",
      });

      runScriptPipeline(runId, {
        product: input.product,
        scriptStyle: input.scriptStyle as ScriptStyleId,
        subStructureId: input.subStructureId || "",
        funnelStage: input.funnelStage as FunnelStage,
        archetype: input.archetype as ActorArchetype,
        angle: input.angle,
        concept: input.concept,
        scriptCount: input.scriptCount,
      }).catch(err =>
        console.error(`[ScriptGenerator] Background error for run #${runId}:`, err.message)
      );

      return { runId };
    }),

  // ── Generate AI concepts ─────────────────────────────────────────────────

  generateConcepts: protectedProcedure
    .input(z.object({
      product: z.string().min(1),
      scriptStyle: z.string().min(1),
      subStructureId: z.string().optional(),
      funnelStage: z.enum(["cold", "warm", "retargeting", "retention"]),
      archetype: z.string().min(1),
      angle: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Resolve sub-structure
      let subStructure: any = SCRIPT_SUB_STRUCTURES.find(s => s.id === input.subStructureId);
      if (!subStructure && input.subStructureId) {
        const dbStruct = await db.getScriptStructure(input.subStructureId).catch(() => null);
        if (dbStruct) subStructure = { name: dbStruct.name, ...(dbStruct.data as any) };
      }

      // Resolve archetype
      let archetypeProfile: any = ARCHETYPE_PROFILES[input.archetype as ActorArchetype];
      if (!archetypeProfile) {
        const dbAud = await db.getScriptAudience(input.archetype).catch(() => null);
        if (dbAud) archetypeProfile = { label: dbAud.label, ...(dbAud.data as any) };
      }

      const styleLabel = SCRIPT_STYLES.find(s => s.id === input.scriptStyle)?.label || input.scriptStyle;
      const productIntel = PRODUCT_INTELLIGENCE[input.product];
      const productInfo = await buildProductInfoContext(input.product).catch(() => "");

      const structureBlock = subStructure ? `
SUB-STRUCTURE: ${subStructure.name}
Psychological Lever: ${subStructure.psychologicalLever || "N/A"}
Awareness Level: ${subStructure.awarenessLevel || "N/A"}
Why It Converts: ${subStructure.whyItConverts || "N/A"}
Stages: ${subStructure.stages?.map((s: any) => s.stage).join(" → ") || "N/A"}` : "";

      const audienceBlock = archetypeProfile ? `
TARGET AUDIENCE: ${archetypeProfile.label || input.archetype}
Life Context: ${archetypeProfile.lifeContext || "N/A"}
Language Register: ${archetypeProfile.languageRegister || "N/A"}
Pre-Product Objection: ${archetypeProfile.preProductObjection || "N/A"}` : `TARGET AUDIENCE: ${input.archetype}`;

      const intelBlock = productIntel ? `
PRODUCT INTELLIGENCE:
Primary Benefit: ${productIntel.primaryBenefit}
Differentiator: ${productIntel.differentiator}
Key Ingredients: ${productIntel.keyIngredients.join(", ")}` : "";

      const prompt = `Generate 5 distinct creative concepts for an ONEST Health ${input.product} video ad script.

SCRIPT STYLE: ${styleLabel}
${structureBlock}
FUNNEL STAGE: ${input.funnelStage}
${audienceBlock}
SELLING ANGLE: ${input.angle}
${productInfo ? `\nPRODUCT INFO:\n${productInfo}` : ""}
${intelBlock}

Return EXACTLY this JSON format, no markdown:
{
  "concepts": [
    {
      "title": "Short punchy title (5-8 words)",
      "narrative": "2-3 sentence description of the creative concept — the story, the angle, the emotional arc",
      "whyItConverts": "1 sentence on the psychological mechanism that drives purchase intent",
      "suggestedHook": "The exact opening line of the ad"
    }
  ]
}

Rules:
- Each concept must be DISTINCTLY different — different narrative structure, different emotional lever, different hook approach
- Concepts must respect the funnel stage rules (cold = no product name in hook, warm = can reference brand)
- Concepts must speak to the target audience's life context and objections
- Concepts must leverage the psychological lever from the sub-structure
- At least one concept should be contrarian or unexpected
- No generic supplement marketing — be specific to this product and angle`;

      const system = "You are an expert creative strategist for DTC supplement advertising. You generate creative concepts that leverage audience psychology, funnel position, and product intelligence to drive purchase intent. Return only valid JSON.";

      const response = await callClaude([{ role: "user", content: prompt }], system, 4096);

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]) as { concepts: Array<{ title: string; narrative: string; whyItConverts: string; suggestedHook: string }> };
      } catch {}
      return { concepts: [] };
    }),

  // ── Poll status ───────────────────────────────────────────────────────────

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const run = await db.getPipelineRun(input.id);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Script run not found" });
      return run;
    }),

  // ── Save edits ────────────────────────────────────────────────────────────

  saveEdits: protectedProcedure
    .input(z.object({
      runId: z.number(),
      scripts: z.array(z.any()),
    }))
    .mutation(async ({ input }) => {
      const run = await db.getPipelineRun(input.runId);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Script run not found" });
      await db.updatePipelineRun(input.runId, { editedScriptsJson: input.scripts });
      return { ok: true };
    }),

  // ── Push to ClickUp ───────────────────────────────────────────────────────

  pushToClickUp: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ input }) => {
      const run = await db.getPipelineRun(input.runId);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Script run not found" });
      if (run.status !== "completed" || !run.scriptsJson) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No completed scripts to push" });
      }

      const scripts = ((run.editedScriptsJson ?? run.scriptsJson) as any[]);
      const formatted = scripts.map(s => ({
        title: s.title || "Untitled Script",
        type: run.scriptStyle || "script",
        score: s.review?.finalScore ?? 0,
        content: formatScriptForClickUp(s),
      }));
      const tasks = await createMultipleScriptTasks(formatted, run.product, run.priority || "Medium");

      await db.updatePipelineRun(input.runId, { clickupTasksJson: tasks });
      return { tasks };
    }),

  // ── Structure CRUD ────────────────────────────────────────────────────────

  listStructures: adminProcedure.query(async () => {
    return db.getScriptStructures();
  }),

  createStructure: adminProcedure
    .input(z.object({
      structureId: z.string().min(1).max(16),
      name: z.string().min(1).max(128),
      category: z.string().min(1).max(32),
      data: structureDataSchema,
    }))
    .mutation(async ({ input }) => {
      const id = await db.createScriptStructure({
        structureId: input.structureId,
        name: input.name,
        category: input.category,
        data: input.data,
      });
      return { id };
    }),

  updateStructure: adminProcedure
    .input(z.object({
      structureId: z.string().min(1),
      name: z.string().min(1).max(128).optional(),
      category: z.string().min(1).max(32).optional(),
      data: structureDataSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { structureId, ...rest } = input;
      await db.updateScriptStructure(structureId, rest);
      return { ok: true };
    }),

  deleteStructure: adminProcedure
    .input(z.object({ structureId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await db.deleteScriptStructure(input.structureId);
      return { ok: true };
    }),

  // ── Audience CRUD ─────────────────────────────────────────────────────────

  listAudiences: adminProcedure.query(async () => {
    return db.getScriptAudiences();
  }),

  createAudience: adminProcedure
    .input(z.object({
      audienceId: z.string().min(1).max(32),
      label: z.string().min(1).max(128),
      data: audienceDataSchema,
    }))
    .mutation(async ({ input }) => {
      const id = await db.createScriptAudience({
        audienceId: input.audienceId,
        label: input.label,
        data: input.data,
      });
      return { id };
    }),

  updateAudience: adminProcedure
    .input(z.object({
      audienceId: z.string().min(1),
      label: z.string().min(1).max(128).optional(),
      data: audienceDataSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { audienceId, ...rest } = input;
      await db.updateScriptAudience(audienceId, rest);
      return { ok: true };
    }),

  deleteAudience: adminProcedure
    .input(z.object({ audienceId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await db.deleteScriptAudience(input.audienceId);
      return { ok: true };
    }),

  // ── Seed defaults ─────────────────────────────────────────────────────────

  seedDefaults: adminProcedure.mutation(async () => {
    const structureCount = (await db.getScriptStructures()).length;
    const audienceCount = (await db.getScriptAudiences()).length;

    if (structureCount === 0) {
      for (const s of SCRIPT_SUB_STRUCTURES) {
        await db.createScriptStructure({
          structureId: s.id,
          name: s.name,
          category: s.category,
          data: {
            funnelStages: s.funnelStages,
            awarenessLevel: s.awarenessLevel,
            psychologicalLever: s.psychologicalLever,
            whyItConverts: s.whyItConverts,
            stages: s.stages,
          },
        });
      }
    }

    if (audienceCount === 0) {
      for (const [id, profile] of Object.entries(ARCHETYPE_PROFILES)) {
        await db.createScriptAudience({
          audienceId: id,
          label: profile.label,
          data: {
            lifeContext: profile.lifeContext,
            languageRegister: profile.languageRegister,
            preProductObjection: profile.preProductObjection,
          },
        });
      }
    }

    return {
      structuresSeeded: structureCount === 0 ? SCRIPT_SUB_STRUCTURES.length : 0,
      audiencesSeeded: audienceCount === 0 ? Object.keys(ARCHETYPE_PROFILES).length : 0,
    };
  }),
});
