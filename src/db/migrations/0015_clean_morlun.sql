CREATE TABLE `design_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`design_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`admin_reply` text,
	`admin_reply_at` integer,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `design_reviews_design_user_idx` ON `design_reviews` (`design_id`,`user_id`);