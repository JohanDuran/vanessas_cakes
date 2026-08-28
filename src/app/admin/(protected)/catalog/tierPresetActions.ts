"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { fields, fieldOptions, tierPresets, tierPresetLevels } from "../../../../db/schema";
import { SIZE_FIELD_SLUG, isTierLevelCount } from "../../../../lib/fields";
import { isValidMoldStack, type AtomicMold } from "../../../../lib/cakeStyle";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const dollarsToCents = (v: string) => Math.round(Number(v) * 100);

/** Tiered presets are `size` field options tagged styleKind="tiered". */
async function getSizeField() {
  const field = await db.select().from(fields).where(eq(fields.slug, SIZE_FIELD_SLUG)).then((r) => r[0]);
  if (!field) throw new Error("size field not found.");
  return field;
}

/** Active Standard-styled molds — the only options a tier preset is allowed
 *  to reference, ranked by sortOrder for the adjacency/no-skip check. */
async function getAtomicMolds(sizeFieldId: number): Promise<AtomicMold[]> {
  return db
    .select({ id: fieldOptions.id, sortOrder: fieldOptions.sortOrder })
    .from(fieldOptions)
    .where(
      and(
        eq(fieldOptions.fieldId, sizeFieldId),
        eq(fieldOptions.active, true),
        eq(fieldOptions.styleKind, "standard")
      )
    );
}

const presetShape = {
  name: z.string().trim().min(1, "Name is required"),
  priceDollars: z.string().refine((v) => !Number.isNaN(Number(v)), "Must be a number"),
  levelCount: z.coerce.number().int(),
  moldOptionIds: z.array(z.coerce.number().int()),
};

const createPresetSchema = z.object(presetShape);
const updatePresetSchema = z.object({ id: z.coerce.number().int(), ...presetShape });

function readPresetForm(formData: FormData) {
  return {
    id: formData.get("id"),
    name: formData.get("name"),
    priceDollars: formData.get("priceDollars"),
    levelCount: formData.get("levelCount"),
    moldOptionIds: formData.getAll("moldOptionIds"),
  };
}

async function validateLevels(levelCount: number, moldOptionIds: number[], sizeFieldId: number) {
  if (!isTierLevelCount(levelCount)) throw new Error("Invalid number of tiers.");
  if (moldOptionIds.length !== levelCount) throw new Error("Pick a mold for every tier level.");
  if (!isValidMoldStack(moldOptionIds, await getAtomicMolds(sizeFieldId))) {
    throw new Error(
      "Molds must run base (widest) to top (narrowest) through adjacent sizes, with no size skipped."
    );
  }
}

export async function createTierPreset(formData: FormData) {
  let path = "/admin/catalog";

  try {
    const parsed = createPresetSchema.parse(readPresetForm(formData));
    const sizeField = await getSizeField();
    path = `/admin/catalog/${sizeField.id}`;
    await validateLevels(parsed.levelCount, parsed.moldOptionIds, sizeField.id);

    await db.transaction(async (tx) => {
      const insertedOption = await tx
        .insert(fieldOptions)
        .values({
          fieldId: sizeField.id,
          name: parsed.name,
          priceCents: dollarsToCents(parsed.priceDollars),
          sortOrder: parsed.levelCount,
          styleKind: "tiered",
          updatedAt: Date.now(),
        })
        .returning({ id: fieldOptions.id })
        .then((r) => r[0]);
      const insertedPreset = await tx
        .insert(tierPresets)
        .values({ fieldOptionId: insertedOption.id, levelCount: parsed.levelCount, updatedAt: Date.now() })
        .returning({ id: tierPresets.id })
        .then((r) => r[0]);
      for (const [index, moldOptionId] of parsed.moldOptionIds.entries()) {
        await tx.insert(tierPresetLevels).values({ tierPresetId: insertedPreset.id, position: index + 1, moldOptionId });
      }
    });

    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't add this tier preset."));
  }

  toastRedirect(path, "success", "Tier preset added successfully!");
}

export async function updateTierPreset(formData: FormData) {
  let path = "/admin/catalog";

  try {
    const parsed = updatePresetSchema.parse(readPresetForm(formData));
    const sizeField = await getSizeField();
    path = `/admin/catalog/${sizeField.id}`;
    await validateLevels(parsed.levelCount, parsed.moldOptionIds, sizeField.id);

    const preset = await db.select().from(tierPresets).where(eq(tierPresets.fieldOptionId, parsed.id)).then((r) => r[0]);
    if (!preset) throw new Error("Tier preset not found.");

    await db.transaction(async (tx) => {
      await tx.update(fieldOptions)
        .set({ name: parsed.name, priceCents: dollarsToCents(parsed.priceDollars), updatedAt: Date.now() })
        .where(eq(fieldOptions.id, parsed.id))
        ;
      await tx.update(tierPresets)
        .set({ levelCount: parsed.levelCount, updatedAt: Date.now() })
        .where(eq(tierPresets.id, preset.id))
        ;
      await tx.delete(tierPresetLevels).where(eq(tierPresetLevels.tierPresetId, preset.id));
      for (const [index, moldOptionId] of parsed.moldOptionIds.entries()) {
        await tx.insert(tierPresetLevels).values({ tierPresetId: preset.id, position: index + 1, moldOptionId });
      }
    });

    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't save this tier preset."));
  }

  toastRedirect(path, "success", "Tier preset saved successfully!");
}
