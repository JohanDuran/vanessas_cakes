CREATE TABLE `order_reference_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`path` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`design_id` integer,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text,
	`comments` text,
	`total_price_cents` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`pickup_date` text,
	`pickup_time` text,
	`contact_preference` text,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "design_id", "customer_name", "customer_email", "customer_phone", "comments", "total_price_cents", "status", "pickup_date", "pickup_time", "contact_preference", "created_at") SELECT "id", "design_id", "customer_name", "customer_email", "customer_phone", "comments", "total_price_cents", "status", "pickup_date", "pickup_time", NULL, "created_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;