import { loadStoryContent, loadPromoContent } from "../../../../db/queries";
import { updateStoryContent, updatePromoImage } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomepageSettingsPage() {
  const [story, promo] = await Promise.all([loadStoryContent(), loadPromoContent()]);

  return (
    <>
      <h1>Homepage</h1>
      <p className="admin-main__subtitle">Edit the &quot;Our Story&quot; section on the homepage.</p>

      <div className="admin-card">
        <form action={updateStoryContent} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-field">
            <label>Heading</label>
            <input name="heading" defaultValue={story.heading} style={{ width: "100%" }} />
          </div>

          <div className="admin-field">
            <label>Paragraph 1</label>
            <textarea name="paragraph1" defaultValue={story.paragraph1} rows={4} style={{ width: "100%" }} />
          </div>

          <div className="admin-field">
            <label>Paragraph 2</label>
            <textarea name="paragraph2" defaultValue={story.paragraph2} rows={4} style={{ width: "100%" }} />
          </div>

          <div className="admin-field">
            <label>Stats</label>
            <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", marginBottom: 8 }}>
              The numbers shown under the story text (e.g. &quot;12+ Years Baking&quot;).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {story.stats.map((stat, i) => (
                <div key={i} className="admin-form-row">
                  <div className="admin-field" style={{ flex: 1, minWidth: 140 }}>
                    <input
                      name={`stat${i + 1}Value`}
                      defaultValue={stat.value}
                      placeholder="Value (e.g. 12+)"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div className="admin-field" style={{ flex: 2, minWidth: 200 }}>
                    <input
                      name={`stat${i + 1}Label`}
                      defaultValue={stat.label}
                      placeholder="Label (e.g. Years Baking)"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-field">
            <label>Photo</label>
            <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", marginBottom: 8 }}>
              Replaces the illustration next to the story text. Leave empty to keep the current
              image (or the illustration, if none has been uploaded).
            </p>
            {story.imagePath && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <img
                  src={story.imagePath}
                  alt=""
                  width={100}
                  height={100}
                  style={{ objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem" }}>
                  <input type="checkbox" name="removePhoto" />
                  Remove photo (revert to illustration)
                </label>
              </div>
            )}
            <input type="file" name="photo" accept="image/*" />
          </div>

          <div>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>

      <h1 style={{ marginTop: 32 }}>Promo Pop-up</h1>
      <p className="admin-main__subtitle">
        A banner image shown in a pop-up modal shortly after a visitor lands on the homepage.
        Leave the image empty to keep the pop-up off.
      </p>

      <div className="admin-card">
        <form action={updatePromoImage} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-field">
            <label>Banner image</label>
            <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", marginBottom: 8 }}>
              Visitors who already dismissed the pop-up won&apos;t see it again just because the
              image changed — bump CURRENT_PROMO_ID in PromoModal.tsx to bring it back for
              everyone on their next visit.
            </p>
            {promo.imagePath && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <img
                  src={promo.imagePath}
                  alt=""
                  width={100}
                  height={100}
                  style={{ objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem" }}>
                  <input type="checkbox" name="removeImage" />
                  Remove image (turns the pop-up off)
                </label>
              </div>
            )}
            <input type="file" name="image" accept="image/*" />
          </div>

          <div className="admin-field">
            <label>Image alt text</label>
            <input
              name="imageAlt"
              defaultValue={promo.imageAlt}
              placeholder="Promotional offer"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
