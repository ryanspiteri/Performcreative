ALTER TABLE `users` ADD `canvaAccessToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `canvaRefreshToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `canvaTokenExpiresAt` timestamp;