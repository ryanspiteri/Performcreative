CREATE TABLE `caption_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pillar` varchar(64) NOT NULL,
	`purpose` varchar(64) NOT NULL,
	`topic` varchar(256) NOT NULL,
	`platform` varchar(32) NOT NULL,
	`captionText` text NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `caption_examples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organic_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('organic_video','caption','visual_content') NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`stage` varchar(64),
	`contentPillar` varchar(64),
	`contentPurpose` varchar(64),
	`contentFormat` varchar(32),
	`topic` text,
	`videoInputPath` text,
	`videoInputType` enum('local','url') DEFAULT 'local',
	`autoEditOutputUrl` text,
	`transcription` json,
	`transcriptionEdited` json,
	`subtitleStyle` varchar(32) DEFAULT 'tiktok_bold',
	`subtitledVideoUrl` text,
	`thumbnailUrl` text,
	`captionInstagram` text,
	`captionTiktok` text,
	`captionLinkedin` text,
	`slideCount` int,
	`slidesJson` json,
	`product` varchar(64),
	`errorMessage` text,
	`clickupTaskId` varchar(256),
	`clickupTaskUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `organic_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `iterationSourceType` enum('own_ad','competitor_ad') DEFAULT 'own_ad';--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD `iterationAdaptationMode` enum('concept','style');--> statement-breakpoint
ALTER TABLE `product_renders` ADD `isDefault` int DEFAULT 0 NOT NULL;