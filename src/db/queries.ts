import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import {
  fields,
  fieldOptions,
  fieldOptionDimensions,
  designExcludedOptions,
  designLockedFields,
  designPhotos,
  designFieldValues,
  designs,
  constraintPairs,
} from "./schema";
import { baseFieldRank, isFieldType, type FieldType } from "../lib/fields";
import type { Answers } from "../lib/pricing";
import type { DesignSummaryDTO, FieldDTO, FieldOptionDTO } from "../lib/order-types";

/** Everything the customer-facing order flow (wizard + gallery) needs:
 *  active fields + options (base and custom, unified), published designs
 *  (with their default answers, locks, and exclusions), and constraint pairs. */
export async function loadOrderData() {
  const [
    allFields,
    allOptions,
    allDimensionRows,
    publishedDesigns,
    allPhotos,
    allFieldValueRows,
    pairs,
    allLockedRows,
    allExcludedRows,
  ] = await Promise.all([
    db.select().from(fields).where(eq(fields.active, true)).then((r) => r),
    db.select().from(fieldOptions).where(eq(fieldOptions.active, true)).then((r) => r),
    db.select().from(fieldOptionDimensions).then((r) => r),
    db.select().from(designs).where(eq(designs.published, true)).then((r) => r),
    db
      .select()
      .from(designPhotos)
      .orderBy(asc(designPhotos.sortOrder))
      .then((r) => r),
    db.select().from(designFieldValues).then((r) => r),
    db.select().from(constraintPairs).then((r) => r),
    db.select().from(designLockedFields).then((r) => r),
    db.select().from(designExcludedOptions).then((r) => r),
  ]);

  const fieldSummaries: FieldDTO[] = allFields
    .filter((f) => isFieldType(f.type))
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      type: f.type as FieldType,
      isBase: f.isBase,
      sortOrder: f.sortOrder,
      hasShapeDiagram: f.hasShapeDiagram,
    }))
    .sort((a, b) => {
      const rankDiff = baseFieldRank(a.slug) - baseFieldRank(b.slug);
      if (rankDiff !== 0) return rankDiff;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });

  const dimsByOptionId = new Map(allDimensionRows.map((d) => [d.fieldOptionId, d]));

  const optionSummaries: FieldOptionDTO[] = allOptions.map((o) => {
    const d = dimsByOptionId.get(o.id);
    return {
      id: o.id,
      fieldId: o.fieldId,
      name: o.name,
      priceCents: o.priceCents,
      dimensions: d
        ? { diameterIn: d.diameterIn, shape: d.shape, tiers: d.tiers, servesMin: d.servesMin, servesMax: d.servesMax }
        : null,
    };
  });

  const photosByDesign = new Map<number, string[]>();
  for (const photo of allPhotos) {
    const list = photosByDesign.get(photo.designId) ?? [];
    if (photo.isPrimary) list.unshift(photo.path);
    else list.push(photo.path);
    photosByDesign.set(photo.designId, list);
  }

  const fieldValuesByDesign = new Map<number, Answers>();
  for (const row of allFieldValueRows) {
    const answers = fieldValuesByDesign.get(row.designId) ?? {};
    if (row.fieldOptionId != null) {
      const existing = answers[row.fieldId];
      if (existing?.type === "options") existing.optionIds.push(row.fieldOptionId);
      else answers[row.fieldId] = { type: "options", optionIds: [row.fieldOptionId] };
    } else if (row.textValue != null) {
      answers[row.fieldId] = { type: "text", value: row.textValue };
    } else if (row.numberValue != null) {
      answers[row.fieldId] = { type: "number", value: row.numberValue };
    }
    fieldValuesByDesign.set(row.designId, answers);
  }

  const lockedByDesign = new Map<number, number[]>();
  for (const row of allLockedRows) {
    const list = lockedByDesign.get(row.designId) ?? [];
    list.push(row.fieldId);
    lockedByDesign.set(row.designId, list);
  }

  const excludedByDesign = new Map<number, number[]>();
  for (const row of allExcludedRows) {
    const list = excludedByDesign.get(row.designId) ?? [];
    list.push(row.fieldOptionId);
    excludedByDesign.set(row.designId, list);
  }

  const designSummaries: DesignSummaryDTO[] = publishedDesigns.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    chargedPriceCents: d.chargedPriceCents,
    premiumCents: d.premiumCents,
    photos: photosByDesign.get(d.id) ?? [],
    fieldValues: fieldValuesByDesign.get(d.id) ?? {},
    lockedFieldIds: lockedByDesign.get(d.id) ?? [],
    excludedOptionIds: excludedByDesign.get(d.id) ?? [],
  }));

  const constraintPairsDTO = pairs.map((p) => ({ optionAId: p.optionAId, optionBId: p.optionBId }));

  return { fields: fieldSummaries, options: optionSummaries, designSummaries, constraintPairsDTO };
}
