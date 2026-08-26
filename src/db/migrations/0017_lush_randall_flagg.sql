CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`maintenance_mode` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL
);
