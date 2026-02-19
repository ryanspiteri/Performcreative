CREATE TABLE `product_info` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product` varchar(64) NOT NULL,
	`ingredients` text,
	`benefits` text,
	`claims` text,
	`targetAudience` text,
	`keySellingPoints` text,
	`flavourVariants` text,
	`pricing` text,
	`additionalNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_info_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_info_product_unique` UNIQUE(`product`)
);
--> statement-breakpoint
CREATE TABLE `product_renders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product` varchar(64) NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`url` text NOT NULL,
	`mimeType` varchar(64) NOT NULL DEFAULT 'image/png',
	`fileSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_renders_id` PRIMARY KEY(`id`)
);
