"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import {
  designExcludedOptions,
  designFieldOrder,
  designFieldPrices,
  designFieldSizePrices,
  designFieldValues,
  designHiddenFields,
  designLockedFields,
  designOptionPrices,
  designOptionSizePrices,
  designRequiredFields,
  designCategories,
  designPhotos,
  designs,
  fieldOptions,
  fields,
  constraintPairs,
  portfolioPhotos,
  tierPresets,
  tierPresetLevels,
} from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { selectionsViolateConstraints } from "../../../../lib/constraints";
import { buildCakeStyleContext } from "../../../../lib/cakeStyle";
import { type Answers } from "../../../../lib/pricing";
import {
  CAKE_STYLE_FIELD_SLUG,
  SIZE_FIELD_SLUG,
  fieldHasOptions,
  isCakeStyleKind,
  isDesignKind,
  isFieldType,
  isTierLevelCount,
  type FieldType,
} from "../../../../lib/fields";
import { deleteUploadedPhoto, saveUploadedPhoto } from "../../../../lib/uploads";
import type { FieldDTO, FieldOptionDTO, TierPresetDTO } from "../../../../lib/order-types";
import { toastMessage, toastRedirect } from "../../../../lib/toast";

const dollarsToCents = (v: string) => Math.round(Number(v) * 100);

const saveSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  published: z.coerce.number().optional(),
  portfolioPhotoId: z.coerce.number().int().optional(),
});

