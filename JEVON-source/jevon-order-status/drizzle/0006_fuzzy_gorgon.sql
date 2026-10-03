CREATE TABLE `synced_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS archived_deadlines_20260925 AS SELECT * FROM order_deadlines;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS archived_drawings_20260925 AS SELECT * FROM order_drawings;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS archived_materials_20260925 AS SELECT * FROM order_materials;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS archived_share_links_20260925 AS SELECT * FROM order_share_links;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS archived_shipments_20260925 AS SELECT * FROM order_shipments;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS archived_stages_20260925 AS SELECT * FROM order_stage_statuses;
--> statement-breakpoint
DELETE FROM order_deadlines;
--> statement-breakpoint
DELETE FROM order_drawings;
--> statement-breakpoint
DELETE FROM order_materials;
--> statement-breakpoint
DELETE FROM order_share_links;
--> statement-breakpoint
DELETE FROM order_shipments;
--> statement-breakpoint
DELETE FROM order_stage_statuses;
