import { eq } from "drizzle-orm";
import { db } from "./index";
import { catalogItems, designPhotos, designRecipeItems, designs, constraintPairs } from "./schema";
import { type Axis } from "../lib/axes";
import type { DesignSummaryDTO } from "../lib/order-types";

/** Everything the customer-facing order flow (wizard + gallery) needs:
 *  active catalog items, published designs (with primary photo + recipe), and constraint pairs. */
export async function loadOrderData() {
  const [items, publishedDesigns, allPhotos, allRecipeRows, pairs] = await Promise.all([
    db.select().from(catalogItems).where(eq(catalogItems.active, true)).then((r) => r),
    db.select().from(designs).where(eq(designs.published, true)).then((r) => r),
    db.select().from(designPhotos).then((r) => r),
    db.select().from(designRecipeItems).then((r) => r),
    db.select().from(constraintPairs).then((r) => r),
  ]);

  const photoByDesign = new Map<number, string>();
  for (const photo of allPhotos) {
    if (photo.isPrimary || !photoByDesign.has(photo.designId)) {
      photoByDesign.set(photo.designId, photo.path);
    }
  }

  const recipeByDesign = new Map<number, Partial<Record<Axis, number>>>();
  for (const row of allRecipeRows) {
    const recipe = recipeByDesign.get(row.designId) ?? {};
    recipe[row.axis as Axis] = row.catalogItemId;
    recipeByDesign.set(row.designId, recipe);
  }

  const designSummaries: DesignSummaryDTO[] = publishedDesigns.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    chargedPriceCents: d.chargedPriceCents,
    premiumCents: d.premiumCents,
    photoPath: photoByDesign.get(d.id) ?? null,
    recipe: recipeByDesign.get(d.id) ?? {},
  }));

  const constraintPairsDTO = pairs.map((p) => ({ itemAId: p.itemAId, itemBId: p.itemBId }));

  return { items, designSummaries, constraintPairsDTO };
}
