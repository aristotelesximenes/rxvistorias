CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`crea` text DEFAULT '' NOT NULL,
	`rnp` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'engineer' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `inspections` ADD `owner_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `idx_inspections_owner_updated` ON `inspections` (`owner_id`,`updated_at`);