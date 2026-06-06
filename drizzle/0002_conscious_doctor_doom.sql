CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`path` text,
	`icon` text,
	`role` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`parent_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`prompt` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `template01` (
	`code` text PRIMARY KEY NOT NULL,
	`desc` text NOT NULL,
	`remark` text,
	`item_acct` text NOT NULL,
	`date_valid` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `template02` (
	`document_dt` integer NOT NULL,
	`code` text NOT NULL,
	`desc` text NOT NULL,
	`remark` text,
	`item_acct` text NOT NULL,
	`date_valid` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`document_dt`, `code`)
);
--> statement-breakpoint
CREATE TABLE `template03` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_dt` integer NOT NULL,
	`code` text NOT NULL,
	`desc` text NOT NULL,
	`remark` text,
	`item_acct` text NOT NULL,
	`date_valid` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
