import { asc, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { catalogItems, constraintPairs } from "../../../../db/schema";
import { AXES, AXIS_LABELS } from "../../../../lib/axes";
import { createConstraint, deleteConstraint } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConstraintsPage() {
  const [items, allItems, pairs] = await Promise.all([
    db
      .select()
      .from(catalogItems)
      .where(eq(catalogItems.active, true))
      .orderBy(asc(catalogItems.axis), asc(catalogItems.sortOrder))
      .then((rows) => rows),
    db.select().from(catalogItems).then((rows) => rows),
    db.select().from(constraintPairs).all(),
  ]);

  // active items populate the "add a constraint" pickers; all items (including
  // deactivated ones) resolve names for already-existing pairs below, so a
  // constraint doesn't go illegible just because its item was deactivated.
  const itemById = new Map(allItems.map((i) => [i.id, i]));

  return (
    <>
      <h1>Constraints</h1>
      <p className="admin-main__subtitle">
        Pairs of items that can&apos;t be combined — hidden from customers once they&apos;ve picked
        the other item.
      </p>

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Add a constraint</h3>
        <form action={createConstraint} className="admin-form-row">
          <div className="admin-field">
            <label>Item A</label>
            <select name="itemAId" required style={{ minWidth: 200 }}>
              {AXES.map((axis) => (
                <optgroup key={axis} label={AXIS_LABELS[axis]}>
                  {items
                    .filter((i) => i.axis === axis)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label>Item B</label>
            <select name="itemBId" required style={{ minWidth: 200 }}>
              {AXES.map((axis) => (
                <optgroup key={axis} label={AXIS_LABELS[axis]}>
                  {items
                    .filter((i) => i.axis === axis)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
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
              <th>Item A</th>
              <th>Item B</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair) => {
              const a = itemById.get(pair.itemAId);
              const b = itemById.get(pair.itemBId);
              return (
                <tr key={pair.id}>
                  <td>
                    {a
                      ? `${AXIS_LABELS[pair.axisA as keyof typeof AXIS_LABELS] ?? pair.axisA} — ${a.name}${a.active ? "" : " (inactive)"}`
                      : "(deleted item)"}
                  </td>
                  <td>
                    {b
                      ? `${AXIS_LABELS[pair.axisB as keyof typeof AXIS_LABELS] ?? pair.axisB} — ${b.name}${b.active ? "" : " (inactive)"}`
                      : "(deleted item)"}
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
