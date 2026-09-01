ALTER TABLE "fields" ADD COLUMN "show_in_design_form" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "fields" SET "show_in_design_form" = true WHERE "is_base" = true;