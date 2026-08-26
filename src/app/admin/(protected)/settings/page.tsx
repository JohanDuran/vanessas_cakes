import { db } from "../../../../db";
import { siteSettings } from "../../../../db/schema";
import { setMaintenanceMode } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const row = db.select({ maintenanceMode: siteSettings.maintenanceMode }).from(siteSettings).limit(1).get();
  const maintenanceMode = row?.maintenanceMode ?? false;

  return (
    <>
      <h1>Settings</h1>
      <p className="admin-main__subtitle">Site-wide toggles.</p>

      <div className="admin-card">
        <h3 style={{ marginBottom: 6 }}>Maintenance mode</h3>
        <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: 16 }}>
          When on, visitors see a &quot;site under development&quot; message with our contact number
          instead of the app. Admins keep browsing normally. Use this while deploying or testing in
          production.
        </p>
        <form action={setMaintenanceMode}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <input type="checkbox" name="maintenanceMode" defaultChecked={maintenanceMode} />
            Site is under maintenance
          </label>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </form>
        {maintenanceMode && (
          <p style={{ marginTop: 12, color: "var(--pink-600)", fontWeight: 600 }}>
            Maintenance mode is currently ON — visitors can&apos;t see the site.
          </p>
        )}
      </div>
    </>
  );
}