export async function saveDesign(formData: FormData) {
  const rawId = formData.get("id");
  const backPath = rawId ? `/admin/designs/${rawId}/edit` : "/admin/designs/new";
  let designId: number | undefined;

  try {
    await requireAdmin();
    const parsed = saveSchema.parse(Object.fromEntries(formData));

    // kind is immutable after creation — new designs (no id) are always
    // catalog; the two quote-kind designs are seeded once and only ever
    // edited, never created through this form.
    const existingDesign = parsed.id
      ? await db.select().from(designs).where(eq(designs.id, parsed.id)).then((r) => r[0])
      : undefined;
    if (parsed.id && !existingDesign) throw new Error("Design not found.");
    const kind = existingDesign && isDesignKind(existingDesign.kind) ? existingDesign.kind : "catalog";
    const isCatalog = kind === "catalog";

    const allFields = await db.select().from(fields);
    const allOptions = await db.select().from(fieldOptions);

    const allTierPresetRows = await db.select().from(tierPresets);
    const allTierPresetLevelRows = await db.select().from(tierPresetLevels);
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

    const includedFieldIds = new Set(
      formData
        .getAll("includedFieldIds")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n))
    );

    // cake_style and size must move together — see the matching
    // PAIRED_INCLUSION_SLUGS rule in DesignForm.tsx
    const cakeStyleField = allFields.find((f) => f.slug === CAKE_STYLE_FIELD_SLUG);
    const sizeField = allFields.find((f) => f.slug === SIZE_FIELD_SLUG);
    if (cakeStyleField && sizeField && includedFieldIds.has(cakeStyleField.id) !== includedFieldIds.has(sizeField.id)) {
      throw new Error("Cake Style and Size must be enabled or disabled together.");
    }

    const answers: Answers = {};
    for (const field of allFields) {
      const isIncluded = includedFieldIds.has(field.id);
      if (!isIncluded) continue;

      if (field.type === "single_select") {
        const raw = formData.get(`option_${field.id}`);
        const optionId = raw != null ? Number(raw) : NaN;
        // a default is optional now — whether the customer must pick one
        // themselves is governed entirely by design_required_fields (see
        // OrderWizard's isFieldAnswered/nextDisabled), not by this admin form
        if (!Number.isInteger(optionId)) continue;
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

    const pairs = (await db.select().from(constraintPairs)).map((p) => ({
      optionAId: p.optionAId,
      optionBId: p.optionBId,
    }));

    if (selectionsViolateConstraints(answers, pairs)) {
      throw new Error(
        "This recipe combines two options marked incompatible in Constraints — fix it or remove that constraint first."
      );
    }

    // this design's own price overrides — an input only exists in the
    // submitted form for a field the admin currently has included (see
    // DesignForm's isIncluded-gated price inputs), so nothing here can ever
    // touch a field this design doesn't use
    const optionPriceOverrides: Record<number, number> = {};
    for (const opt of allOptions) {
      const raw = formData.get(`optionPrice_${opt.id}`);
      if (raw == null || raw === "") continue;
      optionPriceOverrides[opt.id] = dollarsToCents(String(raw));
    }
    const fieldPriceOverrides: Record<number, number> = {};
    for (const field of allFields) {
      if (fieldHasOptions(field.type)) continue;
      const raw = formData.get(`fieldPrice_${field.id}`);
      if (raw == null || raw === "") continue;
      fieldPriceOverrides[field.id] = dollarsToCents(String(raw));
    }
    const sizeVaryingFieldIds = new Set(
      formData
        .getAll("sizeVaryingFieldIds")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n))
    );
    const sizeOptions = sizeField ? allOptions.filter((o) => o.fieldId === sizeField.id) : [];
    const perSizeFieldPrices: Record<number, Record<number, number>> = {};
    for (const field of allFields) {
      if (field.type !== "per_size" || !sizeVaryingFieldIds.has(field.id)) continue;
      const bySize: Record<number, number> = {};
      for (const sizeOpt of sizeOptions) {
        const raw = formData.get(`sizePrice_${field.id}_${sizeOpt.id}`);
        bySize[sizeOpt.id] = raw != null && raw !== "" ? dollarsToCents(String(raw)) : 0;
      }
      perSizeFieldPrices[field.id] = bySize;
    }

    // regular select fields (e.g. Filling) whose *options* this design has
    // made size-varying — see design_option_size_prices. cake_style itself
    // can never be size-varying (it drives which sizes exist in the first
    // place, see cakeStyle.ts) — the admin UI never submits this for it, but
    // strip it here too in case of a tampered/stale form post.
    const optionSizeVaryingFieldIds = new Set(
      formData
        .getAll("optionSizeVaryingFieldIds")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n !== cakeStyleField?.id)
    );
    const optionSizePrices: Record<number, Record<number, number>> = {};
    for (const field of allFields) {
      if (!fieldHasOptions(field.type) || !optionSizeVaryingFieldIds.has(field.id)) continue;
      const optionsForField = allOptions.filter((o) => o.fieldId === field.id);
      for (const opt of optionsForField) {
        const bySize: Record<number, number> = {};
        for (const sizeOpt of sizeOptions) {
          const raw = formData.get(`optionSizePrice_${opt.id}_${sizeOpt.id}`);
          bySize[sizeOpt.id] = raw != null && raw !== "" ? dollarsToCents(String(raw)) : 0;
        }
        optionSizePrices[opt.id] = bySize;
      }
    }

    const lockedFieldIds = formData
      .getAll("lockedFieldIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));
    const lockedFieldIdSet = new Set(lockedFieldIds);

    const hiddenFieldIds = formData
      .getAll("hiddenFieldIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));

    // a hidden field can never also be required — the customer never sees it
    // to answer it, so this can't be satisfied. The admin UI keeps these
    // mutually exclusive already; this just guards against a tampered/stale
    // form post carrying both for the same field.
    const hiddenFieldIdSet = new Set(hiddenFieldIds);
    const requiredFieldIds = formData
      .getAll("requiredFieldIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && !hiddenFieldIdSet.has(n));

    const excludedOptionIdsRaw = formData
      .getAll("excludedOptionIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));

    const categoryIds = formData
      .getAll("categoryIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));

    // this design's own field display order, in whatever order the admin
    // left them arranged in — rendered as hidden inputs in that exact DOM
    // order (see DesignForm), deduped defensively in case the same field id
    // somehow appears twice
    const fieldOrderIds = Array.from(
      new Set(
        formData
          .getAll("fieldOrder")
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n))
      )
    );

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
    const isCreate = !designId;

    // a brand-new design with no seed photo (no Portfolio pick) needs at
    // least one photo of its own — editing an existing design manages its
    // photos separately, and a Portfolio-seeded one already has one
    if (isCreate && !parsed.portfolioPhotoId) {
      const hasPhotoFile = formData
        .getAll("photos")
        .some((f) => f instanceof File && f.size > 0);
      if (!hasPhotoFile) throw new Error("Add at least one photo.");
    }

    await db.transaction(async (tx) => {
      // the two quote-kind designs are always reachable, never unlisted like
      // a catalog product, regardless of what the (hidden, always "1")
      // published checkbox carries
      const published = isCatalog ? Boolean(parsed.published) : true;

      if (designId) {
        await tx.update(designs)
          .set({
            name: parsed.name,
            description: parsed.description || null,
            published,
            updatedAt: Date.now(),
          })
          .where(eq(designs.id, designId!))
          ;

        await tx.delete(designFieldValues).where(eq(designFieldValues.designId, designId!));
      } else {
        const inserted = await tx
          .insert(designs)
          .values({
            name: parsed.name,
            description: parsed.description || null,
            published,
            updatedAt: Date.now(),
          })
          .returning({ id: designs.id })
          .then((r) => r[0]);
        designId = inserted.id;
      }

      for (const [fieldIdStr, answer] of Object.entries(answers)) {
        const fieldId = Number(fieldIdStr);
        if (answer.type === "options") {
          for (const optionId of answer.optionIds) {
            await tx.insert(designFieldValues).values({ designId: designId!, fieldId, fieldOptionId: optionId });
          }
        } else if (answer.type === "text") {
          await tx.insert(designFieldValues).values({ designId: designId!, fieldId, textValue: answer.value });
        } else if (answer.type === "number") {
          await tx.insert(designFieldValues).values({ designId: designId!, fieldId, numberValue: answer.value });
        }
      }

      // an included field with no default value still needs a row to stay
      // "included" — inclusion *is* having a row here, value or not (see
      // loadOrderData's includedFieldIdsByDesign). This covers text/number
      // fields left blank (admin may leave a required field's default
      // empty) and, now that a default is only required for catalog
      // designs, single/multi_select fields left unanswered on a quote
      // design too — insert a bare marker row for any of these.
      for (const field of allFields) {
        if (includedFieldIds.has(field.id) && !answers[field.id]) {
          await tx.insert(designFieldValues).values({ designId: designId!, fieldId: field.id });
        }
      }

      await tx.delete(designLockedFields).where(eq(designLockedFields.designId, designId!));
      for (const fieldId of lockedFieldIds) {
        await tx.insert(designLockedFields).values({ designId: designId!, fieldId });
      }

      await tx.delete(designHiddenFields).where(eq(designHiddenFields.designId, designId!));
      for (const fieldId of hiddenFieldIds) {
        await tx.insert(designHiddenFields).values({ designId: designId!, fieldId });
      }

      await tx.delete(designRequiredFields).where(eq(designRequiredFields.designId, designId!));
      for (const fieldId of requiredFieldIds) {
        await tx.insert(designRequiredFields).values({ designId: designId!, fieldId });
      }

      await tx.delete(designExcludedOptions).where(eq(designExcludedOptions.designId, designId!));
      for (const fieldOptionId of excludedOptionIds) {
        await tx.insert(designExcludedOptions).values({ designId: designId!, fieldOptionId });
      }

      await tx.delete(designCategories).where(eq(designCategories.designId, designId!));
      for (const categoryId of categoryIds) {
        await tx.insert(designCategories).values({ designId: designId!, categoryId });
      }

      await tx.delete(designFieldOrder).where(eq(designFieldOrder.designId, designId!));
      for (let i = 0; i < fieldOrderIds.length; i++) {
        await tx.insert(designFieldOrder).values({ designId: designId!, fieldId: fieldOrderIds[i], sortOrder: i });
      }

      await tx.delete(designOptionPrices).where(eq(designOptionPrices.designId, designId!));
      for (const [fieldOptionIdStr, priceCents] of Object.entries(optionPriceOverrides)) {
        await tx.insert(designOptionPrices).values({ designId: designId!, fieldOptionId: Number(fieldOptionIdStr), priceCents });
      }

      await tx.delete(designFieldPrices).where(eq(designFieldPrices.designId, designId!));
      for (const [fieldIdStr, priceCents] of Object.entries(fieldPriceOverrides)) {
        await tx.insert(designFieldPrices).values({ designId: designId!, fieldId: Number(fieldIdStr), priceCents });
      }

      await tx.delete(designFieldSizePrices).where(eq(designFieldSizePrices.designId, designId!));
      for (const [fieldIdStr, bySize] of Object.entries(perSizeFieldPrices)) {
        for (const [sizeOptionIdStr, priceCents] of Object.entries(bySize)) {
          await tx.insert(designFieldSizePrices).values({
            designId: designId!,
            fieldId: Number(fieldIdStr),
            sizeOptionId: Number(sizeOptionIdStr),
            priceCents,
          });
        }
      }

      await tx.delete(designOptionSizePrices).where(eq(designOptionSizePrices.designId, designId!));
      for (const [fieldOptionIdStr, bySize] of Object.entries(optionSizePrices)) {
        for (const [sizeOptionIdStr, priceCents] of Object.entries(bySize)) {
          await tx.insert(designOptionSizePrices).values({
            designId: designId!,
            fieldOptionId: Number(fieldOptionIdStr),
            sizeOptionId: Number(sizeOptionIdStr),
            priceCents,
          });
        }
      }
    });

    // a portfolio photo only ever seeds a brand-new design — an existing design's
    // photos are managed entirely through its own Photos section below
    if (isCreate && parsed.portfolioPhotoId) {
      const sourcePhoto = await db
        .select()
        .from(portfolioPhotos)
        .where(eq(portfolioPhotos.id, parsed.portfolioPhotoId))
        .then((r) => r[0]);
      if (sourcePhoto) {
        await db.insert(designPhotos).values({ designId: designId!, path: sourcePhoto.path, isPrimary: true });
        await db.delete(portfolioPhotos).where(eq(portfolioPhotos.id, sourcePhoto.id));
      }
    }

    const photoFiles = formData
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);

    for (const file of photoFiles) {
      const relPath = await saveUploadedPhoto(file);
      await db.insert(designPhotos).values({ designId: designId!, path: relPath });
    }

    revalidatePath("/admin/designs");
    revalidatePath("/admin/portfolio");
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
  await requireAdmin();
  const parsed = deletePhotoSchema.parse(Object.fromEntries(formData));
  const photo = await db.select().from(designPhotos).where(eq(designPhotos.id, parsed.id)).then((r) => r[0]);
  if (photo) {
    await deleteUploadedPhoto(photo.path);
    await db.delete(designPhotos).where(eq(designPhotos.id, parsed.id));
  }
  revalidatePath(`/admin/designs/${parsed.designId}/edit`);
}

export async function setPrimaryPhoto(formData: FormData) {
  await requireAdmin();
  const parsed = deletePhotoSchema.parse(Object.fromEntries(formData));
  await db.transaction(async (tx) => {
    await tx.update(designPhotos).set({ isPrimary: false }).where(eq(designPhotos.designId, parsed.designId));
    await tx.update(designPhotos).set({ isPrimary: true }).where(eq(designPhotos.id, parsed.id));
  });
  revalidatePath(`/admin/designs/${parsed.designId}/edit`);
}

const togglePublishedSchema = z.object({
  id: z.coerce.number().int(),
  published: z.coerce.number(),
});

export async function setDesignPublished(formData: FormData) {
  await requireAdmin();
  const parsed = togglePublishedSchema.parse(Object.fromEntries(formData));
  await db.update(designs)
    .set({ published: Boolean(parsed.published), updatedAt: Date.now() })
    .where(eq(designs.id, parsed.id))
    ;
  revalidatePath("/admin/designs");
}

const toggleFeaturedSchema = z.object({
  id: z.coerce.number().int(),
  featured: z.coerce.number(),
});

/** Admin's pick of which designs show in the homepage hero carousel — see
 *  loadFeaturedDesigns in db/queries.ts, the single place that reads it back. */
export async function setDesignFeatured(formData: FormData) {
  await requireAdmin();
  const parsed = toggleFeaturedSchema.parse(Object.fromEntries(formData));
  await db.update(designs)
    .set({ featured: Boolean(parsed.featured), updatedAt: Date.now() })
    .where(eq(designs.id, parsed.id))
    ;
  revalidatePath("/admin/designs");
  revalidatePath("/");
}
