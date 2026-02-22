CREATE TABLE `ugc_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`videoUrl` text NOT NULL,
	`product` varchar(64) NOT NULL,
	`audienceTag` varchar(128),
	`desiredOutputVolume` int NOT NULL,
	`status` enum('uploaded','transcribing','structure_extracted','blueprint_approved','generating_variants','completed','failed') NOT NULL DEFAULT 'uploaded',
	`transcript` text,
	`structureBlueprint` json,
	`blueprintApprovedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ugc_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ugc_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uploadId` int NOT NULL,
	`variantNumber` int NOT NULL,
	`actorArchetype` varchar(128) NOT NULL,
	`voiceTone` varchar(64) NOT NULL,
	`energyLevel` enum('low','medium','high') NOT NULL,
	`scriptText` text NOT NULL,
	`hookVariation` text,
	`ctaVariation` text,
	`runtime` int,
	`status` enum('generated','awaiting_approval','approved','rejected','pushed_to_clickup') NOT NULL DEFAULT 'generated',
	`clickupTaskId` varchar(256),
	`clickupTaskUrl` text,
	`approvedAt` timestamp,
	`rejectedAt` timestamp,
	`pushedToClickupAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ugc_variants_id` PRIMARY KEY(`id`)
);
