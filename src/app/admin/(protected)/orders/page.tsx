import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { designs, orderItems, orders } from "../../../../db/schema";
import { closePastPickupOrders, loadPickupAvailability } from "../../../../db/queries";
import { formatCents } from "../../../../lib/pricing";
import { fromDateKey, formatTimeLabel } from "../../../../lib/availability";
import OrdersCalendar, { type CalendarOrder } from "../../../../components/admin/OrdersCalendar";
import { closeDayForNewOrders, reopenDay } from "../availability/actions";

export const dynamic = "force-dynamic";

/** "Midnight Choco Drip" for a single-cake order, "Midnight Choco Drip +1
 *  more" for a multi-cake one — the admin list only has room for one line. */
function summarizeItemNames(names: string[]): string {
  if (names.length === 0) return "Custom Cake";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more`;
}

export default async function OrdersInboxPage() {
  closePastPickupOrders();

  const [allOrders, allItems, { settings, overrides }] = await Promise.all([
    db
      .select({
        id: orders.id,
        customerName: orders.customerName,
        customerEmail: orders.customerEmail,
        totalPriceCents: orders.totalPriceCents,
        status: orders.status,
        createdAt: orders.createdAt,
        pickupDate: orders.pickupDate,
        pickupTime: orders.pickupTime,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .all(),
    db
      .select({ orderId: orderItems.orderId, designName: designs.name, sortOrder: orderItems.sortOrder })
      .from(orderItems)
      .leftJoin(designs, eq(orderItems.designId, designs.id))
      .all(),
    loadPickupAvailability(),
  ]);

  const itemNamesByOrder = new Map<number, string[]>();
  for (const item of allItems.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = itemNamesByOrder.get(item.orderId) ?? [];
    list.push(item.designName ?? "Custom Cake");
    itemNamesByOrder.set(item.orderId, list);
  }

  const ordersByDate: Record<string, CalendarOrder[]> = {};
  for (const o of allOrders) {
    if (!o.pickupDate) continue;
    const list = ordersByDate[o.pickupDate] ?? (ordersByDate[o.pickupDate] = []);
    list.push({
      id: o.id,
      customerName: o.customerName,
      itemSummary: summarizeItemNames(itemNamesByOrder.get(o.id) ?? []),
      pickupTime: o.pickupTime,
      totalPriceCents: o.totalPriceCents,
      status: o.status,
    });
  }

  return (
    <>
      <h1>Orders</h1>
      <p className="admin-main__subtitle">Cake orders submitted by customers, newest first.</p>

      <OrdersCalendar
        ordersByDate={ordersByDate}
        maxOrdersPerDay={settings.maxOrdersPerDay}
        overrides={overrides}
        closeDayForNewOrders={closeDayForNewOrders}
        reopenDay={reopenDay}
      />

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Cakes</th>
              <th>Pickup</th>
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
                <td>{summarizeItemNames(itemNamesByOrder.get(o.id) ?? [])}</td>
                <td>
                  {o.pickupDate && o.pickupTime
                    ? `${fromDateKey(o.pickupDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${formatTimeLabel(o.pickupTime)}`
                    : "—"}
                </td>
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
                <td colSpan={7} style={{ color: "var(--text-soft)" }}>
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
