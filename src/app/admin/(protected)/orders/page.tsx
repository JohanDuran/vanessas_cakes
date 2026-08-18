import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { designs, orders } from "../../../../db/schema";
import { formatCents } from "../../../../lib/pricing";

export const dynamic = "force-dynamic";

export default async function OrdersInboxPage() {
  const allOrders = db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      totalPriceCents: orders.totalPriceCents,
      status: orders.status,
      createdAt: orders.createdAt,
      designName: designs.name,
    })
    .from(orders)
    .leftJoin(designs, eq(orders.designId, designs.id))
    .orderBy(desc(orders.createdAt))
    .all();

  return (
    <>
      <h1>Orders</h1>
      <p className="admin-main__subtitle">Cake orders submitted by customers, newest first.</p>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Design</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allOrders.map((o) => (
              <tr key={o.id} className={o.status === "archived" ? "is-inactive" : ""}>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>
                  {o.customerName}
                  <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>{o.customerEmail}</div>
                </td>
                <td>{o.designName ?? "—"}</td>
                <td>{formatCents(o.totalPriceCents)}</td>
                <td style={{ textTransform: "capitalize" }}>{o.status}</td>
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="admin-btn-sm admin-btn-sm--ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {allOrders.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-soft)" }}>
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
