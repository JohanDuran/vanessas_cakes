CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`design_id` integer,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `order_items` (`id`, `order_id`, `design_id`, `price_cents`, `sort_order`, `created_at`)
SELECT `id`, `id`, `design_id`, `total_price_cents`, 0, `created_at` FROM `orders`;
--> statement-breakpoint
CREATE TABLE `order_selections_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_item_id` integer NOT NULL,
	`field_id` integer NOT NULL,
	`field_option_id` integer,
	`text_value` text,
	`number_value` integer,
	`label_snapshot` text NOT NULL,
	`price_cents_snapshot` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `fields`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`field_option_id`) REFERENCES `field_options`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `order_selections_new` (`id`, `order_item_id`, `field_id`, `field_option_id`, `text_value`, `number_value`, `label_snapshot`, `price_cents_snapshot`)
SELECT `id`, `order_id`, `field_id`, `field_option_id`, `text_value`, `number_value`, `label_snapshot`, `price_cents_snapshot` FROM `order_selections`;
--> statement-breakpoint
DROP TABLE `order_selections`;
--> statement-breakpoint
ALTER TABLE `order_selections_new` RENAME TO `order_selections`;
--> statement-breakpoint
CREATE UNIQUE INDEX `order_selections_item_field_option_idx` ON `order_selections` (`order_item_id`,`field_id`,`field_option_id`);
--> statement-breakpoint
CREATE TABLE `order_reference_images_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_item_id` integer NOT NULL,
	`path` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `order_reference_images_new` (`id`, `order_item_id`, `path`, `sort_order`, `created_at`)
SELECT `id`, `order_id`, `path`, `sort_order`, `created_at` FROM `order_reference_images`;
--> statement-breakpoint
DROP TABLE `order_reference_images`;
--> statement-breakpoint
ALTER TABLE `order_reference_images_new` RENAME TO `order_reference_images`;
--> statement-breakpoint
CREATE TABLE `orders_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text,
	`comments` text,
	`total_price_cents` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`pickup_date` text,
	`pickup_time` text,
	`contact_preference` text,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `orders_new` (`id`, `customer_name`, `customer_email`, `customer_phone`, `comments`, `total_price_cents`, `status`, `pickup_date`, `pickup_time`, `contact_preference`, `created_at`)
SELECT `id`, `customer_name`, `customer_email`, `customer_phone`, `comments`, `total_price_cents`, `status`, `pickup_date`, `pickup_time`, `contact_preference`, `created_at` FROM `orders`;
--> statement-breakpoint
DROP TABLE `orders`;
--> statement-breakpoint
ALTER TABLE `orders_new` RENAME TO `orders`;
