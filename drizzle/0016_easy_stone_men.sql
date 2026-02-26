ALTER TABLE `pipeline_runs` ADD `videoSourceType` enum('competitor','winning_ad') DEFAULT 'competitor';--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `videoDuration` int DEFAULT 60;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `videoStyleConfig` json;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `videoUploadUrl` text;