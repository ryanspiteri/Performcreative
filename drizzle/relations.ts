import { relations } from "drizzle-orm";
import {
  foreplayCreatives,
  pipelineRuns,
  creativeAssets,
  ads,
  adDailyStats,
  adAttributionStats,
  creativeScores,
  adCreativeLinks,
} from "./schema";

export const foreplayCreativesRelations = relations(foreplayCreatives, ({ many }) => ({
  pipelineRuns: many(pipelineRuns),
}));

export const pipelineRunsRelations = relations(pipelineRuns, ({ one }) => ({
  foreplayCreative: one(foreplayCreatives, {
    fields: [pipelineRuns.foreplayAdId],
    references: [foreplayCreatives.foreplayAdId],
  }),
}));

// Creative Analytics OS relations
export const creativeAssetsRelations = relations(creativeAssets, ({ many, one }) => ({
  ads: many(ads),
  scores: many(creativeScores),
  pipelineRun: one(pipelineRuns, {
    fields: [creativeAssets.pipelineRunId],
    references: [pipelineRuns.id],
  }),
}));

export const adsRelations = relations(ads, ({ one, many }) => ({
  creativeAsset: one(creativeAssets, {
    fields: [ads.creativeAssetId],
    references: [creativeAssets.id],
  }),
  dailyStats: many(adDailyStats),
  attributionStats: many(adAttributionStats),
}));

export const adDailyStatsRelations = relations(adDailyStats, ({ one }) => ({
  ad: one(ads, {
    fields: [adDailyStats.adId],
    references: [ads.id],
  }),
}));

export const adAttributionStatsRelations = relations(adAttributionStats, ({ one }) => ({
  ad: one(ads, {
    fields: [adAttributionStats.adId],
    references: [ads.id],
  }),
}));

export const creativeScoresRelations = relations(creativeScores, ({ one }) => ({
  creativeAsset: one(creativeAssets, {
    fields: [creativeScores.creativeAssetId],
    references: [creativeAssets.id],
  }),
}));

export const adCreativeLinksRelations = relations(adCreativeLinks, ({ one }) => ({
  ad: one(ads, {
    fields: [adCreativeLinks.adId],
    references: [ads.id],
  }),
  creativeAsset: one(creativeAssets, {
    fields: [adCreativeLinks.creativeAssetId],
    references: [creativeAssets.id],
  }),
  pipelineRun: one(pipelineRuns, {
    fields: [adCreativeLinks.pipelineRunId],
    references: [pipelineRuns.id],
  }),
}));
