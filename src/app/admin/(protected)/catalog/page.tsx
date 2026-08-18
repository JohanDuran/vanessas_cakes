import Link from "next/link";
import { db } from "../../../../db";
import { catalogItems } from "../../../../db/schema";
import { AXES, AXIS_LABELS } from "../../../../lib/axes";

export const dynamic = "force-dynamic";

export default async function CatalogIndexPage() {
  const items = db.select().from(catalogItems).all();

  return (
    <>
      <h1>Catalog</h1>
      <p className="admin-main__subtitle">
        The items customers choose from in each step of the order flow.
      </p>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Axis</th>
              <th>Active items</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {AXES.map((axis) => {
              const count = items.filter((i) => i.axis === axis && i.active).length;
              return (
                <tr key={axis}>
                  <td>{AXIS_LABELS[axis]}</td>
                  <td>{count}</td>
                  <td>
                    <Link href={`/admin/catalog/${axis}`} className="admin-btn-sm admin-btn-sm--ghost">
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
