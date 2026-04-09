/**
 * Admin sync controls for Creative Analytics OS.
 *
 * All procedures are adminProcedure. Covers:
 *   - Sync status (Meta + Hyros)
 *   - Manual trigger for both
 *   - 90-day backfill
 *   - Unlinked ads + manual linking
 *   - Benchmark refresh
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { runFullSync, backfillMeta } from "../integrations/meta/metaAdsSyncService";
import { runHyrosSync, backfillHyros } from "../integrations/hyros/hyrosSyncService";
import { recomputeForDateRange, computeAccountBenchmarks } from "../services/creativeAnalytics/scoreRecompute";
import { MetaAdsClient } from "../integrations/meta/metaAdsClient";
import { HyrosClient } from "../integrations/hyros/hyrosClient";

export const adminSyncRouter = router({
  getSyncStatus: adminProcedure.query(async () => {
    const states = await db.listSyncStates();
    return { states };
  }),

  validateMetaToken: adminProcedure.query(async () => {
    try {
      const client = new MetaAdsClient();
      const result = await client.validateToken();
      const accountIds = MetaAdsClient.configuredAdAccountIds();
      return { ...result, configuredAccountIds: accountIds };
    } catch (err: any) {
      return { valid: false, error: err.message, configuredAccountIds: [] };
    }
  }),

  validateHyrosKey: adminProcedure.query(async () => {
    try {
      const client = new HyrosClient();
      return await client.validateApiKey();
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }),

  listMetaAdAccounts: adminProcedure.query(async () => {
    try {
      const client = new MetaAdsClient();
      const accounts = await client.listAdAccounts();
      return { accounts };
    } catch (err: any) {
      return { accounts: [], error: err.message };
    }
  }),

  triggerMetaSync: adminProcedure
    .input(z.object({ lookbackDays: z.number().int().min(1).max(365).optional() }).optional())
    .mutation(async ({ input }) => {
      const result = await runFullSync(input?.lookbackDays);
      return result;
    }),

  triggerHyrosSync: adminProcedure
    .input(z.object({ lookbackDays: z.number().int().min(1).max(365).optional() }).optional())
    .mutation(async ({ input }) => {
      const result = await runHyrosSync(input?.lookbackDays);
      return result;
    }),

  triggerMetaBackfill: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(90) }))
    .mutation(async ({ input }) => {
      return backfillMeta(input.days);
    }),

  triggerHyrosBackfill: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(90) }))
    .mutation(async ({ input }) => {
      return backfillHyros(input.days);
    }),

  triggerScoreRecompute: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(14) }))
    .mutation(async ({ input }) => {
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setUTCDate(dateFrom.getUTCDate() - input.days);
      return recomputeForDateRange(dateFrom, dateTo);
    }),

  getBenchmarks: adminProcedure.query(async () => {
    return computeAccountBenchmarks();
  }),

  listUnlinkedAds: adminProcedure
    .input(z.object({ adAccountId: z.string().optional(), limit: z.number().int().max(500).default(100) }))
    .query(async ({ input }) => {
      const ads = await db.listUnlinkedAds(input.adAccountId, input.limit);
      return { ads };
    }),

  linkAdToPipeline: adminProcedure
    .input(z.object({ adId: z.number().int(), pipelineRunId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const linkId = await db.createAdCreativeLink({
        adId: input.adId,
        pipelineRunId: input.pipelineRunId,
        linkMethod: "manual",
        confidence: 100,
        linkedBy: ctx.user?.id,
      });
      return { linkId };
    }),
});
