import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "../../../../../../db";
import { catalogItems, designPhotos, designRecipeItems, designs } from "../../../../../../db/schema";
import { type Axis } from "../../../../../../lib/axes";
import DesignForm from "../../../../../../components/admin/DesignForm";

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

  const [items, recipeRows, photos] = await Promise.all([
    db.select().from(catalogItems).then((r) => r),
    db.select().from(designRecipeItems).where(eq(designRecipeItems.designId, designId)).then((r) => r),
    db
      .select()
      .from(designPhotos)
      .where(eq(designPhotos.designId, designId))
      .then((r) => r),
  ]);

  const recipe = Object.fromEntries(
    recipeRows.map((r) => [r.axis as Axis, r.catalogItemId])
  ) as Partial<Record<Axis, number>>;

  return (
    <>
      <h1>Edit Design</h1>
      <p className="admin-main__subtitle">{design.name}</p>
      {error === "constraint" && (
        <div className="admin-error-banner">
          This recipe combines two items marked incompatible in Constraints — fix the recipe or
          remove that constraint first.
        </div>
      )}
      <DesignForm
        items={items}
        design={{
          id: design.id,
          name: design.name,
          description: design.description,
          chargedPriceCents: design.chargedPriceCents,
          published: design.published,
          recipe,
          photos: photos.map((p) => ({ id: p.id, path: p.path, isPrimary: p.isPrimary })),
        }}
      />
    </>
  );
}
