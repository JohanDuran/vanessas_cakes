CREATE TABLE `field_option_dimensions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`field_option_id` integer NOT NULL,
	`diameter_in` text,
	`shape` text,
	`tiers` integer,
	`serves_min` integer,
	`serves_max` integer,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	FOREIGN KEY (`field_option_id`) REFERENCES `field_options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `field_option_dimensions_field_option_id_unique` ON `field_option_dimensions` (`field_option_id`);
--> statement-breakpoint
INSERT INTO field_option_dimensions (field_option_id, diameter_in, shape, tiers, serves_min, serves_max)
SELECT id, diameter_in, shape, tiers, serves_min, serves_max
FROM field_options
WHERE diameter_in IS NOT NULL OR shape IS NOT NULL OR tiers IS NOT NULL
   OR serves_min IS NOT NULL OR serves_max IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `fields` ADD `has_shape_diagram` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE fields SET has_shape_diagram = 1 WHERE slug = 'size';
--> statement-breakpoint
ALTER TABLE `field_options` DROP COLUMN `diameter_in`;--> statement-breakpoint
ALTER TABLE `field_options` DROP COLUMN `shape`;--> statement-breakpoint
ALTER TABLE `field_options` DROP COLUMN `tiers`;--> statement-breakpoint
ALTER TABLE `field_options` DROP COLUMN `serves_min`;--> statement-breakpoint
ALTER TABLE `field_options` DROP COLUMN `serves_max`;
