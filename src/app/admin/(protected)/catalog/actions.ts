"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { catalogItems } from "../../../../db/schema";
import { isAxis } from "../../../../lib/axes";

const dollarsToCents = (dollars: string) => Math.round(Number(dollars) * 100);

const baseFields = {
  name: z.string().trim().min(1, "Name is required"),
  priceDollars: z.string().refine((v) => !Number.isNaN(Number(v)), "Price must be a number"),
  sortOrder: z.coerce.number().int().default(0),
  diameterIn: z.string().trim().optional(),
  shape: z.enum(["round", "square", "sheet", ""]).optional(),
  tiers: z.string().optional(),
  servesMin: z.string().optional(),
  servesMax: z.string().optional(),
};

const createSchema = z.object({
  axis: z.string().refine(isAxis, "Invalid axis"),
  ...baseFields,
});

const updateSchema = z.object({
  id: z.coerce.number().int(),
  axis: z.string().refine(isAxis, "Invalid axis"),
  ...baseFields,
});

function sizeMeta(data: z.infer<typeof createSchema>) {
  if (data.axis !== "size") {
    return { diameterIn: null, shape: null, tiers: null, servesMin: null, servesMax: null };
  }
  return {
    diameterIn: data.diameterIn || null,
    shape: data.shape || null,
    tiers: data.tiers ? Number(data.tiers) : null,
    servesMin: data.servesMin ? Number(data.servesMin) : null,
    servesMax: data.servesMax ? Number(data.servesMax) : null,
  };
}

export async function createCatalogItem(formData: FormData) {
  const parsed = createSchema.parse(Object.fromEntries(formData));

  db.insert(catalogItems)
    .values({
      axis: parsed.axis,
      name: parsed.name,
      priceCents: dollarsToCents(parsed.priceDollars),
      sortOrder: parsed.sortOrder,
      ...sizeMeta(parsed),
      updatedAt: Date.now(),
    })
    .run();

  revalidatePath(`/admin/catalog/${parsed.axis}`);
}

export async function updateCatalogItem(formData: FormData) {
  const parsed = updateSchema.parse(Object.fromEntries(formData));

  db.update(catalogItems)
    .set({
      name: parsed.name,
      priceCents: dollarsToCents(parsed.priceDollars),
      sortOrder: parsed.sortOrder,
      ...sizeMeta(parsed),
      updatedAt: Date.now(),
    })
    .where(eq(catalogItems.id, parsed.id))
    .run();

  revalidatePath(`/admin/catalog/${parsed.axis}`);
}

const toggleSchema = z.object({
  id: z.coerce.number().int(),
  axis: z.string().refine(isAxis, "Invalid axis"),
  active: z.coerce.number(), // 1 to activate, 0 to deactivate
});

export async function setCatalogItemActive(formData: FormData) {
  const parsed = toggleSchema.parse(Object.fromEntries(formData));

  db.update(catalogItems)
    .set({ active: Boolean(parsed.active), updatedAt: Date.now() })
    .where(eq(catalogItems.id, parsed.id))
    .run();

  revalidatePath(`/admin/catalog/${parsed.axis}`);
}
