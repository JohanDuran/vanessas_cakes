import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "../../../../../db";
import { fields, fieldOptions, fieldOptionDimensions } from "../../../../../db/schema";
import { FIELD_TYPES, FIELD_TYPE_LABELS, isFieldType } from "../../../../../lib/fields";
import { createOption, saveFieldSettings, setOptionActive, updateOption } from "../actions";

export const dynamic = "force-dynamic";

function centsToDollarsStr(cents: number) {
  return (cents / 100).toFixed(2);
}

export default async function FieldDetailPage({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}) {
  const { fieldId: fieldIdParam } = await params;
  const fieldId = Number(fieldIdParam);
  if (!Number.isInteger(fieldId)) notFound();

  const field = db.select().from(fields).where(eq(fields.id, fieldId)).get();
  if (!field || !isFieldType(field.type)) notFound();

  const options = db
    .select()
    .from(fieldOptions)
    .where(eq(fieldOptions.fieldId, fieldId))
    .orderBy(asc(fieldOptions.sortOrder), asc(fieldOptions.name))
    .all();

  const dimsByOptionId = new Map(
    options.length > 0
      ? db
          .select()
          .from(fieldOptionDimensions)
          .where(
            inArray(
              fieldOptionDimensions.fieldOptionId,
              options.map((o) => o.id)
            )
          )
          .all()
          .map((d) => [d.fieldOptionId, d])
      : []
  );

  const showDimensionColumns = field.hasShapeDiagram;

  return (
    <>
      <h1>Catalog · {field.name}</h1>
      <p className="admin-main__subtitle">
        {field.isBase
          ? "Built-in field — every design answers this one."
          : "Custom field — attach it to a design from that design's edit page."}
      </p>

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Field settings</h3>
        <form action={saveFieldSettings} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="id" value={field.id} />
          <div className="admin-form-row">
            <div className="admin-field">
              <label>Name</label>
              <input name="name" defaultValue={field.name} required />
            </div>
            <div className="admin-field">
              <label>Type{field.isBase ? " (fixed)" : ""}</label>
              <select name="type" defaultValue={field.type} disabled={field.isBase} style={{ minWidth: 220 }}>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: "10px 22px" }}>
              Save
            </button>
          </div>
          {(field.type === "single_select" || field.type === "multi_select") && (
            <div className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="hasShapeDiagram"
                name="hasShapeDiagram"
                value="1"
                defaultChecked={field.hasShapeDiagram}
              />
              <label htmlFor="hasShapeDiagram" style={{ margin: 0 }}>
                Show shape diagram (dimension/servings visual) for this field&apos;s options
              </label>
            </div>
          )}
        </form>
      </div>

      {(field.type === "single_select" || field.type === "multi_select") && (
        <>
          <div className="admin-card">
            <h3 style={{ marginBottom: 14 }}>Add option</h3>
            <form action={createOption} className="admin-form-row">
              <input type="hidden" name="fieldId" value={field.id} />
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
              {showDimensionColumns && (
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
                  {showDimensionColumns && (
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
                {options.map((opt) => {
                  const formId = `option-form-${opt.id}`;
                  const dims = dimsByOptionId.get(opt.id);
                  return (
                    <tr key={opt.id} className={opt.active ? "" : "is-inactive"}>
                      <td style={{ minWidth: 150 }}>
                        {/* empty submitter for this row — every input below points at it via the `form` attribute so each field can live in its own <td> and still line up under the header */}
                        <form id={formId} action={updateOption} />
                        <input type="hidden" form={formId} name="id" value={opt.id} />
                        <input type="hidden" form={formId} name="fieldId" value={field.id} />
                        <input form={formId} name="name" defaultValue={opt.name} required style={{ width: "100%" }} />
                      </td>
                      <td style={{ minWidth: 90 }}>
                        <input
                          form={formId}
                          name="priceDollars"
                          type="number"
                          step="0.01"
                          defaultValue={centsToDollarsStr(opt.priceCents)}
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td style={{ minWidth: 70 }}>
                        <input
                          form={formId}
                          name="sortOrder"
                          type="number"
                          defaultValue={opt.sortOrder}
                          style={{ width: "100%" }}
                        />
                      </td>
                      {showDimensionColumns && (
                        <>
                          <td>
                            <input
                              form={formId}
                              name="diameterIn"
                              defaultValue={dims?.diameterIn ?? ""}
                              style={{ width: "100%" }}
                            />
                          </td>
                          <td>
                            <select form={formId} name="shape" defaultValue={dims?.shape ?? "round"} style={{ width: "100%" }}>
                              <option value="round">Round</option>
                              <option value="square">Square</option>
                              <option value="sheet">Sheet</option>
                            </select>
                          </td>
                          <td>
                            <input
                              form={formId}
                              name="tiers"
                              type="number"
                              defaultValue={dims?.tiers ?? 1}
                              style={{ width: "100%" }}
                            />
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <input
                                form={formId}
                                name="servesMin"
                                type="number"
                                defaultValue={dims?.servesMin ?? ""}
                                style={{ width: "100%" }}
                              />
                              <input
                                form={formId}
                                name="servesMax"
                                type="number"
                                defaultValue={dims?.servesMax ?? ""}
                                style={{ width: "100%" }}
                              />
                            </div>
                          </td>
                        </>
                      )}
                      <td>{opt.active ? "Active" : "Inactive"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button form={formId} type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                            Save
                          </button>
                          <form action={setOptionActive}>
                            <input type="hidden" name="id" value={opt.id} />
                            <input type="hidden" name="fieldId" value={field.id} />
                            <input type="hidden" name="active" value={opt.active ? 0 : 1} />
                            <button
                              type="submit"
                              className={`admin-btn-sm ${opt.active ? "admin-btn-sm--danger" : "admin-btn-sm--ghost"}`}
                            >
                              {opt.active ? "Deactivate" : "Reactivate"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {options.length === 0 && (
                  <tr>
                    <td colSpan={showDimensionColumns ? 9 : 5} style={{ color: "var(--text-soft)" }}>
                      No options yet — add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(field.type === "text" || field.type === "number") && (
        <div className="admin-card">
          <p style={{ color: "var(--text-soft)" }}>
            {field.type === "text" ? "Text" : "Number"} fields don&apos;t have options — customers
            type a value directly. Set a default (and optionally lock it) per design from that
            design&apos;s edit page.
          </p>
        </div>
      )}

      <p>
        <Link href="/admin/catalog">&larr; Back to Catalog</Link>
      </p>
    </>
  );
}
