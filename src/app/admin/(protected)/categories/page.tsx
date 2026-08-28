import { asc } from "drizzle-orm";
import { db } from "../../../../db";
import { cakeCategories } from "../../../../db/schema";
import { createCategory, saveCategory, setCategoryActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await db
    .select()
    .from(cakeCategories)
    .orderBy(asc(cakeCategories.sortOrder), asc(cakeCategories.name))
    ;

  return (
    <>
      <h1>Cake Categories</h1>
      <p className="admin-main__subtitle">
        Tags like &quot;Tall Cakes&quot; or &quot;Wedding Cakes&quot; — never shown to customers on
        their own, but used as filter chips above the design picker so customers can narrow down
        the gallery. Pick zero, one, or many for each design from that design&apos;s edit page.
      </p>

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Add category</h3>
        <form action={createCategory} className="admin-form-row">
          <div className="admin-field">
            <label>Name</label>
            <input name="name" required placeholder="e.g. Wedding Cakes" />
          </div>
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
              <th>Sort</th>
              <th>Status</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const formId = `category-form-${c.id}`;
              return (
                <tr key={c.id} className={c.active ? "" : "is-inactive"}>
                  <td style={{ minWidth: 200 }}>
                    <form id={formId} action={saveCategory} />
                    <input type="hidden" form={formId} name="id" value={c.id} />
                    <input form={formId} name="name" defaultValue={c.name} required style={{ width: "100%" }} />
                  </td>
                  <td style={{ minWidth: 70 }}>
                    <input
                      form={formId}
                      name="sortOrder"
                      type="number"
                      defaultValue={c.sortOrder}
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td>{c.active ? "Active" : "Inactive"}</td>
                  <td>
                    <button form={formId} type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                      Save
                    </button>
                  </td>
                  <td>
                    <form action={setCategoryActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={c.active ? 0 : 1} />
                      <button
                        type="submit"
                        className={`admin-btn-sm ${c.active ? "admin-btn-sm--danger" : "admin-btn-sm--ghost"}`}
                      >
                        {c.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-soft)" }}>
                  No categories yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
