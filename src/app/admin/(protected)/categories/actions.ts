"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { cakeCategories } from "../../../../db/schema";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const PATH = "/admin/categories";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export async function createCategory(formData: FormData) {
  try {
    const parsed = createCategorySchema.parse(Object.fromEntries(formData));
    const existing = await db.select().from(cakeCategories).where(eq(cakeCategories.name, parsed.name)).then((r) => r[0]);
    if (existing) throw new Error("A category with this name already exists.");

    await db.insert(cakeCategories).values({ name: parsed.name, updatedAt: Date.now() });

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't create this category."));
  }

  toastRedirect(PATH, "success", "Category created successfully!");
}

const saveCategorySchema = z.object({
  id: z.coerce.number().int(),
  name: z.string().trim().min(1, "Name is required"),
  sortOrder: z.coerce.number().int().default(0),
});

export async function saveCategory(formData: FormData) {
  try {
    const parsed = saveCategorySchema.parse(Object.fromEntries(formData));

    await db.update(cakeCategories)
      .set({ name: parsed.name, sortOrder: parsed.sortOrder, updatedAt: Date.now() })
      .where(eq(cakeCategories.id, parsed.id))
      ;

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't save this category."));
  }

  toastRedirect(PATH, "success", "Category saved successfully!");
}

const setCategoryActiveSchema = z.object({
  id: z.coerce.number().int(),
  active: z.coerce.number(),
});

export async function setCategoryActive(formData: FormData) {
  const parsed = setCategoryActiveSchema.parse(Object.fromEntries(formData));
  await db.update(cakeCategories)
    .set({ active: Boolean(parsed.active), updatedAt: Date.now() })
    .where(eq(cakeCategories.id, parsed.id))
    ;
  revalidatePath(PATH);
}
