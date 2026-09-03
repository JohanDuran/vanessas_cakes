"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { fields, fieldOptions, fieldOptionDimensions, designFieldValues, designExcludedOptions } from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { CAKE_SHAPES, CAKE_STYLE_FIELD_SLUG, FIELD_TYPES, SIZE_FIELD_SLUG, fieldHasOptions, isBaseFieldSlug, slugify } from "../../../../lib/fields";
import { toastMessage, toastRedirect } from "../../../../lib/toast";

/** cake_style is locked to its exact set of seeded options — admins may
 *  rename/re-price them but not add/remove/deactivate. */
const LOCKED_OPTION_SET_SLUGS = new Set([CAKE_STYLE_FIELD_SLUG]);

const dollarsToCents = (v: string) => Math.round(Number(v) * 100);

async function uniqueSlug(base: string): Promise<string> {
  const existing = new Set((await db.select({ slug: fields.slug }).from(fields)).map((f) => f.slug));
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
  additionalPriceDollars: z.string().optional(),
});

/** Additional-price only ever applies to text/number/per_size fields — a
 *  select-type field is priced per-option instead, so this input is ignored
 *  for any other type. */
function textOrNumberOnly<T>(type: string, value: T, fallback: T): T {
  return type === "text" || type === "number" || type === "per_size" ? value : fallback;
}

export async function createField(formData: FormData) {
  let fieldId: number | undefined;

  try {
    await requireAdmin();
    const parsed = createFieldSchema.parse(Object.fromEntries(formData));
    const slug = await uniqueSlug(slugify(parsed.name));

    const inserted = await db
      .insert(fields)
      .values({
        slug,
        name: parsed.name,
        type: parsed.type,
        isBase: false,
        additionalPriceCents: textOrNumberOnly(parsed.type, dollarsToCents(parsed.additionalPriceDollars || "0"), 0),
        updatedAt: Date.now(),
      })
      .returning({ id: fields.id })
      .then((r) => r[0]);
    fieldId = inserted.id;

    revalidatePath("/admin/catalog");
  } catch (err) {
    toastRedirect("/admin/catalog/new", "error", toastMessage(err, "Couldn't create this field."));
  }

  toastRedirect(`/admin/catalog/${fieldId}`, "success", "Field created successfully!");
}

const fieldSettingsSchema = z.object({
  id: z.coerce.number().int(),
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(FIELD_TYPES).optional(), // absent for structural fields (type select is disabled there)
  hasShapeDiagram: z.coerce.number().optional(),
  additionalPriceDollars: z.string().optional(),
  isBase: z.coerce.number().optional(),
});

export async function saveFieldSettings(formData: FormData) {
  const rawId = formData.get("id");
  const path = `/admin/catalog/${rawId}`;

  try {
    await requireAdmin();
    const parsed = fieldSettingsSchema.parse(Object.fromEntries(formData));
    const field = await db.select().from(fields).where(eq(fields.id, parsed.id)).then((r) => r[0]);
    if (!field) throw new Error("Field not found.");

    // the 7 canonical fields' types are structurally load-bearing regardless
    // of the (now fully admin-editable) isBase flag — see isStructuralField
    // in catalog/[fieldId]/page.tsx
    const finalType = isBaseFieldSlug(field.slug) ? field.type : (parsed.type ?? field.type);

    await db.update(fields)
      .set({
        name: parsed.name,
        type: finalType,
        // only select-type fields have options to attach dimensions to
        hasShapeDiagram: fieldHasOptions(finalType) ? Boolean(parsed.hasShapeDiagram) : false,
        additionalPriceCents: textOrNumberOnly(
          finalType,
          dollarsToCents(parsed.additionalPriceDollars || "0"),
          0
        ),
        isBase: Boolean(parsed.isBase),
        updatedAt: Date.now(),
      })
      .where(eq(fields.id, parsed.id))
      ;

    revalidatePath("/admin/catalog");
    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't save field settings."));
  }

  toastRedirect(path, "success", "Field settings saved successfully!");
}

const setFieldActiveSchema = z.object({
  id: z.coerce.number().int(),
  active: z.coerce.number(),
});

export async function setFieldActive(formData: FormData) {
  await requireAdmin();
  const parsed = setFieldActiveSchema.parse(Object.fromEntries(formData));
  await db.update(fields)
    .set({ active: Boolean(parsed.active), updatedAt: Date.now() })
    .where(eq(fields.id, parsed.id))
    ;
  revalidatePath("/admin/catalog");
}

