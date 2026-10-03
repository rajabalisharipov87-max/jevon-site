ALTER TABLE `shared_orders` ADD `owner_phone` text;--> statement-breakpoint
CREATE INDEX `shared_orders_phone_idx` ON `shared_orders` (`owner_phone`);