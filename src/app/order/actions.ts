"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import {
  constraintPairs,
  designExcludedOptions,
  designFieldValues,
  designLockedFields,
  designs,
  fieldOptions,
  fields,
  orderReferenceImages,
  orderSelections,
  orders,
  tierPresets as tierPresetsTable,
  tierPresetLevels,
} from "../../db/schema";
import { loadPickupAvailability } from "../../db/queries";
import { selectionsViolateConstraints } from "../../lib/constraints";
import { buildCakeStyleContext } from "../../lib/cakeStyle";
import { computeTotalCents, type Answers } from "../../lib/pricing";
import { isSlotAvailable } from "../../lib/availability";
import { CONTACT_PREFERENCES, isCakeStyleKind, isFieldType, isTierLevelCount, type FieldType } from "../../lib/fields";
import { saveUploadedPhoto } from "../../lib/uploads";
import type { FieldDTO, FieldOptionDTO, TierPresetDTO } from "../../lib/order-types";

const submitSchema = z.object({
  designId: z.string().trim().optional(),
  pickupDate: z.string().optional(),
  pickupTime: z.string().optional(),
  contactPreference: z.enum(CONTACT_PREFERENCES).optional(),
  customerName: z.string().trim().min(1, "Name is required"),
  customerEmail: z.string().trim().email("Enter a valid email"),
  customerPhone: z.string().trim().optional(),
  comments: z.string().trim().optional(),
});

/** Result shape for useActionState in OrderSummaryPanel — a thrown error inside
 *  a form action has no friendly on-page presentation (Next.js falls back to
 *  its generic error page, dropping every answer the customer picked), so
 *  every validation failure here is returned instead, letting the review step
 *  show it next to Submit and keep the customer's answers intact. */
export type SubmitOrderState = { error: string } | undefined;

