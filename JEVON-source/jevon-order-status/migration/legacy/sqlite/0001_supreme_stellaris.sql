CREATE TABLE `order_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`thickness` text NOT NULL,
	`planned` integer NOT NULL,
	`received` integer,
	`condition` text DEFAULT 'Ожидаем' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`received_at` text
);
