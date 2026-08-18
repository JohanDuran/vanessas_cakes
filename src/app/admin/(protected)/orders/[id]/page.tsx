import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "../../../../../db";
import { designs, orderSelections, orders } from "../../../../../db/schema";
import { AXIS_LABELS, type Axis } from "../../../../../lib/axes";
import { formatCents } from "../../../../../lib/pricing";
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

  const [design, selections] = await Promise.all([
    order.designId ? db.select().from(designs).where(eq(designs.id, order.designId)).get() : undefined,
    db.select().from(orderSelections).where(eq(orderSelections.orderId, orderId)).then((r) => r),
  ]);

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
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Cake — {design?.name ?? "Unknown design"}</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Selection</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {selections.map((s) => (
              <tr key={s.id}>
                <td>{AXIS_LABELS[s.axis as Axis] ?? s.axis}</td>
                <td>{s.itemNameSnapshot}</td>
                <td>{formatCents(s.priceCentsSnapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, fontWeight: 700, fontFamily: "var(--font-heading)" }}>
          Total: {formatCents(order.totalPriceCents)}
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
