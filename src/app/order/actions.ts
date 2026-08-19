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
  orderSelections,
  orders,
} from "../../db/schema";
import { selectionsViolateConstraints } from "../../lib/constraints";
import { computeTotalCents, type Answers } from "../../lib/pricing";

const submitSchema = z.object({
  designId: z.coerce.number().int(),
  customerName: z.string().trim().min(1, "Name is required"),
  customerEmail: z.string().trim().email("Enter a valid email"),
  customerPhone: z.string().trim().optional(),
  comments: z.string().trim().optional(),
});

export async function submitOrder(formData: FormData) {
  const parsed = submitSchema.parse(Object.fromEntries(formData));

  const design = db.select().from(designs).where(eq(designs.id, parsed.designId)).get();
  if (!design || !design.published) {
    throw new Error("This design is no longer available.");
  }

  const allFields = db.select().from(fields).where(eq(fields.active, true)).all();
  const allOptions = db.select().from(fieldOptions).where(eq(fieldOptions.active, true)).all();
  const optionById = new Map(allOptions.map((o) => [o.id, o]));

  const designFieldValueRows = db
    .select()
    .from(designFieldValues)
    .where(eq(designFieldValues.designId, design.id))
    .all();
  const designAnswers: Answers = {};
  for (const row of designFieldValueRows) {
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

  // the design's actual fields: every base field, plus whichever custom
  // fields it included (inclusion is having a default answer for it)
  const designFields = allFields.filter((f) => f.isBase || designAnswers[f.id] != null);

  const lockedRows = db
    .select()
    .from(designLockedFields)
    .where(eq(designLockedFields.designId, design.id))
    .all();
  const lockedFieldIds = new Set(lockedRows.map((r) => r.fieldId));

  const excludedRows = db
    .select()
    .from(designExcludedOptions)
    .where(eq(designExcludedOptions.designId, design.id))
    .all();
  const excludedOptionIds = new Set(excludedRows.map((r) => r.fieldOptionId));

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
      if (field.type === "single_select" && ids.length !== 1) {
        throw new Error(`Invalid selection for ${field.name}.`);
      }
      for (const id of ids) {
        const option = optionById.get(id);
        if (!option || option.fieldId !== field.id) throw new Error(`Invalid selection for ${field.name}.`);
        if (excludedOptionIds.has(id)) {
          throw new Error("One of your selections isn't available for this design.");
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

  for (const field of designFields) {
    if (field.type === "single_select" && !answers[field.id]) {
      throw new Error(`${field.name} is required.`);
    }
  }

  const pairs = db.select().from(constraintPairs).all();
  if (selectionsViolateConstraints(answers, pairs)) {
    throw new Error("This combination is not allowed — please go back and adjust your selections.");
  }

  // total is recomputed here — never trust a client-sent price
  const flatOptions = allOptions.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
  const totalPriceCents = computeTotalCents(answers, design.premiumCents, flatOptions);

  const orderId = db.transaction((tx) => {
    const inserted = tx
      .insert(orders)
      .values({
        designId: design.id,
        customerName: parsed.customerName,
        customerEmail: parsed.customerEmail,
        customerPhone: parsed.customerPhone || null,
        comments: parsed.comments || null,
        totalPriceCents,
        status: "new",
      })
      .returning({ id: orders.id })
      .get();

    for (const [fieldIdStr, answer] of Object.entries(answers)) {
      const fieldId = Number(fieldIdStr);
      if (answer.type === "options") {
        for (const optionId of answer.optionIds) {
          const option = optionById.get(optionId)!;
          tx.insert(orderSelections)
            .values({
              orderId: inserted.id,
              fieldId,
              fieldOptionId: optionId,
              labelSnapshot: option.name,
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
            priceCentsSnapshot: 0,
          })
          .run();
      } else {
        tx.insert(orderSelections)
          .values({
            orderId: inserted.id,
            fieldId,
            numberValue: answer.value,
            labelSnapshot: String(answer.value),
            priceCentsSnapshot: 0,
          })
          .run();
      }
    }

    return inserted.id;
  });

  redirect(`/order/thank-you?id=${orderId}`);
}