// --- option CRUD ---------------------------------------------------------

const optionShape = {
  fieldId: z.coerce.number().int(),
  name: z.string().trim().min(1, "Name is required"),
  priceDollars: z.string().refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)), "Must be a number"),
  sortOrder: z.coerce.number().int().default(0),
  diameterIn: z.string().trim().optional(),
  widthIn: z.string().trim().optional(),
  lengthIn: z.string().trim().optional(),
  shape: z.enum([...CAKE_SHAPES, ""]).optional(),
  tiers: z.string().optional(),
  servesMin: z.string().optional(),
  servesMax: z.string().optional(),
  // only meaningful for the `size` field — which plain-mold style (Standard/
  // Tall/Carlota/Torta Chilena) this size option belongs to. Tiered size
  // options are never created here; see tierPresetActions.ts.
  styleKind: z.enum(["standard", "tall", "carlota", "torta_chilena"]).optional(),
};

const createOptionSchema = z.object(optionShape);
const updateOptionSchema = z.object({ id: z.coerce.number().int(), ...optionShape });

function sizeMeta(data: {
  diameterIn?: string;
  widthIn?: string;
  lengthIn?: string;
  shape?: string;
  tiers?: string;
  servesMin?: string;
  servesMax?: string;
}) {
  const shape = data.shape || null;
  // which dimension(s) apply is decided here, server-side, from the
  // selected shape — independent of which inputs the admin form happened
  // to show/hide client-side
  const isCircle = shape === "circle";
  const isRect = shape === "square" || shape === "rectangle";
  return {
    diameterIn: isCircle && data.diameterIn ? Number(data.diameterIn) : null,
    widthIn: isRect && data.widthIn ? Number(data.widthIn) : null,
    lengthIn: isRect && data.lengthIn ? Number(data.lengthIn) : null,
    shape,
    tiers: data.tiers ? Number(data.tiers) : null,
    servesMin: data.servesMin ? Number(data.servesMin) : null,
    servesMax: data.servesMax ? Number(data.servesMax) : null,
  };
}

export async function createOption(formData: FormData) {
  const rawFieldId = formData.get("fieldId");
  const path = `/admin/catalog/${rawFieldId}`;

  try {
    await requireAdmin();
    const parsed = createOptionSchema.parse(Object.fromEntries(formData));
    const field = await db.select().from(fields).where(eq(fields.id, parsed.fieldId)).then((r) => r[0]);
    if (!field) throw new Error("Field not found.");
    if (LOCKED_OPTION_SET_SLUGS.has(field.slug as typeof CAKE_STYLE_FIELD_SLUG)) {
      throw new Error(`${field.name}'s options are fixed and can't be added to.`);
    }
    const isSizeField = field.slug === SIZE_FIELD_SLUG;
    if (isSizeField && !parsed.styleKind) {
      throw new Error(
        "Choose Standard, Tall, Carlota, or Torta Chilena for this size — tiered presets are built below instead."
      );
    }

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(fieldOptions)
        .values({
          fieldId: parsed.fieldId,
          name: parsed.name,
          priceCents: dollarsToCents(parsed.priceDollars),
          sortOrder: parsed.sortOrder,
          styleKind: isSizeField ? parsed.styleKind : null,
          updatedAt: Date.now(),
        })
        .returning({ id: fieldOptions.id })
        .then((r) => r[0]);

      const dims = sizeMeta(parsed);
      const hasAnyDim = Object.values(dims).some((v) => v !== null);
      if (field.hasShapeDiagram && hasAnyDim) {
        await tx.insert(fieldOptionDimensions)
          .values({ fieldOptionId: inserted.id, ...dims, updatedAt: Date.now() })
          ;
      }

      // a brand-new option must not silently become orderable (and
      // unpriced) on every design that already uses this field — hide it
      // there until the admin explicitly visits that design and adds/prices
      // it. A design that starts using this field later is unaffected, same
      // as always (its own excluded-options list starts empty).
      const existingDesigns = await tx
        .selectDistinct({ designId: designFieldValues.designId })
        .from(designFieldValues)
        .where(eq(designFieldValues.fieldId, parsed.fieldId));
      if (existingDesigns.length > 0) {
        await tx.insert(designExcludedOptions).values(
          existingDesigns.map((d) => ({ designId: d.designId, fieldOptionId: inserted.id }))
        );
      }
    });

    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't add this option."));
  }

  toastRedirect(path, "success", "Option added successfully!");
}

