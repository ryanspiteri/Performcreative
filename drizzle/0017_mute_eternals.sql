ALTER TABLE `pipeline_runs` ADD `videoFunnelStage` enum('cold','warm','retargeting','retention') DEFAULT 'cold';--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `videoArchetypes` json;