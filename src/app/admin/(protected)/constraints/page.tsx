import { eq } from "drizzle-orm";
import { db } from "../../../../db";
import { fieldOptions, fields, constraintPairs } from "../../../../db/schema";
import { baseFieldRank } from "../../../../lib/fields";
import { createConstraint, deleteConstraint } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConstraintsPage() {
  const [allFields, allOptions, pairs] = await Promise.all([
    db.select().from(fields).where(eq(fields.active, true)).then((r) => r),
    // all options (including inactive) so already-existing pairs stay legible
    // if an option is later deactivated; the pickers below filter to active only
    await db.select().from(fieldOptions).then((r) => r),
    db.select().from(constraintPairs),
  ]);

  const sortedFields = [...allFields].sort(
    (a, b) =>
      baseFieldRank(a.slug) - baseFieldRank(b.slug) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name)
  );
  const fieldById = new Map(allFields.map((f) => [f.id, f]));
  const optionById = new Map(allOptions.map((o) => [o.id, o]));

  const activeOptionsByField = new Map<number, typeof allOptions>();
  for (const opt of allOptions) {
    if (!opt.active) continue;
    const list = activeOptionsByField.get(opt.fieldId) ?? [];
    list.push(opt);
    activeOptionsByField.set(opt.fieldId, list);
  }

  return (
    <>
      <h1>Constraints</h1>
      <p className="admin-main__subtitle">
        Pairs of options that can&apos;t be combined — hidden from customers once they&apos;ve
        picked the other option.
      </p>

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Add a constraint</h3>
        <form action={createConstraint} className="admin-form-row">
          <div className="admin-field">
            <label>Option A</label>
            <select name="optionAId" style={{ minWidth: 200 }}>
              {sortedFields.map((f) => (
                <optgroup key={f.id} label={f.name}>
                  {(activeOptionsByField.get(f.id) ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label>Option B</label>
            <select name="optionBId" style={{ minWidth: 200 }}>
              {sortedFields.map((f) => (
                <optgroup key={f.id} label={f.name}>
                  {(activeOptionsByField.get(f.id) ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: "10px 22px" }}>
            Add Constraint
          </button>
        </form>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Option A</th>
              <th>Option B</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair) => {
              const a = optionById.get(pair.optionAId);
              const b = optionById.get(pair.optionBId);
              const aField = a ? fieldById.get(a.fieldId) : undefined;
              const bField = b ? fieldById.get(b.fieldId) : undefined;
              return (
                <tr key={pair.id}>
                  <td>
                    {a
                      ? `${aField?.name ?? "?"} — ${a.name}${a.active ? "" : " (inactive)"}`
                      : "(deleted option)"}
                  </td>
                  <td>
                    {b
                      ? `${bField?.name ?? "?"} — ${b.name}${b.active ? "" : " (inactive)"}`
                      : "(deleted option)"}
                  </td>
                  <td>
                    <form action={deleteConstraint}>
                      <input type="hidden" name="id" value={pair.id} />
                      <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {pairs.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "var(--text-soft)" }}>
                  No constraints yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
