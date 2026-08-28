CREATE TABLE "cake_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "cake_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cart_item_reference_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_item_id" integer NOT NULL,
	"path" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_item_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_item_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"field_option_id" integer,
	"text_value" text,
	"number_value" integer
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"design_id" integer,
	"is_custom" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "constraint_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"option_a_id" integer NOT NULL,
	"option_b_id" integer NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"category_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_excluded_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_option_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_field_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"field_option_id" integer,
	"text_value" text,
	"number_value" integer
);
--> statement-breakpoint
CREATE TABLE "design_locked_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"path" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"charged_price_cents" integer NOT NULL,
	"premium_cents" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"featured_sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_option_dimensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_option_id" integer NOT NULL,
	"diameter_in" text,
	"shape" text,
	"tiers" integer,
	"serves_min" integer,
	"serves_max" integer,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "field_option_dimensions_field_option_id_unique" UNIQUE("field_option_id")
);
--> statement-breakpoint
CREATE TABLE "field_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"style_kind" text,
	"tier_level_count" integer,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"has_shape_diagram" boolean DEFAULT false NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"additional_price_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "fields_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"design_id" integer,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_reference_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_item_id" integer NOT NULL,
	"path" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_item_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"field_option_id" integer,
	"text_value" text,
	"number_value" integer,
	"label_snapshot" text NOT NULL,
	"price_cents_snapshot" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"comments" text,
	"total_price_cents" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"pickup_date" text,
	"pickup_time" text,
	"contact_preference" text,
	"payment_status" text DEFAULT 'not_required' NOT NULL,
	"payment_plan" text DEFAULT 'full' NOT NULL,
	"amount_due_cents" integer DEFAULT 0 NOT NULL,
	"balance_collected_at" bigint,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_date_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"closed" boolean DEFAULT true NOT NULL,
	"open_time" text,
	"close_time" text,
	"note" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_time_hours" integer DEFAULT 24 NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"slot_interval_minutes" integer DEFAULT 30 NOT NULL,
	"max_orders_per_day" integer,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_weekly_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"open_time" text,
	"close_time" text,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "pickup_weekly_hours_day_of_week_unique" UNIQUE("day_of_week")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"marketing_opt_in" boolean DEFAULT true NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_preset_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"tier_preset_id" integer NOT NULL,
	"position" integer NOT NULL,
	"mold_option_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_option_id" integer NOT NULL,
	"level_count" integer NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "tier_presets_field_option_id_unique" UNIQUE("field_option_id")
);
--> statement-breakpoint
ALTER TABLE "cart_item_reference_images" ADD CONSTRAINT "cart_item_reference_images_cart_item_id_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."cart_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item_selections" ADD CONSTRAINT "cart_item_selections_cart_item_id_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."cart_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item_selections" ADD CONSTRAINT "cart_item_selections_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item_selections" ADD CONSTRAINT "cart_item_selections_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_pairs" ADD CONSTRAINT "constraint_pairs_option_a_id_field_options_id_fk" FOREIGN KEY ("option_a_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_pairs" ADD CONSTRAINT "constraint_pairs_option_b_id_field_options_id_fk" FOREIGN KEY ("option_b_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_categories" ADD CONSTRAINT "design_categories_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_categories" ADD CONSTRAINT "design_categories_category_id_cake_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cake_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_excluded_options" ADD CONSTRAINT "design_excluded_options_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_excluded_options" ADD CONSTRAINT "design_excluded_options_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_values" ADD CONSTRAINT "design_field_values_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_values" ADD CONSTRAINT "design_field_values_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_values" ADD CONSTRAINT "design_field_values_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_locked_fields" ADD CONSTRAINT "design_locked_fields_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_locked_fields" ADD CONSTRAINT "design_locked_fields_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_photos" ADD CONSTRAINT "design_photos_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_option_dimensions" ADD CONSTRAINT "field_option_dimensions_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reference_images" ADD CONSTRAINT "order_reference_images_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_selections" ADD CONSTRAINT "order_selections_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_selections" ADD CONSTRAINT "order_selections_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_selections" ADD CONSTRAINT "order_selections_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_preset_levels" ADD CONSTRAINT "tier_preset_levels_tier_preset_id_tier_presets_id_fk" FOREIGN KEY ("tier_preset_id") REFERENCES "public"."tier_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_preset_levels" ADD CONSTRAINT "tier_preset_levels_mold_option_id_field_options_id_fk" FOREIGN KEY ("mold_option_id") REFERENCES "public"."field_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_presets" ADD CONSTRAINT "tier_presets_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "constraint_pairs_options_idx" ON "constraint_pairs" USING btree ("option_a_id","option_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_categories_design_category_idx" ON "design_categories" USING btree ("design_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_excluded_options_design_option_idx" ON "design_excluded_options" USING btree ("design_id","field_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_field_values_design_field_option_idx" ON "design_field_values" USING btree ("design_id","field_id","field_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_locked_fields_design_field_idx" ON "design_locked_fields" USING btree ("design_id","field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_selections_item_field_option_idx" ON "order_selections" USING btree ("order_item_id","field_id","field_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_stripe_checkout_session_idx" ON "orders" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tier_preset_levels_preset_position_idx" ON "tier_preset_levels" USING btree ("tier_preset_id","position");