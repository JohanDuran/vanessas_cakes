CREATE TABLE "design_field_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_field_order" ADD CONSTRAINT "design_field_order_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_field_order" ADD CONSTRAINT "design_field_order_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_field_order_design_field_idx" ON "design_field_order" USING btree ("design_id","field_id");