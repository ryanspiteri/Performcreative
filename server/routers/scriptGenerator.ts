import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { runScriptPipeline } from "../services/scriptPipeline";
import { createMultipleScriptTasks } from "../services/clickup";
import {
  SCRIPT_STYLES,
  SCRIPT_SUB_STRUCTURES,
  ARCHETYPE_PROFILES,
  type ScriptStyleId,
  type FunnelStage,
  type ActorArchetype,
} from "../services/videoPipeline";

export const scriptGeneratorRouter = router({
  // Return available options for the form
  options: publicProcedure.query(() => ({
    styles: SCRIPT_STYLES.map(s => ({ id: s.id, label: s.label, description: s.description })),
    subStructures: SCRIPT_SUB_STRUCTURES.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      funnelStages: s.funnelStages,
      awarenessLevel: s.awarenessLevel,
      whyItConverts: s.whyItConverts,
    })),
    archetypes: Object.entries(ARCHETYPE_PROFILES).map(([id, profile]) => ({
      id,
      label: profile.label,
      lifeContext: profile.lifeContext,
    })),
  })),

  // Trigger script generation
  create: protectedProcedure
    .input(z.object({
      product: z.string().min(1),
      scriptStyle: z.string().min(1),
      subStructureId: z.string().min(1),
      funnelStage: z.enum(["cold", "warm", "retargeting", "retention"]),
      archetype: z.string().min(1),
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
        scriptConcept: input.concept,
        scriptCount: input.scriptCount,
        scriptStage: "pending",
      });

      // Fire-and-forget
      runScriptPipeline(runId, {
        product: input.product,
        scriptStyle: input.scriptStyle as ScriptStyleId,
        subStructureId: input.subStructureId,
        funnelStage: input.funnelStage as FunnelStage,
        archetype: input.archetype as ActorArchetype,
        concept: input.concept,
        scriptCount: input.scriptCount,
      }).catch(err =>
        console.error(`[ScriptGenerator] Background error for run #${runId}:`, err.message)
      );

      return { runId };
    }),

  // Poll status
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const run = await db.getPipelineRun(input.id);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Script run not found" });
      return run;
    }),

  // Push scripts to ClickUp
  pushToClickUp: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ input }) => {
      const run = await db.getPipelineRun(input.runId);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Script run not found" });
      if (run.status !== "completed" || !run.scriptsJson) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No completed scripts to push" });
      }

      const scripts = run.scriptsJson as any[];
      const tasks = await createMultipleScriptTasks(
        scripts,
        run.product,
        `${typeof window !== "undefined" ? window.location.origin : ""}/results/${run.id}`
      );

      await db.updatePipelineRun(input.runId, { clickupTasksJson: tasks });
      return { tasks };
    }),
});
