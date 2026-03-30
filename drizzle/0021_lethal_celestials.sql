ALTER TABLE `pipeline_runs` MODIFY COLUMN `pipelineType` enum('video','static','iteration','script') NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `scriptStyle` varchar(16);--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `scriptSubStructure` varchar(16);--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `scriptFunnelStage` enum('cold','warm','retargeting','retention');--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `scriptArchetype` varchar(32);--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `scriptConcept` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `scriptCount` int;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `scriptStage` varchar(64);