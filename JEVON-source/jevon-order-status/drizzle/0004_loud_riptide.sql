CREATE TABLE `order_share_links` (
	`order_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_share_links_token_unique` ON `order_share_links` (`token`);--> statement-breakpoint
CREATE TABLE `order_stage_statuses` (
	`order_id` text NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`order_id`, `stage`)
);
