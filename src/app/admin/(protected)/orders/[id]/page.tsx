import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "../../../../../db";
import {
  designs,
  fields as fieldsTable,
  orderReferenceImages,
  orderSelections,
  orders,
} from "../../../../../db/schema";
import { baseFieldRank, CONTACT_PREFERENCE_LABELS, isContactPreference } from "../../../../../lib/fields";
import { formatCents } from "../../../../../lib/pricing";
import { fromDateKey, formatTimeLabel } from "../../../../../lib/availability";
import { setOrderStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) notFound();

  if (order.status === "new") {
    db.update(orders).set({ status: "viewed" }).where(eq(orders.id, orderId)).run();
    order.status = "viewed";
  }

  const isCustom = order.designId == null;

  const [design, selections, allFields, referenceImages] = await Promise.all([
    order.designId ? db.select().from(designs).where(eq(designs.id, order.designId)).get() : undefined,
    db.select().from(orderSelections).where(eq(orderSelections.orderId, orderId)).then((r) => r),
    db.select().from(fieldsTable).then((r) => r),
    isCustom
      ? db.select().from(orderReferenceImages).where(eq(orderReferenceImages.orderId, orderId)).then((r) => r)
      : Promise.resolve([]),
  ]);

  const fieldById = new Map(allFields.map((f) => [f.id, f]));

  // group selections by field so a multi-select field's several rows show as one line
  const rowsByField = new Map<number, typeof selections>();
  for (const s of selections) {
    const list = rowsByField.get(s.fieldId) ?? [];
    list.push(s);
    rowsByField.set(s.fieldId, list);
  }
  const orderedFieldIds = Array.from(rowsByField.keys()).sort(
    (a, b) => baseFieldRank(fieldById.get(a)?.slug ?? "") - baseFieldRank(fieldById.get(b)?.slug ?? "")
  );

  return (
    <>
      <h1>Order #{order.id}</h1>
      <p className="admin-main__subtitle">
        Submitted {new Date(order.createdAt).toLocaleString()} · Status: {order.status}
      </p>

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Customer</h3>
        <p>{order.customerName}</p>
        <p>{order.customerEmail}</p>
        {order.customerPhone && <p>{order.customerPhone}</p>}
        {order.contactPreference && isContactPreference(order.contactPreference) && (
          <p>Prefers: {CONTACT_PREFERENCE_LABELS[order.contactPreference]}</p>
        )}
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Pickup</h3>
        <p>
          {order.pickupDate && order.pickupTime
            ? `${fromDateKey(order.pickupDate).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })} at ${formatTimeLabel(order.pickupTime)}`
            : isCustom
              ? "No preference given"
              : "Not scheduled"}
        </p>
      </div>

      {isCustom && referenceImages.length > 0 && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 10 }}>Reference Images</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {referenceImages.map((img) => (
              <a key={img.id} href={`/uploads/${img.path}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`/uploads/${img.path}`}
                  alt="Customer reference"
                  style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8 }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>{isCustom ? "Custom Cake Quote" : `Cake — ${design?.name ?? "Unknown design"}`}</h3>
        {orderedFieldIds.length === 0 && isCustom ? (
          <p>No details provided — the customer left every field blank.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Selection</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {orderedFieldIds.map((fieldId) => {
                const rows = rowsByField.get(fieldId)!;
                const field = fieldById.get(fieldId);
                const label = rows.map((r) => r.labelSnapshot).join(", ");
                const price = rows.reduce((sum, r) => sum + r.priceCentsSnapshot, 0);
                return (
                  <tr key={fieldId}>
                    <td>{field?.name ?? "Unknown field"}</td>
                    <td>{label}</td>
                    <td>{formatCents(price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 14, fontWeight: 700, fontFamily: "var(--font-heading)" }}>
          {isCustom ? "Estimated total" : "Total"}: {formatCents(order.totalPriceCents)}
        </div>
      </div>

      {order.comments && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 10 }}>Comments</h3>
          <p>{order.comments}</p>
        </div>
      )}

      <div className="admin-card" style={{ display: "flex", gap: 10 }}>
        {order.status !== "archived" ? (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="archived" />
            <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
              Archive
            </button>
          </form>
        ) : (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="viewed" />
            <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
              Unarchive
            </button>
          </form>
        )}
      </div>
    </>
  );
}
