import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "../../../../db";
import { portfolioPhotos } from "../../../../db/schema";
import { uploadPortfolioPhotos, deletePortfolioPhoto } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPortfolioPage() {
  const photos = await db
    .select()
    .from(portfolioPhotos)
    .orderBy(asc(portfolioPhotos.sortOrder), asc(portfolioPhotos.createdAt));

  return (
    <>
      <h1>Portfolio</h1>
      <p className="admin-main__subtitle">
        Inspiration photos shown on the public Portfolio page. Upload as many as you like, then
        &quot;Configure&quot; one when you&apos;re ready to turn it into a priced design — it moves out
        of the Portfolio automatically once configured.
      </p>

      <form action={uploadPortfolioPhotos} className="admin-card" style={{ marginBottom: 20 }}>
        <div className="admin-field">
          <label>Upload photos</label>
          <input type="file" name="photos" accept="image/*" multiple />
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
          Upload
        </button>
      </form>

      <div className="admin-card">
        {photos.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {photos.map((photo) => (
              <div key={photo.id} style={{ textAlign: "center", width: 140 }}>
                <img
                  src={photo.path}
                  alt=""
                  width={140}
                  height={140}
                  style={{ objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "center" }}>
                  <Link
                    href={`/admin/designs/new?portfolioPhotoId=${photo.id}`}
                    className="admin-btn-sm admin-btn-sm--ghost"
                  >
                    Configure
                  </Link>
                  <form action={deletePortfolioPhoto}>
                    <input type="hidden" name="id" value={photo.id} />
                    <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--text-soft)" }}>No portfolio photos yet — upload some above.</p>
        )}
      </div>
    </>
  );
}
