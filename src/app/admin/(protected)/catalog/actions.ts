"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { fields, fieldOptions, fieldOptionDimensions } from "../../../../db/schema";
import { FIELD_TYPES, fieldHasOptions, slugify } from "../../../../lib/fields";

const dollarsToCents = (v: string) => Math.round(Number(v) * 100);

function uniqueSlug(base: string): string {
  const existing = new Set(
    db
      .select({ slug: fields.slug })
      .from(fields)
      .all()
      .map((f) => f.slug)
  );
  let slug = base;
  let n = 2;
  while (existing.has(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}

// --- field CRUD ---------------------------------------------------------

const createFieldSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(FIELD_TYPES),
});

export async function createField(formData: FormData) {
  const parsed = createFieldSchema.parse(Object.fromEntries(formData));
  const slug = uniqueSlug(slugify(parsed.name));

  const inserted = db
    .insert(fields)
    .values({ slug, name: parsed.name, type: parsed.type, isBase: false, updatedAt: Date.now() })
    .returning({ id: fields.id })
    .get();

  revalidatePath("/admin/catalog");
  redirect(`/admin/catalog/${inserted.id}`);
}

const fieldSettingsSchema = z.object({
  id: z.coerce.number().int(),
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(FIELD_TYPES).optional(), // absent for base fields (type select is disabled there)
  hasShapeDiagram: z.coerce.number().optional(),
});

