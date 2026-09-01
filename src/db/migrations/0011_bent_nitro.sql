CREATE TABLE "design_hidden_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_option_size_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_option_id" integer NOT NULL,
	"size_option_id" integer NOT NULL,
	"price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_required_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_hidden_fields" ADD CONSTRAINT "design_hidden_fields_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_hidden_fields" ADD CONSTRAINT "design_hidden_fields_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_option_size_prices" ADD CONSTRAINT "design_option_size_prices_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_option_size_prices" ADD CONSTRAINT "design_option_size_prices_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_option_size_prices" ADD CONSTRAINT "design_option_size_prices_size_option_id_field_options_id_fk" FOREIGN KEY ("size_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_required_fields" ADD CONSTRAINT "design_required_fields_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_required_fields" ADD CONSTRAINT "design_required_fields_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_hidden_fields_design_field_idx" ON "design_hidden_fields" USING btree ("design_id","field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_option_size_prices_design_option_size_idx" ON "design_option_size_prices" USING btree ("design_id","field_option_id","size_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_required_fields_design_field_idx" ON "design_required_fields" USING btree ("design_id","field_id");--> statement-breakpoint
ALTER TABLE "designs" DROP COLUMN "charged_price_cents";--> statement-breakpoint
ALTER TABLE "designs" DROP COLUMN "premium_cents";--> statement-breakpoint
UPDATE "fields" SET "is_base" = "show_in_design_form";--> statement-breakpoint
ALTER TABLE "fields" DROP COLUMN "show_in_design_form";--> statement-breakpoint
-- backfill design_required_fields so every existing design keeps behaving
-- the way it always has: every included single_select field was
-- unconditionally required (regardless of isBase), and every included
-- text/number/per_size field marked required at the catalog level carried
-- that into every design that used it. Both concepts are per-design from
-- here on (see design_required_fields), this just preserves today's behavior.
INSERT INTO "design_required_fields" ("design_id", "field_id")
SELECT DISTINCT "dfv"."design_id", "dfv"."field_id"
FROM "design_field_values" "dfv"
JOIN "fields" "f" ON "f"."id" = "dfv"."field_id"
WHERE "f"."type" = 'single_select'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "design_required_fields" ("design_id", "field_id")
SELECT DISTINCT "dfv"."design_id", "dfv"."field_id"
FROM "design_field_values" "dfv"
JOIN "fields" "f" ON "f"."id" = "dfv"."field_id"
WHERE "f"."required" = true
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "fields" DROP COLUMN "required";