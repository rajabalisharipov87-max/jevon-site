ALTER TABLE `client_accounts` ADD `code_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `client_accounts_code_hash_unique` ON `client_accounts` (`code_hash`);