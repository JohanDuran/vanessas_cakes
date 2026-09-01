import { asc, eq } from "drizzle-orm";
import { db } from "../../../../../db";
import { cakeCategories, constraintPairs, fieldOptions, fields, portfolioPhotos, tierPresets, tierPresetLevels } from "../../../../../db/schema";
import { baseFieldRank, isCakeStyleKind, isFieldType, isTierLevelCount, type FieldType } from "../../../../../lib/fields";
import DesignForm, { type FieldSummary } from "../../../../../components/admin/DesignForm";
import { buildTierPresetSummaries } from "../tierPresetSummary";

export const dynamic = "force-dynamic";

export default async function NewDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ portfolioPhotoId?: string }>;
}) {
  const { portfolioPhotoId } = await searchParams;
  const [allFields, allOptions, allTierPresetRows, allTierPresetLevelRows, categories, pairs] = await Promise.all([
    db.select().from(fields).where(eq(fields.active, true)).then((r) => r),
    db.select().from(fieldOptions).where(eq(fieldOptions.active, true)).then((r) => r),
    db.select().from(tierPresets).then((r) => r),
    db.select().from(tierPresetLevels).then((r) => r),
    db
      .select()
      .from(cakeCategories)
      .where(eq(cakeCategories.active, true))
      .orderBy(asc(cakeCategories.sortOrder), asc(cakeCategories.name))
      .then((r) => r),
    db.select().from(constraintPairs).then((r) => r),
  ]);

  // stale id (already configured or deleted) just falls back to a normal blank form
  const id = portfolioPhotoId ? Number(portfolioPhotoId) : NaN;
  const sourcePhoto = Number.isInteger(id)
    ? await db.select().from(portfolioPhotos).where(eq(portfolioPhotos.id, id)).then((r) => r[0])
    : undefined;

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
      showInDesignForm: f.showInDesignForm,
      active: f.active,
      required: f.required,
      additionalPriceCents: f.additionalPriceCents,
      options: (optionsByField.get(f.id) ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        priceCents: o.priceCents,
        active: o.active,
        styleKind: o.styleKind != null && isCakeStyleKind(o.styleKind) ? o.styleKind : null,
        tierLevelCount: o.tierLevelCount != null && isTierLevelCount(o.tierLevelCount) ? o.tierLevelCount : null,
      })),
    }));

  const tierPresetSummaries = buildTierPresetSummaries(allOptions, allTierPresetRows, allTierPresetLevelRows);

  return (
    <>
      <h1>New Design</h1>
      <p className="admin-main__subtitle">
        Fill in every field&apos;s default value, then set what was actually charged.
      </p>
      <DesignForm
        fields={fieldSummaries}
        tierPresets={tierPresetSummaries}
        categories={categories}
        constraintPairs={pairs.map((p) => ({ optionAId: p.optionAId, optionBId: p.optionBId }))}
        portfolioPhoto={sourcePhoto ? { id: sourcePhoto.id, path: sourcePhoto.path } : undefined}
      />
    </>
  );
}
