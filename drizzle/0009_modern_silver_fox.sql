ALTER TABLE `pipeline_runs` MODIFY COLUMN `pipelineType` enum('video','static','iteration') NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `iterationSourceUrl` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `iterationAnalysis` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `iterationBrief` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `iterationStage` varchar(64);--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `iterationVariations` json;