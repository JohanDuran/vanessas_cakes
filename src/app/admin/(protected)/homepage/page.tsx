import { loadStoryContent } from "../../../../db/queries";
import { updateStoryContent } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomepageSettingsPage() {
  const story = await loadStoryContent();

  return (
    <>
      <h1>Homepage</h1>
      <p className="admin-main__subtitle">Edit the &quot;Our Story&quot; section on the homepage.</p>

      <div className="admin-card">
        <form action={updateStoryContent} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-field">
            <label>Heading</label>
            <input name="heading" defaultValue={story.heading} required style={{ width: "100%" }} />
          </div>

          <div className="admin-field">
            <label>Paragraph 1</label>
            <textarea name="paragraph1" defaultValue={story.paragraph1} required rows={4} style={{ width: "100%" }} />
          </div>

          <div className="admin-field">
            <label>Paragraph 2</label>
            <textarea name="paragraph2" defaultValue={story.paragraph2} required rows={4} style={{ width: "100%" }} />
          </div>

          <div className="admin-field">
            <label>Stats</label>
            <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", marginBottom: 8 }}>
              The 3 numbers shown under the story text (e.g. &quot;12+ Years Baking&quot;).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {story.stats.map((stat, i) => (
                <div key={i} className="admin-form-row">
                  <div className="admin-field" style={{ flex: 1, minWidth: 140 }}>
                    <input
                      name={`stat${i + 1}Value`}
                      defaultValue={stat.value}
                      required
                      placeholder="Value (e.g. 12+)"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div className="admin-field" style={{ flex: 2, minWidth: 200 }}>
                    <input
                      name={`stat${i + 1}Label`}
                      defaultValue={stat.label}
                      required
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
    </>
  );
}
