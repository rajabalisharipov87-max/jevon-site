CREATE TABLE `client_accounts` (
	`phone` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `client_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` text NOT NULL,
	`until` text NOT NULL
);
