-- Add designs.kind and seed the two singleton quote-request designs
-- ("Custom Cake" / "Custom Cake — From a Photo") before tightening
-- cart_items/order_items.design_id to NOT NULL, so any existing rows left
-- over from the old designId=null "custom cake" convention have somewhere
-- to point first.
ALTER TABLE "designs" ADD COLUMN "kind" text DEFAULT 'catalog' NOT NULL;--> statement-breakpoint

INSERT INTO "designs" ("name", "description", "charged_price_cents", "premium_cents", "published", "featured", "featured_sort_order", "kind")
VALUES
  ('Custom Cake', NULL, 0, 0, true, false, 0, 'custom'),
  ('Custom Cake — From a Photo', NULL, 0, 0, true, false, 0, 'custom_portfolio')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- every base field, included with no default answer, on both new designs —
-- keeps the two quote flows behaving exactly as before until an admin
-- changes something via the (now unified) Fields section of DesignForm
INSERT INTO "design_field_values" ("design_id", "field_id")
SELECT d.id, f.id
FROM "designs" d
CROSS JOIN "fields" f
WHERE d.kind IN ('custom', 'custom_portfolio') AND f.is_base = true
ON CONFLICT DO NOTHING;--> statement-breakpoint

UPDATE "cart_items" SET "design_id" = (SELECT id FROM "designs" WHERE kind = 'custom' LIMIT 1) WHERE "design_id" IS NULL;--> statement-breakpoint
UPDATE "order_items" SET "design_id" = (SELECT id FROM "designs" WHERE kind = 'custom' LIMIT 1) WHERE "design_id" IS NULL;--> statement-breakpoint

ALTER TABLE "cart_items" ALTER COLUMN "design_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "design_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designs_kind_singleton_idx" ON "designs" USING btree ("kind") WHERE "designs"."kind" <> 'catalog';--> statement-breakpoint
ALTER TABLE "cart_items" DROP COLUMN "is_custom";
