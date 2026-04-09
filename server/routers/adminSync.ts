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
import { sql } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { runFullSync, backfillMeta } from "../integrations/meta/metaAdsSyncService";
import { runHyrosSync, backfillHyros } from "../integrations/hyros/hyrosSyncService";
import { recomputeForDateRange, computeAccountBenchmarks } from "../services/creativeAnalytics/scoreRecompute";
import { MetaAdsClient } from "../integrations/meta/metaAdsClient";
import { HyrosClient } from "../integrations/hyros/hyrosClient";

/**
 * Creative Analytics OS migration SQL (inlined from drizzle/migrations/0023_creative_analytics_os.sql).
 *
 * Inlined because esbuild bundles server code and can't read files at runtime.
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS throughout.
 *
 * Keep this in sync with drizzle/migrations/0023_creative_analytics_os.sql.
 */
const CREATIVE_ANALYTICS_MIGRATION_STATEMENTS: string[] = [
  // 1. creativeAssets
  `CREATE TABLE IF NOT EXISTS \`creativeAssets\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`creativeHash\` varchar(64) NOT NULL,
    \`name\` varchar(512) DEFAULT NULL,
    \`creativeType\` enum('video','image','carousel') NOT NULL,
    \`thumbnailUrl\` varchar(1024) DEFAULT NULL,
    \`videoUrl\` varchar(1024) DEFAULT NULL,
    \`durationSeconds\` int DEFAULT NULL,
    \`firstSeenAt\` timestamp NULL DEFAULT NULL,
    \`lastSeenAt\` timestamp NULL DEFAULT NULL,
    \`pipelineRunId\` int DEFAULT NULL,
    \`foreplayCreativeId\` int DEFAULT NULL,
    \`ugcVariantId\` int DEFAULT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`creativeAssets_creativeHash_unique\` (\`creativeHash\`),
    KEY \`creative_type_idx\` (\`creativeType\`, \`lastSeenAt\`),
    KEY \`creative_pipeline_run_idx\` (\`pipelineRunId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // 2. ads
  `CREATE TABLE IF NOT EXISTS \`ads\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`creativeAssetId\` int NOT NULL,
    \`platform\` varchar(32) NOT NULL,
    \`externalAdId\` varchar(128) NOT NULL,
    \`adsetId\` varchar(128) DEFAULT NULL,
    \`adsetName\` varchar(256) DEFAULT NULL,
    \`campaignId\` varchar(128) DEFAULT NULL,
    \`campaignName\` varchar(256) DEFAULT NULL,
    \`adAccountId\` varchar(128) DEFAULT NULL,
    \`name\` varchar(512) DEFAULT NULL,
    \`permalink\` varchar(1024) DEFAULT NULL,
    \`launchDate\` timestamp NULL DEFAULT NULL,
    \`status\` varchar(32) DEFAULT NULL,
    \`firstSeenAt\` timestamp NULL DEFAULT NULL,
    \`lastSeenAt\` timestamp NULL DEFAULT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`ads_platform_external_unique\` (\`platform\`, \`externalAdId\`),
    KEY \`ads_creative_asset_idx\` (\`creativeAssetId\`),
    KEY \`ads_status_launch_idx\` (\`status\`, \`launchDate\`),
    KEY \`ads_campaign_idx\` (\`campaignId\`),
    KEY \`ads_ad_account_idx\` (\`adAccountId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // 3. adDailyStats
  `CREATE TABLE IF NOT EXISTS \`adDailyStats\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`adId\` int NOT NULL,
    \`date\` timestamp NOT NULL,
    \`source\` varchar(32) NOT NULL DEFAULT 'meta',
    \`spendCents\` int NOT NULL DEFAULT 0,
    \`impressions\` int NOT NULL DEFAULT 0,
    \`clicks\` int NOT NULL DEFAULT 0,
    \`reach\` int NOT NULL DEFAULT 0,
    \`cpmCents\` int NOT NULL DEFAULT 0,
    \`cpcCents\` int NOT NULL DEFAULT 0,
    \`ctrBp\` int NOT NULL DEFAULT 0,
    \`outboundCtrBp\` int NOT NULL DEFAULT 0,
    \`videoPlayCount\` int NOT NULL DEFAULT 0,
    \`video25Count\` int NOT NULL DEFAULT 0,
    \`video50Count\` int NOT NULL DEFAULT 0,
    \`video75Count\` int NOT NULL DEFAULT 0,
    \`video100Count\` int NOT NULL DEFAULT 0,
    \`videoThruplayCount\` int NOT NULL DEFAULT 0,
    \`videoAvgTimeMs\` int NOT NULL DEFAULT 0,
    \`thumbstopBp\` int NOT NULL DEFAULT 0,
    \`holdRateBp\` int NOT NULL DEFAULT 0,
    \`actionsJson\` json DEFAULT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`ad_daily_stats_ad_date_source_unique\` (\`adId\`, \`date\`, \`source\`),
    KEY \`ad_daily_stats_date_spend_idx\` (\`date\`, \`spendCents\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // 4. adAttributionStats
  `CREATE TABLE IF NOT EXISTS \`adAttributionStats\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`adId\` int DEFAULT NULL,
    \`hyrosAdId\` varchar(128) NOT NULL,
    \`externalAdId\` varchar(128) DEFAULT NULL,
    \`date\` timestamp NOT NULL,
    \`source\` varchar(32) NOT NULL DEFAULT 'hyros',
    \`attributionModel\` varchar(32) NOT NULL DEFAULT 'first_click',
    \`spendCents\` int NOT NULL DEFAULT 0,
    \`conversions\` int NOT NULL DEFAULT 0,
    \`revenueCents\` int NOT NULL DEFAULT 0,
    \`aovCents\` int NOT NULL DEFAULT 0,
    \`roasBp\` int NOT NULL DEFAULT 0,
    \`cpaCents\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`attr_hyros_date_model_unique\` (\`hyrosAdId\`, \`date\`, \`attributionModel\`),
    KEY \`attr_ad_date_idx\` (\`adId\`, \`date\`),
    KEY \`attr_date_revenue_idx\` (\`date\`, \`revenueCents\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // 5. creativeScores
  `CREATE TABLE IF NOT EXISTS \`creativeScores\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`creativeAssetId\` int NOT NULL,
    \`date\` timestamp NOT NULL,
    \`hookScore\` int NOT NULL DEFAULT 0,
    \`watchScore\` int NOT NULL DEFAULT 0,
    \`clickScore\` int NOT NULL DEFAULT 0,
    \`convertScore\` int NOT NULL DEFAULT 0,
    \`aggregatedImpressions\` int NOT NULL DEFAULT 0,
    \`aggregatedSpendCents\` int NOT NULL DEFAULT 0,
    \`coverage\` varchar(16) NOT NULL DEFAULT 'full',
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`scores_creative_date_unique\` (\`creativeAssetId\`, \`date\`),
    KEY \`scores_date_hook_idx\` (\`date\`, \`hookScore\`),
    KEY \`scores_date_convert_idx\` (\`date\`, \`convertScore\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // 6. adCreativeLinks
  `CREATE TABLE IF NOT EXISTS \`adCreativeLinks\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`adId\` int DEFAULT NULL,
    \`creativeAssetId\` int DEFAULT NULL,
    \`hyrosAdId\` varchar(128) DEFAULT NULL,
    \`pipelineRunId\` int DEFAULT NULL,
    \`foreplayCreativeId\` int DEFAULT NULL,
    \`ugcVariantId\` int DEFAULT NULL,
    \`linkMethod\` enum('stamped_id','name_exact','name_fuzzy','video_url','hyros_match','manual') NOT NULL,
    \`confidence\` int NOT NULL DEFAULT 0,
    \`linkedBy\` int DEFAULT NULL,
    \`notes\` text DEFAULT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // 7. adSyncState
  `CREATE TABLE IF NOT EXISTS \`adSyncState\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`sourceName\` varchar(32) NOT NULL,
    \`adAccountId\` varchar(128) DEFAULT NULL,
    \`lastSyncStartedAt\` timestamp NULL DEFAULT NULL,
    \`lastSyncCompletedAt\` timestamp NULL DEFAULT NULL,
    \`lastSyncStatus\` enum('idle','running','success','failed','partial') NOT NULL DEFAULT 'idle',
    \`lastSyncError\` text DEFAULT NULL,
    \`rowsFetched\` int NOT NULL DEFAULT 0,
    \`rowsUpserted\` int NOT NULL DEFAULT 0,
    \`consecutiveFailures\` int NOT NULL DEFAULT 0,
    \`nextRetryAt\` timestamp NULL DEFAULT NULL,
    \`backfillCompletedThroughDate\` timestamp NULL DEFAULT NULL,
    \`benchmarksJson\` json DEFAULT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`sync_source_account_idx\` (\`sourceName\`, \`adAccountId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
];

const EXPECTED_TABLES = [
  "creativeAssets",
  "ads",
  "adDailyStats",
  "adAttributionStats",
  "creativeScores",
  "adCreativeLinks",
  "adSyncState",
];

export const adminSyncRouter = router({
  /**
   * Run the Creative Analytics OS migration (one-shot, idempotent).
   * Creates the 7 new tables if they don't exist. Safe to re-run.
   *
   * Returns per-table status so the admin UI can show which tables were created
   * vs which already existed.
   */
  runMigration: adminProcedure.mutation(async () => {
    const dbConn = await db.getDb();
    if (!dbConn) {
      throw new Error("Database not available");
    }

    const results: { table: string; status: "created" | "exists" | "failed"; error?: string }[] = [];

    // Check which tables already exist BEFORE running
    const existingBefore = await dbConn.execute(sql`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('creativeAssets','ads','adDailyStats','adAttributionStats','creativeScores','adCreativeLinks','adSyncState')
    `);
    const beforeSet = new Set(
      (Array.isArray(existingBefore[0]) ? existingBefore[0] : existingBefore).map((r: any) => r.TABLE_NAME)
    );

    // Execute each CREATE TABLE statement
    for (let i = 0; i < CREATIVE_ANALYTICS_MIGRATION_STATEMENTS.length; i++) {
      const stmt = CREATIVE_ANALYTICS_MIGRATION_STATEMENTS[i];
      const tableName = EXPECTED_TABLES[i];
      try {
        if (beforeSet.has(tableName)) {
          results.push({ table: tableName, status: "exists" });
          continue;
        }
        await dbConn.execute(sql.raw(stmt));
        results.push({ table: tableName, status: "created" });
      } catch (err: any) {
        results.push({ table: tableName, status: "failed", error: err.message ?? String(err) });
      }
    }

    // Verify all tables exist after
    const existingAfter = await dbConn.execute(sql`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('creativeAssets','ads','adDailyStats','adAttributionStats','creativeScores','adCreativeLinks','adSyncState')
    `);
    const afterSet = new Set(
      (Array.isArray(existingAfter[0]) ? existingAfter[0] : existingAfter).map((r: any) => r.TABLE_NAME)
    );

    const allTablesPresent = EXPECTED_TABLES.every((t) => afterSet.has(t));
    const createdCount = results.filter((r) => r.status === "created").length;
    const existedCount = results.filter((r) => r.status === "exists").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return {
      success: allTablesPresent && failedCount === 0,
      summary: `${createdCount} created, ${existedCount} already existed, ${failedCount} failed`,
      results,
      allTablesPresent,
    };
  }),

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
