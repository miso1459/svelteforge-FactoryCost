CREATE TABLE `Master_Item` (
	`item_code` text PRIMARY KEY NOT NULL,
	`item_desc` text NOT NULL,
	`item_spec` text,
	`item_unit` text,
	`std_price` real,
	`is_active` integer DEFAULT true NOT NULL,
	`item_remark` text,
	`item_acct` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `menus` ADD `desc` text;