ALTER TABLE `pipeline_runs` ADD `parentRunId` int;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `variationLayer` enum('parent','child') DEFAULT 'parent';--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `variationType` varchar(64);