ALTER TABLE `pipeline_runs` ADD `staticStage` varchar(64);--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `staticBrief` text;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `staticBriefReview` json;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `staticCreativeReview` json;--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `teamApprovalStatus` enum('pending','approved','rejected');--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `teamApprovalNotes` text;