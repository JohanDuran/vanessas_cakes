import { eq } from "drizzle-orm";
import { db } from "../../../../../db";
import { fieldOptions, fields } from "../../../../../db/schema";
import { baseFieldRank, isFieldType, type FieldType } from "../../../../../lib/fields";
import DesignForm, { type FieldSummary } from "../../../../../components/admin/DesignForm";

export const dynamic = "force-dynamic";

export default async function NewDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [allFields, allOptions] = await Promise.all([
    db.select().from(fields).where(eq(fields.active, true)).then((r) => r),
    db.select().from(fieldOptions).where(eq(fieldOptions.active, true)).then((r) => r),
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

  return (
    <>
      <h1>New Design</h1>
      <p className="admin-main__subtitle">
        Fill in every field&apos;s default value, then set what was actually charged.
      </p>
      {error === "constraint" && (
        <div className="admin-error-banner">
          This recipe combines two options marked incompatible in Constraints — fix it or remove
          that constraint first.
        </div>
      )}
      <DesignForm fields={fieldSummaries} />
    </>
  );
}
