"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { catalogItems, constraintPairs, designPhotos, designRecipeItems, designs } from "../../../../db/schema";
import { AXES, type Axis } from "../../../../lib/axes";
import { selectionsViolateConstraints } from "../../../../lib/constraints";
import { computeStandardPriceCents } from "../../../../lib/pricing";
import { deleteUploadedPhoto, saveUploadedPhoto } from "../../../../lib/uploads";

const dollarsToCents = (v: string) => Math.round(Number(v) * 100);

const recipeFields = Object.fromEntries(
  AXES.map((axis) => [`recipe_${axis}`, z.coerce.number().int()])
) as Record<`recipe_${Axis}`, z.ZodNumber>;

const saveSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  chargedPriceDollars: z.string().refine((v) => !Number.isNaN(Number(v)), "Must be a number"),
  published: z.coerce.number().optional(),
  ...recipeFields,
});

export async function saveDesign(formData: FormData) {
  const parsed = saveSchema.parse(Object.fromEntries(formData));

  const recipeSelections = Object.fromEntries(
    AXES.map((axis) => [axis, parsed[`recipe_${axis}`]])
  ) as Record<Axis, number>;

  const allItems = db.select().from(catalogItems).all();
  const pairs = db.select().from(constraintPairs).all();

  if (selectionsViolateConstraints(recipeSelections, pairs)) {
    const backPath = parsed.id ? `/admin/designs/${parsed.id}/edit` : "/admin/designs/new";
    redirect(`${backPath}?error=constraint`);
  }

  const standardPriceCents = computeStandardPriceCents(recipeSelections, allItems);
  const chargedPriceCents = dollarsToCents(parsed.chargedPriceDollars);
  const premiumCents = chargedPriceCents - standardPriceCents;

  let designId = parsed.id;

  db.transaction((tx) => {
    if (designId) {
      tx.update(designs)
        .set({
          name: parsed.name,
          description: parsed.description || null,
          chargedPriceCents,
          premiumCents,
          published: Boolean(parsed.published),
          updatedAt: Date.now(),
        })
        .where(eq(designs.id, designId!))
        .run();

      tx.delete(designRecipeItems).where(eq(designRecipeItems.designId, designId!)).run();
    } else {
      const inserted = tx
        .insert(designs)
        .values({
          name: parsed.name,
          description: parsed.description || null,
          chargedPriceCents,
          premiumCents,
          published: Boolean(parsed.published),
          updatedAt: Date.now(),
        })
        .returning({ id: designs.id })
        .get();
      designId = inserted.id;
    }

    for (const axis of AXES) {
      tx.insert(designRecipeItems)
        .values({ designId: designId!, axis, catalogItemId: recipeSelections[axis] })
        .run();
    }
  });

  const photoFiles = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  for (const file of photoFiles) {
    const relPath = await saveUploadedPhoto(file);
    db.insert(designPhotos).values({ designId: designId!, path: relPath }).run();
  }

  revalidatePath("/admin/designs");
  redirect(`/admin/designs/${designId}/edit`);
}

const deletePhotoSchema = z.object({
  id: z.coerce.number().int(),
  designId: z.coerce.number().int(),
});

export async function deleteDesignPhoto(formData: FormData) {
  const parsed = deletePhotoSchema.parse(Object.fromEntries(formData));
  const photo = db.select().from(designPhotos).where(eq(designPhotos.id, parsed.id)).get();
  if (photo) {
    await deleteUploadedPhoto(photo.path);
    db.delete(designPhotos).where(eq(designPhotos.id, parsed.id)).run();
  }
  revalidatePath(`/admin/designs/${parsed.designId}/edit`);
}

export async function setPrimaryPhoto(formData: FormData) {
  const parsed = deletePhotoSchema.parse(Object.fromEntries(formData));
  db.transaction((tx) => {
    tx.update(designPhotos).set({ isPrimary: false }).where(eq(designPhotos.designId, parsed.designId)).run();
    tx.update(designPhotos).set({ isPrimary: true }).where(eq(designPhotos.id, parsed.id)).run();
  });
  revalidatePath(`/admin/designs/${parsed.designId}/edit`);
}

const togglePublishedSchema = z.object({
  id: z.coerce.number().int(),
  published: z.coerce.number(),
});

export async function setDesignPublished(formData: FormData) {
  const parsed = togglePublishedSchema.parse(Object.fromEntries(formData));
  db.update(designs)
    .set({ published: Boolean(parsed.published), updatedAt: Date.now() })
    .where(eq(designs.id, parsed.id))
    .run();
  revalidatePath("/admin/designs");
}
