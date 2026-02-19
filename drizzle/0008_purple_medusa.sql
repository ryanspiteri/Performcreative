ALTER TABLE `pipeline_runs` ADD `videoBrief` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `videoBriefReview` json;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `videoStage` varchar(64);--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `videoBriefOptions` json;