export async function saveFieldSettings(formData: FormData) {
  const parsed = fieldSettingsSchema.parse(Object.fromEntries(formData));
  const field = db.select().from(fields).where(eq(fields.id, parsed.id)).get();
  if (!field) throw new Error("Field not found.");

  const finalType = field.isBase ? field.type : (parsed.type ?? field.type);

  db.update(fields)
    .set({
      name: parsed.name,
      type: finalType,
      // only select-type fields have options to attach dimensions to
      hasShapeDiagram: fieldHasOptions(finalType) ? Boolean(parsed.hasShapeDiagram) : false,
      updatedAt: Date.now(),
    })
    .where(eq(fields.id, parsed.id))
    .run();

  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${parsed.id}`);
}

const setFieldActiveSchema = z.object({
  id: z.coerce.number().int(),
  active: z.coerce.number(),
});

export async function setFieldActive(formData: FormData) {
  const parsed = setFieldActiveSchema.parse(Object.fromEntries(formData));
  db.update(fields)
    .set({ active: Boolean(parsed.active), updatedAt: Date.now() })
    .where(eq(fields.id, parsed.id))
    .run();
  revalidatePath("/admin/catalog");
}

// --- option CRUD ---------------------------------------------------------

const optionShape = {
  fieldId: z.coerce.number().int(),
  name: z.string().trim().min(1, "Name is required"),
  priceDollars: z.string().refine((v) => !Number.isNaN(Number(v)), "Must be a number"),
  sortOrder: z.coerce.number().int().default(0),
  diameterIn: z.string().trim().optional(),
  shape: z.enum(["round", "square", "sheet", ""]).optional(),
  tiers: z.string().optional(),
  servesMin: z.string().optional(),
  servesMax: z.string().optional(),
};

const createOptionSchema = z.object(optionShape);
const updateOptionSchema = z.object({ id: z.coerce.number().int(), ...optionShape });

function sizeMeta(data: {
  diameterIn?: string;
  shape?: string;
  tiers?: string;
  servesMin?: string;
  servesMax?: string;
}) {
  return {
    diameterIn: data.diameterIn || null,
    shape: data.shape || null,
    tiers: data.tiers ? Number(data.tiers) : null,
    servesMin: data.servesMin ? Number(data.servesMin) : null,
    servesMax: data.servesMax ? Number(data.servesMax) : null,
  };
}

export async function createOption(formData: FormData) {
  const parsed = createOptionSchema.parse(Object.fromEntries(formData));
  const field = db.select().from(fields).where(eq(fields.id, parsed.fieldId)).get();
  if (!field) throw new Error("Field not found.");

  db.transaction((tx) => {
    const inserted = tx
      .insert(fieldOptions)
      .values({
        fieldId: parsed.fieldId,
        name: parsed.name,
        priceCents: dollarsToCents(parsed.priceDollars),
        sortOrder: parsed.sortOrder,
        updatedAt: Date.now(),
      })
      .returning({ id: fieldOptions.id })
      .get();

    const dims = sizeMeta(parsed);
    const hasAnyDim = Object.values(dims).some((v) => v !== null);
    if (field.hasShapeDiagram && hasAnyDim) {
      tx.insert(fieldOptionDimensions)
        .values({ fieldOptionId: inserted.id, ...dims, updatedAt: Date.now() })
        .run();
    }
  });

  revalidatePath(`/admin/catalog/${parsed.fieldId}`);
}

export async function updateOption(formData: FormData) {
  const parsed = updateOptionSchema.parse(Object.fromEntries(formData));
  const field = db.select().from(fields).where(eq(fields.id, parsed.fieldId)).get();
  if (!field) throw new Error("Field not found.");

  db.transaction((tx) => {
    tx.update(fieldOptions)
      .set({
        name: parsed.name,
        priceCents: dollarsToCents(parsed.priceDollars),
        sortOrder: parsed.sortOrder,
        updatedAt: Date.now(),
      })
      .where(eq(fieldOptions.id, parsed.id))
      .run();

    tx.delete(fieldOptionDimensions).where(eq(fieldOptionDimensions.fieldOptionId, parsed.id)).run();

    const dims = sizeMeta(parsed);
    const hasAnyDim = Object.values(dims).some((v) => v !== null);
    if (field.hasShapeDiagram && hasAnyDim) {
      tx.insert(fieldOptionDimensions)
        .values({ fieldOptionId: parsed.id, ...dims, updatedAt: Date.now() })
        .run();
    }
  });

  revalidatePath(`/admin/catalog/${parsed.fieldId}`);
}

const setOptionActiveSchema = z.object({
  id: z.coerce.number().int(),
  fieldId: z.coerce.number().int(),
  active: z.coerce.number(),
});

export async function setOptionActive(formData: FormData) {
  const parsed = setOptionActiveSchema.parse(Object.fromEntries(formData));
  db.update(fieldOptions)
    .set({ active: Boolean(parsed.active), updatedAt: Date.now() })
    .where(eq(fieldOptions.id, parsed.id))
    .run();
  revalidatePath(`/admin/catalog/${parsed.fieldId}`);
}

// --- quick-add (design form's "+ Add Field" shortcut) --------------------
// No redirect — called imperatively from a client component, which updates
// its own local state with the returned data instead of navigating away.

export type QuickField = {
  id: number;
  slug: string;
  name: string;
  type: string;
  options: { id: number; name: string; priceCents: number }[];
};

const quickOptionSchema = z.object({
  label: z.string().trim().min(1),
  priceDollars: z.string().refine((v) => !Number.isNaN(Number(v)), "Must be a number"),
});

const quickCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(FIELD_TYPES),
  optionsJson: z.string().optional(),
});

export async function quickCreateField(formData: FormData): Promise<QuickField> {
  const parsed = quickCreateSchema.parse(Object.fromEntries(formData));

  let options: { label: string; priceDollars: string }[] = [];
  if (fieldHasOptions(parsed.type) && parsed.optionsJson) {
    try {
      options = z.array(quickOptionSchema).parse(JSON.parse(parsed.optionsJson));
    } catch {
      options = [];
    }
  }

  const slug = uniqueSlug(slugify(parsed.name));

  const fieldId = db.transaction((tx) => {
    const inserted = tx
      .insert(fields)
      .values({ slug, name: parsed.name, type: parsed.type, isBase: false, updatedAt: Date.now() })
      .returning({ id: fields.id })
      .get();

    options.forEach((opt, index) => {
      tx.insert(fieldOptions)
        .values({
          fieldId: inserted.id,
          name: opt.label,
          priceCents: dollarsToCents(opt.priceDollars),
          sortOrder: index,
          updatedAt: Date.now(),
        })
        .run();
    });

    return inserted.id;
  });

  revalidatePath("/admin/catalog");

  const savedOptions = db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, fieldId)).all();
  return {
    id: fieldId,
    slug,
    name: parsed.name,
    type: parsed.type,
    options: savedOptions.map((o) => ({ id: o.id, name: o.name, priceCents: o.priceCents })),
  };
}
