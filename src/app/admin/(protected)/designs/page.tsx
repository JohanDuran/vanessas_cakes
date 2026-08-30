import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "../../../../db";
import { designPhotos, designs } from "../../../../db/schema";
import { formatCents } from "../../../../lib/pricing";
import { isDesignKind } from "../../../../lib/fields";
import { setDesignFeatured, setDesignPublished } from "./actions";

export const dynamic = "force-dynamic";

export default async function DesignsListPage() {
  const [allDesigns, allPhotos] = await Promise.all([
    db.select().from(designs).orderBy(desc(designs.updatedAt)).then((r) => r),
    db.select().from(designPhotos).then((r) => r),
  ]);

  const primaryPhotoByDesign = new Map<number, string>();
  for (const photo of allPhotos) {
    if (photo.isPrimary || !primaryPhotoByDesign.has(photo.designId)) {
      primaryPhotoByDesign.set(photo.designId, photo.path);
    }
  }

  return (
    <>
      <h1>Designs</h1>
      <p className="admin-main__subtitle">
        Pre-made cakes customers can pick as a starting point for their order. Mark a design
        &quot;Featured&quot; to show it in the homepage carousel.
      </p>

      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/designs/new" className="btn btn-primary">
          + New Design
        </Link>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Charged Price</th>
              <th>Premium</th>
              <th>Status</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allDesigns.map((d) => {
              const photo = primaryPhotoByDesign.get(d.id);
              const kind = isDesignKind(d.kind) ? d.kind : "catalog";
              const isCatalog = kind === "catalog";
              return (
                <tr key={d.id}>
                  <td>
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        width={44}
                        height={44}
                        style={{ objectFit: "cover", borderRadius: 8 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          background: "var(--pink-100)",
                        }}
                      />
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/designs/${d.id}/edit`}>{d.name}</Link>
                    {!isCatalog && <span className="field-type-tag">quote</span>}
                  </td>
                  <td>{isCatalog ? formatCents(d.chargedPriceCents) : "—"}</td>
                  <td>{isCatalog ? formatCents(d.premiumCents) : "—"}</td>
                  <td>{isCatalog ? (d.published ? "Published" : "Draft") : "Always reachable"}</td>
                  <td>
                    {isCatalog && (
                      <form action={setDesignPublished}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="published" value={d.published ? 0 : 1} />
                        <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                          {d.published ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}
                  </td>
                  <td>
                    {isCatalog && (
                      <form action={setDesignFeatured}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="featured" value={d.featured ? 0 : 1} />
                        <button
                          type="submit"
                          className={`admin-btn-sm ${d.featured ? "admin-btn-sm--danger" : "admin-btn-sm--ghost"}`}
                          title="Show this design in the homepage carousel"
                        >
                          {d.featured ? "★ Featured" : "☆ Feature"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {allDesigns.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-soft)" }}>
                  No designs yet — create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
