CREATE TABLE "design_field_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_field_size_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"size_option_id" integer NOT NULL,
	"price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_option_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_option_id" integer NOT NULL,
	"price_cents" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_field_prices" ADD CONSTRAINT "design_field_prices_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_prices" ADD CONSTRAINT "design_field_prices_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_size_prices" ADD CONSTRAINT "design_field_size_prices_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_size_prices" ADD CONSTRAINT "design_field_size_prices_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_size_prices" ADD CONSTRAINT "design_field_size_prices_size_option_id_field_options_id_fk" FOREIGN KEY ("size_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_option_prices" ADD CONSTRAINT "design_option_prices_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_option_prices" ADD CONSTRAINT "design_option_prices_field_option_id_field_options_id_fk" FOREIGN KEY ("field_option_id") REFERENCES "public"."field_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_field_prices_design_field_idx" ON "design_field_prices" USING btree ("design_id","field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_field_size_prices_design_field_size_idx" ON "design_field_size_prices" USING btree ("design_id","field_id","size_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_option_prices_design_option_idx" ON "design_option_prices" USING btree ("design_id","field_option_id");