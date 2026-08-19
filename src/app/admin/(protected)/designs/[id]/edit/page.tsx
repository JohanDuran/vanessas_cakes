import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "../../../../../../db";
import {
  designExcludedOptions,
  designFieldValues,
  designLockedFields,
  designPhotos,
  designs,
  fieldOptions,
  fields,
} from "../../../../../../db/schema";
import { baseFieldRank, isFieldType, type FieldType } from "../../../../../../lib/fields";
import type { Answers } from "../../../../../../lib/pricing";
import DesignForm, { type FieldSummary } from "../../../../../../components/admin/DesignForm";

export const dynamic = "force-dynamic";

export default async function EditDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const designId = Number(id);
  if (!Number.isInteger(designId)) notFound();

  const design = db.select().from(designs).where(eq(designs.id, designId)).get();
  if (!design) notFound();

  const [allFields, allOptions, photos, fieldValueRows, lockedRows, excludedRows] = await Promise.all([
    db.select().from(fields).then((r) => r),
    db.select().from(fieldOptions).then((r) => r),
    db.select().from(designPhotos).where(eq(designPhotos.designId, designId)).then((r) => r),
    db.select().from(designFieldValues).where(eq(designFieldValues.designId, designId)).then((r) => r),
    db.select().from(designLockedFields).where(eq(designLockedFields.designId, designId)).then((r) => r),
    db.select().from(designExcludedOptions).where(eq(designExcludedOptions.designId, designId)).then((r) => r),
  ]);

  const optionsByField = new Map<number, typeof allOptions>();
  for (const opt of allOptions) {
    const list = optionsByField.get(opt.fieldId) ?? [];
    list.push(opt);
    optionsByField.set(opt.fieldId, list);
  }

  const fieldSummaries: FieldSummary[] = allFields
    .filter((f) => isFieldType(f.type))
    .sort(
      (a, b) =>
        baseFieldRank(a.slug) - baseFieldRank(b.slug) ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name)
    )
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      type: f.type as FieldType,
      isBase: f.isBase,
      active: f.active,
      options: (optionsByField.get(f.id) ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        priceCents: o.priceCents,
        active: o.active,
      })),
    }));

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

  return (
    <>
      <h1>Edit Design</h1>
      <p className="admin-main__subtitle">{design.name}</p>
      {error === "constraint" && (
        <div className="admin-error-banner">
          This recipe combines two options marked incompatible in Constraints — fix it or remove
          that constraint first.
        </div>
      )}
      <DesignForm
        fields={fieldSummaries}
        design={{
          id: design.id,
          name: design.name,
          description: design.description,
          chargedPriceCents: design.chargedPriceCents,
          published: design.published,
          fieldValues,
          lockedFieldIds: lockedRows.map((r) => r.fieldId),
          excludedOptionIds: excludedRows.map((r) => r.fieldOptionId),
          photos: photos.map((p) => ({ id: p.id, path: p.path, isPrimary: p.isPrimary })),
        }}
      />
    </>
  );
}
