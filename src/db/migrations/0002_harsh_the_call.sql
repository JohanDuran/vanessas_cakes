CREATE TABLE `pickup_date_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`closed` integer DEFAULT true NOT NULL,
	`open_time` text,
	`close_time` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pickup_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_time_hours` integer DEFAULT 24 NOT NULL,
	`max_advance_days` integer DEFAULT 60 NOT NULL,
	`slot_interval_minutes` integer DEFAULT 30 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pickup_weekly_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_of_week` integer NOT NULL,
	`is_open` integer DEFAULT false NOT NULL,
	`open_time` text,
	`close_time` text,
	`updated_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pickup_weekly_hours_day_of_week_unique` ON `pickup_weekly_hours` (`day_of_week`);--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_date` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_time` text;