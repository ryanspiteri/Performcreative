import { relations } from "drizzle-orm";
import { foreplayCreatives, pipelineRuns } from "./schema";

export const foreplayCreativesRelations = relations(foreplayCreatives, ({ many }) => ({
  pipelineRuns: many(pipelineRuns),
}));

export const pipelineRunsRelations = relations(pipelineRuns, ({ one }) => ({
  foreplayCreative: one(foreplayCreatives, {
    fields: [pipelineRuns.foreplayAdId],
    references: [foreplayCreatives.foreplayAdId],
  }),
}));
