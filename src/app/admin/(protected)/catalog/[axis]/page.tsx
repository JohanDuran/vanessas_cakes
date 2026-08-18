import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "../../../../../db";
import { catalogItems } from "../../../../../db/schema";
import { AXES, AXIS_LABELS, isAxis } from "../../../../../lib/axes";
import { createCatalogItem, setCatalogItemActive, updateCatalogItem } from "../actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

function centsToDollarsStr(cents: number) {
  return (cents / 100).toFixed(2);
}

export default async function CatalogAxisPage({
  params,
}: {
  params: Promise<{ axis: string }>;
}) {
  const { axis } = await params;
  if (!isAxis(axis)) notFound();

  const items = db
    .select()
    .from(catalogItems)
    .where(eq(catalogItems.axis, axis))
    .orderBy(asc(catalogItems.sortOrder), asc(catalogItems.name))
    .all();

  const isSize = axis === "size";

  return (
    <>
      <h1>Catalog · {AXIS_LABELS[axis]}</h1>
      <p className="admin-main__subtitle">
        Prices are the standard per-item price customers see deltas against.
      </p>

      <div className="admin-axis-tabs">
        {AXES.map((a) => (
          <Link key={a} href={`/admin/catalog/${a}`} className={a === axis ? "is-active" : ""}>
            {AXIS_LABELS[a]}
          </Link>
        ))}
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Add {AXIS_LABELS[axis]}</h3>
        <form action={createCatalogItem} className="admin-form-row">
          <input type="hidden" name="axis" value={axis} />
          <div className="admin-field">
            <label>Name</label>
            <input name="name" required />
          </div>
          <div className="admin-field">
            <label>Price ($)</label>
            <input name="priceDollars" type="number" step="0.01" defaultValue="0" required />
          </div>
          <div className="admin-field">
            <label>Sort order</label>
            <input name="sortOrder" type="number" defaultValue="0" style={{ minWidth: 70 }} />
          </div>
          {isSize && (
            <>
              <div className="admin-field">
                <label>Diameter</label>
                <input name="diameterIn" placeholder={'8"'} style={{ minWidth: 70 }} />
              </div>
              <div className="admin-field">
                <label>Shape</label>
                <select name="shape" defaultValue="round">
                  <option value="round">Round</option>
                  <option value="square">Square</option>
                  <option value="sheet">Sheet</option>
                </select>
              </div>
              <div className="admin-field">
                <label>Tiers</label>
                <input name="tiers" type="number" defaultValue="1" style={{ minWidth: 60 }} />
              </div>
              <div className="admin-field">
                <label>Serves min</label>
                <input name="servesMin" type="number" style={{ minWidth: 70 }} />
              </div>
              <div className="admin-field">
                <label>Serves max</label>
                <input name="servesMax" type="number" style={{ minWidth: 70 }} />
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary" style={{ padding: "10px 22px" }}>
            Add
          </button>
        </form>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price ($)</th>
              <th>Sort</th>
              {isSize && (
                <>
                  <th>Diameter</th>
                  <th>Shape</th>
                  <th>Tiers</th>
                  <th>Serves</th>
                </>
              )}
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={item.active ? "" : "is-inactive"}>
                <td colSpan={isSize ? 7 : 3} style={{ padding: 0 }}>
                  <form
                    action={updateCatalogItem}
                    className="admin-form-row"
                    style={{ padding: "8px 12px" }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="axis" value={axis} />
                    <div className="admin-field">
                      <input name="name" defaultValue={item.name} required />
                    </div>
                    <div className="admin-field">
                      <input
                        name="priceDollars"
                        type="number"
                        step="0.01"
                        defaultValue={centsToDollarsStr(item.priceCents)}
                        style={{ minWidth: 90 }}
                      />
                    </div>
                    <div className="admin-field">
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={item.sortOrder}
                        style={{ minWidth: 60 }}
                      />
                    </div>
                    {isSize && (
                      <>
                        <div className="admin-field">
                          <input
                            name="diameterIn"
                            defaultValue={item.diameterIn ?? ""}
                            style={{ minWidth: 60 }}
                          />
                        </div>
                        <div className="admin-field">
                          <select name="shape" defaultValue={item.shape ?? "round"}>
                            <option value="round">Round</option>
                            <option value="square">Square</option>
                            <option value="sheet">Sheet</option>
                          </select>
                        </div>
                        <div className="admin-field">
                          <input
                            name="tiers"
                            type="number"
                            defaultValue={item.tiers ?? 1}
                            style={{ minWidth: 50 }}
                          />
                        </div>
                        <div className="admin-field" style={{ flexDirection: "row", gap: 4 }}>
                          <input
                            name="servesMin"
                            type="number"
                            defaultValue={item.servesMin ?? ""}
                            style={{ minWidth: 50 }}
                          />
                          <input
                            name="servesMax"
                            type="number"
                            defaultValue={item.servesMax ?? ""}
                            style={{ minWidth: 50 }}
                          />
                        </div>
                      </>
                    )}
                    <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                      Save
                    </button>
                  </form>
                </td>
                <td>{item.active ? "Active" : "Inactive"}</td>
                <td>
                  <form action={setCatalogItemActive}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="axis" value={axis} />
                    <input type="hidden" name="active" value={item.active ? 0 : 1} />
                    <button
                      type="submit"
                      className={`admin-btn-sm ${item.active ? "admin-btn-sm--danger" : "admin-btn-sm--ghost"}`}
                    >
                      {item.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={isSize ? 9 : 5} style={{ color: "var(--text-soft)" }}>
                  No items yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
