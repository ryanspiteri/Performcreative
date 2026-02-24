CREATE TABLE `headline_bank` (
	`id` int AUTO_INCREMENT NOT NULL,
	`headline` text NOT NULL,
	`subheadline` text,
	`rating` int NOT NULL DEFAULT 3,
	`roas` varchar(16),
	`spend` varchar(32),
	`weeksActive` int,
	`source` varchar(32) NOT NULL DEFAULT 'manual',
	`motionTaskId` varchar(256),
	`motionCreativeName` text,
	`product` varchar(64),
	`angle` varchar(64),
	`format` varchar(32),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `headline_bank_id` PRIMARY KEY(`id`)
);
