ALTER TABLE "orders" ADD COLUMN "confirmation_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_confirmation_token_idx" ON "orders" USING btree ("confirmation_token");