import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "../../../../../../db";
import {
  cakeCategories,
  constraintPairs,
  designCategories,
  designExcludedOptions,
  designFieldOrder,
  designFieldPrices,
  designFieldSizePrices,
  designFieldValues,
  designHiddenFields,
  designLockedFields,
  designOptionPrices,
  designOptionSizePrices,
  designPhotos,
  designRequiredFields,
  designs,
  fieldOptionDimensions,
  fieldOptions,
  fields,
  tierPresets,
  tierPresetLevels,
} from "../../../../../../db/schema";
import { baseFieldRank, isCakeStyleKind, isDesignKind, isFieldType, isTierLevelCount, type FieldType } from "../../../../../../lib/fields";
import { buildDesignPriceOverrides, type Answers } from "../../../../../../lib/pricing";
import DesignForm, { type FieldSummary } from "../../../../../../components/admin/DesignForm";
import { buildTierPresetSummaries } from "../../tierPresetSummary";

export const dynamic = "force-dynamic";

export default async function EditDesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const designId = Number(id);
  if (!Number.isInteger(designId)) notFound();

  const design = await db.select().from(designs).where(eq(designs.id, designId)).then((r) => r[0]);
  if (!design) notFound();

  const [
    allFields,
    allOptions,
    photos,
    fieldValueRows,
    lockedRows,
    excludedRows,
    allTierPresetRows,
    allTierPresetLevelRows,
    categories,
    designCategoryRows,
    pairs,
    optionPriceRows,
    fieldPriceRows,
    sizePriceRows,
    optionSizePriceRows,
    hiddenRows,
    requiredRows,
    fieldOrderRows,
    allDimensionRows,
  ] = await Promise.all([
    db.select().from(fields).then((r) => r),
    db.select().from(fieldOptions).then((r) => r),
    db.select().from(designPhotos).where(eq(designPhotos.designId, designId)).then((r) => r),
    db.select().from(designFieldValues).where(eq(designFieldValues.designId, designId)).then((r) => r),
    db.select().from(designLockedFields).where(eq(designLockedFields.designId, designId)).then((r) => r),
    db.select().from(designExcludedOptions).where(eq(designExcludedOptions.designId, designId)).then((r) => r),
    db.select().from(tierPresets).then((r) => r),
    db.select().from(tierPresetLevels).then((r) => r),
    db
      .select()
      .from(cakeCategories)
      .where(eq(cakeCategories.active, true))
      .orderBy(asc(cakeCategories.sortOrder), asc(cakeCategories.name))
      .then((r) => r),
    db.select().from(designCategories).where(eq(designCategories.designId, designId)).then((r) => r),
    db.select().from(constraintPairs).then((r) => r),
    db.select().from(designOptionPrices).where(eq(designOptionPrices.designId, designId)).then((r) => r),
    db.select().from(designFieldPrices).where(eq(designFieldPrices.designId, designId)).then((r) => r),
    db.select().from(designFieldSizePrices).where(eq(designFieldSizePrices.designId, designId)).then((r) => r),
    db.select().from(designOptionSizePrices).where(eq(designOptionSizePrices.designId, designId)).then((r) => r),
    db.select().from(designHiddenFields).where(eq(designHiddenFields.designId, designId)).then((r) => r),
    db.select().from(designRequiredFields).where(eq(designRequiredFields.designId, designId)).then((r) => r),
    db.select().from(designFieldOrder).where(eq(designFieldOrder.designId, designId)).then((r) => r),
    db.select().from(fieldOptionDimensions).then((r) => r),
  ]);

  const priceOverrides = buildDesignPriceOverrides(
    designId,
    optionPriceRows,
    fieldPriceRows,
    sizePriceRows,
    optionSizePriceRows
  );

  const optionsByField = new Map<number, typeof allOptions>();
  for (const opt of allOptions) {
    const list = optionsByField.get(opt.fieldId) ?? [];
    list.push(opt);
    optionsByField.set(opt.fieldId, list);
  }

  const dimsByOptionId = new Map(allDimensionRows.map((d) => [d.fieldOptionId, d]));

  // this design's own field order, if it's ever been saved through the
  // admin's field reorder (see DesignForm) — fields with no row here (never
  // reordered, or added since) fall back to the canonical catalog order below
  const fieldOrderById = new Map(fieldOrderRows.map((r) => [r.fieldId, r.sortOrder]));

  const fieldSummaries: FieldSummary[] = allFields
    .filter((f) => isFieldType(f.type))
    .sort((a, b) => {
      const oa = fieldOrderById.get(a.id);
      const ob = fieldOrderById.get(b.id);
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return (
        baseFieldRank(a.slug) - baseFieldRank(b.slug) ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name)
      );
    })
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      type: f.type as FieldType,
      isBase: f.isBase,
      active: f.active,
      additionalPriceCents: f.additionalPriceCents,
      options: (optionsByField.get(f.id) ?? []).map((o) => {
        const dims = dimsByOptionId.get(o.id);
        return {
          id: o.id,
          name: o.name,
          priceCents: o.priceCents,
          active: o.active,
          styleKind: o.styleKind != null && isCakeStyleKind(o.styleKind) ? o.styleKind : null,
          tierLevelCount: o.tierLevelCount != null && isTierLevelCount(o.tierLevelCount) ? o.tierLevelCount : null,
          dimensions: dims
            ? {
                diameterIn: dims.diameterIn,
                widthIn: dims.widthIn,
                lengthIn: dims.lengthIn,
                shape: dims.shape,
                tiers: dims.tiers,
                servesMin: dims.servesMin,
                servesMax: dims.servesMax,
              }
            : null,
        };
      }),
    }));

  const tierPresetSummaries = buildTierPresetSummaries(allOptions, allTierPresetRows, allTierPresetLevelRows);

  const fieldValues: Answers = {};
  for (const row of fieldValueRows) {
    if (row.fieldOptionId != null) {
      const existing = fieldValues[row.fieldId];
      if (existing?.type === "options") existing.optionIds.push(row.fieldOptionId);
      else fieldValues[row.fieldId] = { type: "options", optionIds: [row.fieldOptionId] };
    } else if (row.textValue != null) {
      fieldValues[row.fieldId] = { type: "text", value: row.textValue };
    } else if (row.numberValue != null) {
      fieldValues[row.fieldId] = { type: "number", value: row.numberValue };
    }
  }

  // inclusion is having ANY row here, value or not — distinct from fieldValues
  // above, since a custom field can be included with no default answer
  const includedFieldIds = Array.from(new Set(fieldValueRows.map((r) => r.fieldId)));

  return (
    <>
      <h1>Edit Design</h1>
      <p className="admin-main__subtitle">{design.name}</p>
      <DesignForm
        fields={fieldSummaries}
        tierPresets={tierPresetSummaries}
        categories={categories}
        constraintPairs={pairs.map((p) => ({ optionAId: p.optionAId, optionBId: p.optionBId }))}
        design={{
          id: design.id,
          name: design.name,
          description: design.description,
          kind: isDesignKind(design.kind) ? design.kind : "catalog",
          published: design.published,
          fieldValues,
          lockedFieldIds: lockedRows.map((r) => r.fieldId),
          hiddenFieldIds: hiddenRows.map((r) => r.fieldId),
          requiredFieldIds: requiredRows.map((r) => r.fieldId),
          excludedOptionIds: excludedRows.map((r) => r.fieldOptionId),
          categoryIds: designCategoryRows.map((r) => r.categoryId),
          includedFieldIds,
          photos: photos.map((p) => ({ id: p.id, path: p.path, isPrimary: p.isPrimary })),
          optionPriceOverrides: priceOverrides.optionPriceOverrides,
          fieldPriceOverrides: priceOverrides.fieldPriceOverrides,
          perSizeFieldPrices: priceOverrides.perSizeFieldPrices,
          optionSizePrices: priceOverrides.optionSizePrices,
        }}
      />
    </>
  );
}
