ALTER TABLE `orders` ADD `payment_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_checkout_session_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_payment_intent_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_checkout_session_idx` ON `orders` (`stripe_checkout_session_id`);