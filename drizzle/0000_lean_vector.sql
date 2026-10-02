CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`item_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`filename` text NOT NULL,
	`bytes` integer NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photos_inspection` ON `photos` (`inspection_id`);