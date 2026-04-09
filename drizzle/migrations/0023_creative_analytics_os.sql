-- Migration 0023: Creative Analytics OS (Motion replacement)
-- Adds 7 tables for Meta Ads + Hyros sync and scoring.
-- Money stored as integer cents. Rates stored as basis points (x10000).
-- Safe to run multiple times: uses IF NOT EXISTS guards via CREATE TABLE.

-- ============================================================================
-- 1. creativeAssets — canonical creative (one per unique video/image)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `creativeAssets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creativeHash` varchar(64) NOT NULL,
  `name` varchar(512) DEFAULT NULL,
  `creativeType` enum('video','image','carousel') NOT NULL,
  `thumbnailUrl` varchar(1024) DEFAULT NULL,
  `videoUrl` varchar(1024) DEFAULT NULL,
  `durationSeconds` int DEFAULT NULL,
  `firstSeenAt` timestamp NULL DEFAULT NULL,
  `lastSeenAt` timestamp NULL DEFAULT NULL,
  `pipelineRunId` int DEFAULT NULL,
  `foreplayCreativeId` int DEFAULT NULL,
  `ugcVariantId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `creativeAssets_creativeHash_unique` (`creativeHash`),
  KEY `creative_type_idx` (`creativeType`, `lastSeenAt`),
  KEY `creative_pipeline_run_idx` (`pipelineRunId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 2. ads — individual Meta ad instances
-- ============================================================================
CREATE TABLE IF NOT EXISTS `ads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creativeAssetId` int NOT NULL,
  `platform` varchar(32) NOT NULL,
  `externalAdId` varchar(128) NOT NULL,
  `adsetId` varchar(128) DEFAULT NULL,
  `adsetName` varchar(256) DEFAULT NULL,
  `campaignId` varchar(128) DEFAULT NULL,
  `campaignName` varchar(256) DEFAULT NULL,
  `adAccountId` varchar(128) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `permalink` varchar(1024) DEFAULT NULL,
  `launchDate` timestamp NULL DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `firstSeenAt` timestamp NULL DEFAULT NULL,
  `lastSeenAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ads_platform_external_unique` (`platform`, `externalAdId`),
  KEY `ads_creative_asset_idx` (`creativeAssetId`),
  KEY `ads_status_launch_idx` (`status`, `launchDate`),
  KEY `ads_campaign_idx` (`campaignId`),
  KEY `ads_ad_account_idx` (`adAccountId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 3. adDailyStats — daily delivery metrics per ad from Meta
-- ============================================================================
CREATE TABLE IF NOT EXISTS `adDailyStats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adId` int NOT NULL,
  `date` timestamp NOT NULL,
  `source` varchar(32) NOT NULL DEFAULT 'meta',
  `spendCents` int NOT NULL DEFAULT 0,
  `impressions` int NOT NULL DEFAULT 0,
  `clicks` int NOT NULL DEFAULT 0,
  `reach` int NOT NULL DEFAULT 0,
  `cpmCents` int NOT NULL DEFAULT 0,
  `cpcCents` int NOT NULL DEFAULT 0,
  `ctrBp` int NOT NULL DEFAULT 0,
  `outboundCtrBp` int NOT NULL DEFAULT 0,
  `videoPlayCount` int NOT NULL DEFAULT 0,
  `video25Count` int NOT NULL DEFAULT 0,
  `video50Count` int NOT NULL DEFAULT 0,
  `video75Count` int NOT NULL DEFAULT 0,
  `video100Count` int NOT NULL DEFAULT 0,
  `videoThruplayCount` int NOT NULL DEFAULT 0,
  `videoAvgTimeMs` int NOT NULL DEFAULT 0,
  `thumbstopBp` int NOT NULL DEFAULT 0,
  `holdRateBp` int NOT NULL DEFAULT 0,
  `actionsJson` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ad_daily_stats_ad_date_source_unique` (`adId`, `date`, `source`),
  KEY `ad_daily_stats_date_spend_idx` (`date`, `spendCents`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 4. adAttributionStats — daily attribution metrics per ad from Hyros
-- ============================================================================
CREATE TABLE IF NOT EXISTS `adAttributionStats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adId` int DEFAULT NULL,
  `hyrosAdId` varchar(128) NOT NULL,
  `externalAdId` varchar(128) DEFAULT NULL,
  `date` timestamp NOT NULL,
  `source` varchar(32) NOT NULL DEFAULT 'hyros',
  `attributionModel` varchar(32) NOT NULL DEFAULT 'first_click',
  `spendCents` int NOT NULL DEFAULT 0,
  `conversions` int NOT NULL DEFAULT 0,
  `revenueCents` int NOT NULL DEFAULT 0,
  `aovCents` int NOT NULL DEFAULT 0,
  `roasBp` int NOT NULL DEFAULT 0,
  `cpaCents` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attr_hyros_date_model_unique` (`hyrosAdId`, `date`, `attributionModel`),
  KEY `attr_ad_date_idx` (`adId`, `date`),
  KEY `attr_date_revenue_idx` (`date`, `revenueCents`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 5. creativeScores — computed scores per creative per day
-- ============================================================================
CREATE TABLE IF NOT EXISTS `creativeScores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creativeAssetId` int NOT NULL,
  `date` timestamp NOT NULL,
  `hookScore` int NOT NULL DEFAULT 0,
  `watchScore` int NOT NULL DEFAULT 0,
  `clickScore` int NOT NULL DEFAULT 0,
  `convertScore` int NOT NULL DEFAULT 0,
  `aggregatedImpressions` int NOT NULL DEFAULT 0,
  `aggregatedSpendCents` int NOT NULL DEFAULT 0,
  `coverage` varchar(16) NOT NULL DEFAULT 'full',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `scores_creative_date_unique` (`creativeAssetId`, `date`),
  KEY `scores_date_hook_idx` (`date`, `hookScore`),
  KEY `scores_date_convert_idx` (`date`, `convertScore`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 6. adCreativeLinks — Meta ad ↔ Hyros ad ↔ Perform pipeline link records
-- ============================================================================
CREATE TABLE IF NOT EXISTS `adCreativeLinks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adId` int DEFAULT NULL,
  `creativeAssetId` int DEFAULT NULL,
  `hyrosAdId` varchar(128) DEFAULT NULL,
  `pipelineRunId` int DEFAULT NULL,
  `foreplayCreativeId` int DEFAULT NULL,
  `ugcVariantId` int DEFAULT NULL,
  `linkMethod` enum('stamped_id','name_exact','name_fuzzy','video_url','hyros_match','manual') NOT NULL,
  `confidence` int NOT NULL DEFAULT 0,
  `linkedBy` int DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 7. adSyncState — sync health per (source, adAccountId)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `adSyncState` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sourceName` varchar(32) NOT NULL,
  `adAccountId` varchar(128) DEFAULT NULL,
  `lastSyncStartedAt` timestamp NULL DEFAULT NULL,
  `lastSyncCompletedAt` timestamp NULL DEFAULT NULL,
  `lastSyncStatus` enum('idle','running','success','failed','partial') NOT NULL DEFAULT 'idle',
  `lastSyncError` text DEFAULT NULL,
  `rowsFetched` int NOT NULL DEFAULT 0,
  `rowsUpserted` int NOT NULL DEFAULT 0,
  `consecutiveFailures` int NOT NULL DEFAULT 0,
  `nextRetryAt` timestamp NULL DEFAULT NULL,
  `backfillCompletedThroughDate` timestamp NULL DEFAULT NULL,
  `benchmarksJson` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sync_source_account_idx` (`sourceName`, `adAccountId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
