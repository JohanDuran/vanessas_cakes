ALTER TABLE "field_option_dimensions" RENAME COLUMN "diameter_in" TO "diameter_in_text";--> statement-breakpoint
ALTER TABLE "field_option_dimensions" ADD COLUMN "diameter_in" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "field_option_dimensions" ADD COLUMN "width_in" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "field_option_dimensions" ADD COLUMN "length_in" numeric(5, 2);--> statement-breakpoint
-- backfill numeric dimensions from the old free-text column (handles "6\"", "8''", and "12\" x 8\"" style values) before dropping it
WITH parsed AS (
  SELECT id, regexp_replace(replace(lower(diameter_in_text), '×', 'x'), '[^0-9x.]', '', 'g') AS norm
  FROM "field_option_dimensions"
  WHERE diameter_in_text IS NOT NULL
)
UPDATE "field_option_dimensions" d
SET
  diameter_in = CASE WHEN d.shape = 'round' THEN NULLIF(split_part(p.norm, 'x', 1), '')::numeric END,
  width_in = CASE WHEN d.shape IN ('square', 'sheet') THEN NULLIF(split_part(p.norm, 'x', 1), '')::numeric END,
  length_in = CASE WHEN d.shape IN ('square', 'sheet') THEN
    COALESCE(NULLIF(split_part(p.norm, 'x', 2), '')::numeric, NULLIF(split_part(p.norm, 'x', 1), '')::numeric)
  END
FROM parsed p
WHERE p.id = d.id;--> statement-breakpoint
UPDATE "field_option_dimensions" SET shape = 'circle' WHERE shape = 'round';--> statement-breakpoint
UPDATE "field_option_dimensions" SET shape = 'rectangle' WHERE shape = 'sheet';--> statement-breakpoint
ALTER TABLE "field_option_dimensions" DROP COLUMN "diameter_in_text";
