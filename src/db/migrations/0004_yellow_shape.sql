CREATE TABLE `tier_preset_levels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tier_preset_id` integer NOT NULL,
	`position` integer NOT NULL,
	`mold_option_id` integer NOT NULL,
	FOREIGN KEY (`tier_preset_id`) REFERENCES `tier_presets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mold_option_id`) REFERENCES `field_options`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tier_preset_levels_preset_position_idx` ON `tier_preset_levels` (`tier_preset_id`,`position`);--> statement-breakpoint
CREATE TABLE `tier_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`field_option_id` integer NOT NULL,
	`level_count` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now','subsec') * 1000) NOT NULL,
	FOREIGN KEY (`field_option_id`) REFERENCES `field_options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tier_presets_field_option_id_unique` ON `tier_presets` (`field_option_id`);--> statement-breakpoint
ALTER TABLE `field_options` ADD `style_kind` text;--> statement-breakpoint
ALTER TABLE `field_options` ADD `tier_level_count` integer;