export async function submitOrder(
  _prevState: SubmitOrderState,
  formData: FormData
): Promise<SubmitOrderState> {
  const rawParsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!rawParsed.success) {
    return { error: rawParsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const parsed = rawParsed.data;

  // no designId means this is a custom-cake quote request, not a catalog order
  const isCustomOrder = !parsed.designId;
  const designId = isCustomOrder ? null : Number(parsed.designId);
  if (!isCustomOrder && !Number.isInteger(designId)) {
    return { error: "Invalid design." };
  }

  if (!parsed.contactPreference) {
    return { error: "Choose how you'd like us to reach you." };
  }

  let design: typeof designs.$inferSelect | undefined;
  if (!isCustomOrder) {
    design = db.select().from(designs).where(eq(designs.id, designId!)).get();
    if (!design || !design.published) {
      return { error: "This design is no longer available." };
    }
  }

  // never trust a client-computed slot — re-validate against current admin
  // config in case availability changed since the wizard loaded. Pickup is
  // required for catalog orders; for a custom-cake quote it's just a rough
  // preference, so an empty pickup is fine.
  const hasPickupDate = !!parsed.pickupDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.pickupDate);
  const hasPickupTime = !!parsed.pickupTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.pickupTime);
  if (!isCustomOrder && !hasPickupDate) return { error: "Choose a pickup date" };
  if (!isCustomOrder && !hasPickupTime) return { error: "Choose a pickup time" };

  let pickupDate: string | null = null;
  let pickupTime: string | null = null;
  if (hasPickupDate && hasPickupTime) {
    const { settings, weeklyHours, overrides, orderCountsByDate } = await loadPickupAvailability();
    if (
      !isSlotAvailable(
        parsed.pickupDate!,
        parsed.pickupTime!,
        weeklyHours,
        overrides,
        settings,
        new Date(),
        orderCountsByDate
      )
    ) {
      return { error: "That pickup time is no longer available — please go back and choose another." };
    }
    pickupDate = parsed.pickupDate!;
    pickupTime = parsed.pickupTime!;
  }

  const allFields = db.select().from(fields).where(eq(fields.active, true)).all();
  const allOptions = db.select().from(fieldOptions).where(eq(fieldOptions.active, true)).all();
  const optionById = new Map(allOptions.map((o) => [o.id, o]));

  const allTierPresetRows = db.select().from(tierPresetsTable).all();
  const allTierPresetLevelRows = db.select().from(tierPresetLevels).all();
  const tierPresetDTOs: TierPresetDTO[] = allTierPresetRows.map((preset) => ({
    fieldOptionId: preset.fieldOptionId,
    levelCount: preset.levelCount,
    levels: allTierPresetLevelRows
      .filter((lvl) => lvl.tierPresetId === preset.id)
      .sort((a, b) => a.position - b.position)
      .map((lvl) => {
        const mold = optionById.get(lvl.moldOptionId);
        return {
          position: lvl.position,
          moldOptionId: lvl.moldOptionId,
          moldName: mold?.name ?? "Unknown",
          diameterIn: null,
          shape: null,
          servesMin: null,
          servesMax: null,
        };
      }),
  }));
  const presetsByOptionId = new Map(tierPresetDTOs.map((p) => [p.fieldOptionId, p]));

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
  const fieldById = new Map(allFields.map((f) => [f.id, f]));
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

  const designAnswers: Answers = {};
  const includedFieldIds = new Set<number>();
  if (!isCustomOrder) {
    const designFieldValueRows = db
      .select()
      .from(designFieldValues)
      .where(eq(designFieldValues.designId, design!.id))
      .all();
    for (const row of designFieldValueRows) {
      includedFieldIds.add(row.fieldId);
      if (row.fieldOptionId != null) {
        const existing = designAnswers[row.fieldId];
        if (existing?.type === "options") existing.optionIds.push(row.fieldOptionId);
        else designAnswers[row.fieldId] = { type: "options", optionIds: [row.fieldOptionId] };
      } else if (row.textValue != null) {
        designAnswers[row.fieldId] = { type: "text", value: row.textValue };
      } else if (row.numberValue != null) {
        designAnswers[row.fieldId] = { type: "number", value: row.numberValue };
      }
    }
  }

  // the design's actual fields: every base field, plus whichever custom
  // fields it included (with or without a default answer). A custom-cake
  // quote has no catalog design, so this is just the base fields.
  const designFields = allFields.filter((f) => f.isBase || includedFieldIds.has(f.id));

  const lockedFieldIds = new Set(
    isCustomOrder
      ? []
      : db
          .select()
          .from(designLockedFields)
          .where(eq(designLockedFields.designId, design!.id))
          .all()
          .map((r) => r.fieldId)
  );

  const excludedOptionIds = new Set(
    isCustomOrder
      ? []
      : db
          .select()
          .from(designExcludedOptions)
          .where(eq(designExcludedOptions.designId, design!.id))
          .all()
          .map((r) => r.fieldOptionId)
  );

  // re-parse each field's answer straight from formData — never trust a
  // client-computed shape; locked fields always fall back to the design's own default
  const answers: Answers = {};
  for (const field of designFields) {
    if (lockedFieldIds.has(field.id)) {
      const defaultAnswer = designAnswers[field.id];
      if (defaultAnswer) answers[field.id] = defaultAnswer;
      continue;
    }

    if (field.type === "single_select" || field.type === "multi_select") {
      const ids = formData
        .getAll(`options_${field.id}`)
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n));
      if (field.type === "single_select" && ids.length > 1) {
        return { error: `Invalid selection for ${field.name}.` };
      }
      for (const id of ids) {
        const option = optionById.get(id);
        if (!option || option.fieldId !== field.id) return { error: `Invalid selection for ${field.name}.` };
        if (excludedOptionIds.has(id)) {
          return { error: "One of your selections isn't available for this design." };
        }
      }
      if (ids.length > 0) answers[field.id] = { type: "options", optionIds: ids };
    } else if (field.type === "text") {
      const value = String(formData.get(`text_${field.id}`) ?? "").trim();
      if (value) answers[field.id] = { type: "text", value };
    } else if (field.type === "number") {
      const raw = formData.get(`number_${field.id}`);
      if (raw != null && raw !== "") answers[field.id] = { type: "number", value: Number(raw) };
    }
  }

  if (!isCustomOrder) {
    for (const field of designFields) {
      const requiresAnswer =
        field.type === "single_select" || ((field.type === "text" || field.type === "number") && field.required);
      if (!requiresAnswer) continue;
      if (!answers[field.id]) return { error: `${field.name} is required.` };
    }

    // the submitted `size` option must belong to the submitted cake_style
    if (cakeStyleCtx) {
      const styleAnswer = answers[cakeStyleCtx.styleFieldId];
      const styleOptionId = styleAnswer?.type === "options" ? styleAnswer.optionIds[0] : undefined;
      const styleKind = styleOptionId != null ? cakeStyleCtx.styleKindByOptionId.get(styleOptionId) : undefined;

      const sizeAnswer = answers[cakeStyleCtx.sizeFieldId];
      const sizeOptionId = sizeAnswer?.type === "options" ? sizeAnswer.optionIds[0] : undefined;
      const sizeOptionStyle = sizeOptionId != null ? cakeStyleCtx.styleKindByOptionId.get(sizeOptionId) : undefined;
      if (sizeOptionId != null && sizeOptionStyle !== styleKind) {
        return { error: "Size doesn't match the selected Cake Style — please go back and re-check." };
      }
    }
  }

  const pairs = db.select().from(constraintPairs).all();
  if (selectionsViolateConstraints(answers, pairs)) {
    return { error: "This combination is not allowed — please go back and adjust your selections." };
  }

  // total is recomputed here — never trust a client-sent price
  const flatOptions = allOptions.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
  const flatFields = allFields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }));
  const totalPriceCents = computeTotalCents(answers, design?.premiumCents ?? 0, flatOptions, flatFields);

  const orderId = db.transaction((tx) => {
    const inserted = tx
      .insert(orders)
      .values({
        designId: isCustomOrder ? null : design!.id,
        contactPreference: parsed.contactPreference,
        customerName: parsed.customerName,
        customerEmail: parsed.customerEmail,
        customerPhone: parsed.customerPhone || null,
        comments: parsed.comments || null,
        totalPriceCents,
        status: "new",
        pickupDate,
        pickupTime,
      })
      .returning({ id: orders.id })
      .get();

    for (const [fieldIdStr, answer] of Object.entries(answers)) {
      const fieldId = Number(fieldIdStr);
      if (answer.type === "options") {
        for (const optionId of answer.optionIds) {
          const option = optionById.get(optionId)!;
          const preset = presetsByOptionId.get(optionId);
          const labelSnapshot =
            preset && preset.levels.length > 0
              ? `${option.name} (${preset.levels.map((l) => l.moldName).join(" → ")})`
              : option.name;
          tx.insert(orderSelections)
            .values({
              orderId: inserted.id,
              fieldId,
              fieldOptionId: optionId,
              labelSnapshot,
              priceCentsSnapshot: option.priceCents,
            })
            .run();
        }
      } else if (answer.type === "text") {
        tx.insert(orderSelections)
          .values({
            orderId: inserted.id,
            fieldId,
            textValue: answer.value,
            labelSnapshot: answer.value,
            priceCentsSnapshot: fieldById.get(fieldId)?.additionalPriceCents ?? 0,
          })
          .run();
      } else {
        tx.insert(orderSelections)
          .values({
            orderId: inserted.id,
            fieldId,
            numberValue: answer.value,
            labelSnapshot: String(answer.value),
            priceCentsSnapshot: fieldById.get(fieldId)?.additionalPriceCents ?? 0,
          })
          .run();
      }
    }

    return inserted.id;
  });

  if (isCustomOrder) {
    const referenceImageFiles = formData
      .getAll("referenceImages")
      .filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of referenceImageFiles) {
      const relPath = await saveUploadedPhoto(file);
      db.insert(orderReferenceImages).values({ orderId, path: relPath }).run();
    }
  }

  redirect(`/order/thank-you?id=${orderId}`);
}