export async function updateOption(formData: FormData) {
  const rawFieldId = formData.get("fieldId");
  const path = `/admin/catalog/${rawFieldId}`;

  try {
    await requireAdmin();
    const parsed = updateOptionSchema.parse(Object.fromEntries(formData));
    const field = await db.select().from(fields).where(eq(fields.id, parsed.fieldId)).then((r) => r[0]);
    if (!field) throw new Error("Field not found.");

    await db.transaction(async (tx) => {
      await tx.update(fieldOptions)
        .set({
          name: parsed.name,
          priceCents: dollarsToCents(parsed.priceDollars),
          sortOrder: parsed.sortOrder,
          updatedAt: Date.now(),
        })
        .where(eq(fieldOptions.id, parsed.id))
        ;

      await tx.delete(fieldOptionDimensions).where(eq(fieldOptionDimensions.fieldOptionId, parsed.id));

      const dims = sizeMeta(parsed);
      const hasAnyDim = Object.values(dims).some((v) => v !== null);
      if (field.hasShapeDiagram && hasAnyDim) {
        await tx.insert(fieldOptionDimensions)
          .values({ fieldOptionId: parsed.id, ...dims, updatedAt: Date.now() })
          ;
      }
    });

    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't save this option."));
  }

  toastRedirect(path, "success", "Option saved successfully!");
}

const setOptionActiveSchema = z.object({
  id: z.coerce.number().int(),
  fieldId: z.coerce.number().int(),
  active: z.coerce.number(),
});

export async function setOptionActive(formData: FormData) {
  await requireAdmin();
  const parsed = setOptionActiveSchema.parse(Object.fromEntries(formData));
  const field = await db.select().from(fields).where(eq(fields.id, parsed.fieldId)).then((r) => r[0]);
  if (field && !parsed.active && LOCKED_OPTION_SET_SLUGS.has(field.slug as typeof CAKE_STYLE_FIELD_SLUG)) {
    throw new Error(`${field.name}'s options must always stay active.`);
  }
  await db.update(fieldOptions)
    .set({ active: Boolean(parsed.active), updatedAt: Date.now() })
    .where(eq(fieldOptions.id, parsed.id))
    ;
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
  additionalPriceCents: number;
  options: { id: number; name: string; priceCents: number }[];
};

const quickOptionSchema = z.object({
  label: z.string().trim().min(1),
  priceDollars: z.string().refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)), "Must be a number"),
});

const quickCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(FIELD_TYPES),
  optionsJson: z.string().optional(),
  additionalPriceDollars: z.string().optional(),
});

export async function quickCreateField(formData: FormData): Promise<QuickField> {
  await requireAdmin();
  const parsed = quickCreateSchema.parse(Object.fromEntries(formData));

  let options: { label: string; priceDollars: string }[] = [];
  if (fieldHasOptions(parsed.type) && parsed.optionsJson) {
    try {
      options = z.array(quickOptionSchema).parse(JSON.parse(parsed.optionsJson));
    } catch {
      options = [];
    }
  }

  const slug = await uniqueSlug(slugify(parsed.name));
  const additionalPriceCents = textOrNumberOnly(
    parsed.type,
    dollarsToCents(parsed.additionalPriceDollars || "0"),
    0
  );

  const fieldId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(fields)
      .values({
        slug,
        name: parsed.name,
        type: parsed.type,
        isBase: false,
        additionalPriceCents,
        updatedAt: Date.now(),
      })
      .returning({ id: fields.id })
      .then((r) => r[0]);

    for (const [index, opt] of options.entries()) {
      await tx.insert(fieldOptions).values({
        fieldId: inserted.id,
        name: opt.label,
        priceCents: dollarsToCents(opt.priceDollars),
        sortOrder: index,
        updatedAt: Date.now(),
      });
    }

    return inserted.id;
  });

  revalidatePath("/admin/catalog");

  const savedOptions = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, fieldId));
  return {
    id: fieldId,
    slug,
    name: parsed.name,
    type: parsed.type,
    additionalPriceCents,
    options: savedOptions.map((o) => ({ id: o.id, name: o.name, priceCents: o.priceCents })),
  };
}
