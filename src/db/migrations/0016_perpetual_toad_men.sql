ALTER TABLE `orders` ADD `payment_plan` text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `amount_due_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `balance_collected_at` integer;