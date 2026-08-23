"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import {
  designExcludedOptions,
  designFieldValues,
  designLockedFields,
  designCategories,
  designPhotos,
  designs,
  fieldOptions,
  fields,
  constraintPairs,
  tierPresets,
  tierPresetLevels,
} from "../../../../db/schema";
import { selectionsViolateConstraints } from "../../../../lib/constraints";
import { buildCakeStyleContext } from "../../../../lib/cakeStyle";
import { computeStandardPriceCents, type Answers } from "../../../../lib/pricing";
import { isCakeStyleKind, isFieldType, isTierLevelCount, type FieldType } from "../../../../lib/fields";
import { deleteUploadedPhoto, saveUploadedPhoto } from "../../../../lib/uploads";
import type { FieldDTO, FieldOptionDTO, TierPresetDTO } from "../../../../lib/order-types";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const dollarsToCents = (v: string) => Math.round(Number(v) * 100);

const saveSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  chargedPriceDollars: z.string().refine((v) => !Number.isNaN(Number(v)), "Must be a number"),
  published: z.coerce.number().optional(),
});

export async function saveDesign(formData: FormData) {
  const rawId = formData.get("id");
  const backPath = rawId ? `/admin/designs/${rawId}/edit` : "/admin/designs/new";
  let designId: number | undefined;

  try {
    const parsed = saveSchema.parse(Object.fromEntries(formData));

    const allFields = db.select().from(fields).all();
    const allOptions = db.select().from(fieldOptions).all();

    const allTierPresetRows = db.select().from(tierPresets).all();
    const allTierPresetLevelRows = db.select().from(tierPresetLevels).all();
    const optionByIdRaw = new Map(allOptions.map((o) => [o.id, o]));
    const tierPresetDTOs: TierPresetDTO[] = allTierPresetRows.map((preset) => ({
      fieldOptionId: preset.fieldOptionId,
      levelCount: preset.levelCount,
      levels: allTierPresetLevelRows
        .filter((lvl) => lvl.tierPresetId === preset.id)
        .sort((a, b) => a.position - b.position)
        .map((lvl) => ({
          position: lvl.position,
          moldOptionId: lvl.moldOptionId,
          moldName: optionByIdRaw.get(lvl.moldOptionId)?.name ?? "Unknown",
          diameterIn: null,
          shape: null,
          servesMin: null,
          servesMax: null,
        })),
    }));

    const fieldDTOs: FieldDTO[] = allFields
      .filter((f) => isFieldType(f.type))
      .map((f) => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        type: f.type as FieldType,
        isBase: f.isBase,
        sortOrder: f.sortOrder,
        hasShapeDiagram: f.hasShapeDiagram,
        required: f.required,
        additionalPriceCents: f.additionalPriceCents,
      }));
    const optionDTOs: FieldOptionDTO[] = allOptions.map((o) => ({
      id: o.id,
      fieldId: o.fieldId,
      name: o.name,
      priceCents: o.priceCents,
      dimensions: null,
      styleKind: o.styleKind != null && isCakeStyleKind(o.styleKind) ? o.styleKind : null,
      tierLevelCount: o.tierLevelCount != null && isTierLevelCount(o.tierLevelCount) ? o.tierLevelCount : null,
    }));
    const cakeStyleCtx = buildCakeStyleContext(fieldDTOs, optionDTOs, tierPresetDTOs);

    const includedCustomFieldIds = new Set(
      formData
        .getAll("includedFieldIds")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n))
    );

    const answers: Answers = {};
    for (const field of allFields) {
      const isIncluded = field.isBase || includedCustomFieldIds.has(field.id);
      if (!isIncluded) continue;

      if (field.type === "single_select") {
        const raw = formData.get(`option_${field.id}`);
        const optionId = raw != null ? Number(raw) : NaN;
        if (!Number.isInteger(optionId)) {
          if (field.isBase) throw new Error(`${field.name} is required.`);
          continue;
        }
        answers[field.id] = { type: "options", optionIds: [optionId] };
      } else if (field.type === "multi_select") {
        const ids = formData
          .getAll(`options_${field.id}`)
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n));
        if (ids.length > 0) answers[field.id] = { type: "options", optionIds: ids };
      } else if (field.type === "text") {
        const value = String(formData.get(`text_${field.id}`) ?? "").trim();
        if (value) answers[field.id] = { type: "text", value };
      } else if (field.type === "number") {
        const raw = formData.get(`number_${field.id}`);
        if (raw != null && raw !== "") answers[field.id] = { type: "number", value: Number(raw) };
      }
    }

    for (const field of allFields) {
      if (field.isBase && !answers[field.id]) {
        throw new Error(`${field.name} is required.`);
      }
    }

    // the submitted `size` option must belong to the submitted cake_style —
    // catches a stale size pick left over from a different style in the form
    if (cakeStyleCtx) {
      const styleAnswer = answers[cakeStyleCtx.styleFieldId];
      const styleOptionId = styleAnswer?.type === "options" ? styleAnswer.optionIds[0] : undefined;
      const styleKind = styleOptionId != null ? cakeStyleCtx.styleKindByOptionId.get(styleOptionId) : undefined;

      const sizeAnswer = answers[cakeStyleCtx.sizeFieldId];
      const sizeOptionId = sizeAnswer?.type === "options" ? sizeAnswer.optionIds[0] : undefined;
      const sizeOptionStyle = sizeOptionId != null ? cakeStyleCtx.styleKindByOptionId.get(sizeOptionId) : undefined;
      if (sizeOptionId != null && sizeOptionStyle !== styleKind) {
        throw new Error("Size doesn't match the selected Cake Style.");
      }
    }

    const pairs = db
      .select()
      .from(constraintPairs)
      .all()
      .map((p) => ({ optionAId: p.optionAId, optionBId: p.optionBId }));

    if (selectionsViolateConstraints(answers, pairs)) {
      throw new Error(
        "This recipe combines two options marked incompatible in Constraints — fix it or remove that constraint first."
      );
    }

    const flatOptions = allOptions.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
    const flatFields = allFields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }));
    const standardPriceCents = computeStandardPriceCents(answers, flatOptions, flatFields);
    const chargedPriceCents = dollarsToCents(parsed.chargedPriceDollars);
    const premiumCents = chargedPriceCents - standardPriceCents;

    const lockedFieldIds = formData
      .getAll("lockedFieldIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));
    const lockedFieldIdSet = new Set(lockedFieldIds);

    const excludedOptionIdsRaw = formData
      .getAll("excludedOptionIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));

    const categoryIds = formData
      .getAll("categoryIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));

    // an option can't be excluded from its own field if it's also that
    // field's current default, or if the whole field is locked (moot)
    const defaultOptionIds = new Set(
      Object.values(answers).flatMap((a) => (a.type === "options" ? a.optionIds : []))
    );
    const excludedOptionIds = excludedOptionIdsRaw.filter((id) => {
      if (defaultOptionIds.has(id)) return false;
      const opt = allOptions.find((o) => o.id === id);
      return opt ? !lockedFieldIdSet.has(opt.fieldId) : true;
    });

    designId = parsed.id;

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

        tx.delete(designFieldValues).where(eq(designFieldValues.designId, designId!)).run();
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

      for (const [fieldIdStr, answer] of Object.entries(answers)) {
        const fieldId = Number(fieldIdStr);
        if (answer.type === "options") {
          for (const optionId of answer.optionIds) {
            tx.insert(designFieldValues).values({ designId: designId!, fieldId, fieldOptionId: optionId }).run();
          }
        } else if (answer.type === "text") {
          tx.insert(designFieldValues).values({ designId: designId!, fieldId, textValue: answer.value }).run();
        } else if (answer.type === "number") {
          tx.insert(designFieldValues).values({ designId: designId!, fieldId, numberValue: answer.value }).run();
        }
      }

      // an included text/number field with no default value still needs a
      // row to stay "included" (admin may leave a required field's default
      // empty) — insert a bare marker row for it
      for (const field of allFields) {
        if (
          (field.type === "text" || field.type === "number") &&
          includedCustomFieldIds.has(field.id) &&
          !answers[field.id]
        ) {
          tx.insert(designFieldValues).values({ designId: designId!, fieldId: field.id }).run();
        }
      }

      tx.delete(designLockedFields).where(eq(designLockedFields.designId, designId!)).run();
      lockedFieldIds.forEach((fieldId) => {
        tx.insert(designLockedFields).values({ designId: designId!, fieldId }).run();
      });

      tx.delete(designExcludedOptions).where(eq(designExcludedOptions.designId, designId!)).run();
      excludedOptionIds.forEach((fieldOptionId) => {
        tx.insert(designExcludedOptions).values({ designId: designId!, fieldOptionId }).run();
      });

      tx.delete(designCategories).where(eq(designCategories.designId, designId!)).run();
      categoryIds.forEach((categoryId) => {
        tx.insert(designCategories).values({ designId: designId!, categoryId }).run();
      });
    });

    const photoFiles = formData
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);

    for (const file of photoFiles) {
      const relPath = await saveUploadedPhoto(file);
      db.insert(designPhotos).values({ designId: designId!, path: relPath }).run();
    }

    revalidatePath("/admin/designs");
  } catch (err) {
    toastRedirect(backPath, "error", toastMessage(err, "Couldn't save this design."));
  }

  toastRedirect(`/admin/designs/${designId}/edit`, "success", "Design saved successfully!");
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
