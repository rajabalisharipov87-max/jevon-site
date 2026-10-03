CREATE TABLE `order_estimate_changes` (
	`order_id` text NOT NULL,
	`row_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`order_id`, `row_id`)
);
