CREATE TABLE `Inv_Tran` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Document_dt` integer NOT NULL,
	`Tran_type` text NOT NULL,
	`Tran_item` text NOT NULL,
	`Tran_qty` real DEFAULT 0 NOT NULL,
	`Tran_remark` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Master_BOM` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`BOM_item_parent` text,
	`BOM_item_parent_qty` real DEFAULT 1 NOT NULL,
	`BOM_item` text NOT NULL,
	`BOM_item_qty` real DEFAULT 1 NOT NULL,
	`BOM_remark` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
