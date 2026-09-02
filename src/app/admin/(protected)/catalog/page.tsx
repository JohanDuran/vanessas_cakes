import Link from "next/link";
import { db } from "../../../../db";
import { fields, fieldOptions } from "../../../../db/schema";
import { FIELD_TYPE_LABELS, baseFieldRank, isFieldType } from "../../../../lib/fields";
import { setFieldActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function CatalogIndexPage() {
  const [allFields, allOptions] = await Promise.all([
    db.select().from(fields).then((r) => r),
    db.select().from(fieldOptions).then((r) => r),
  ]);

  const sorted = [...allFields].sort((a, b) => {
    const rankDiff = baseFieldRank(a.slug) - baseFieldRank(b.slug);
    if (rankDiff !== 0) return rankDiff;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });

  const optionCountByField = new Map<number, number>();
  for (const opt of allOptions) {
    optionCountByField.set(opt.fieldId, (optionCountByField.get(opt.fieldId) ?? 0) + 1);
  }

  return (
    <>
      <h1>Design Fields</h1>
      <p className="admin-main__subtitle">
        Everything customers choose from when ordering — the 6 built-in fields plus any custom
        fields you add.
      </p>

      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/catalog/new" className="btn btn-primary">
          + New Field
        </Link>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Options</th>
              <th>Status</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => (
              <tr key={f.id} className={f.active ? "" : "is-inactive"}>
                <td>
                  <Link href={`/admin/catalog/${f.id}`}>{f.name}</Link>
                  {f.isBase && <span className="field-type-tag">base</span>}
                </td>
                <td>{isFieldType(f.type) ? FIELD_TYPE_LABELS[f.type] : f.type}</td>
                <td>{optionCountByField.get(f.id) ?? 0}</td>
                <td>{f.active ? "Active" : "Inactive"}</td>
                <td>
                  <Link href={`/admin/catalog/${f.id}`} className="admin-btn-sm admin-btn-sm--ghost">
                    Manage
                  </Link>
                </td>
                <td>
                  <form action={setFieldActive}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="active" value={f.active ? 0 : 1} />
                    <button
                      type="submit"
                      className={`admin-btn-sm ${f.active ? "admin-btn-sm--danger" : "admin-btn-sm--ghost"}`}
                    >
                      {f.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-soft)" }}>
                  No fields yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
