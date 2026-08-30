import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { designs, orderItems, orders } from "../../../../db/schema";
import { closePastPickupOrders } from "../../../../db/queries";
import { formatCents } from "../../../../lib/pricing";
import { fromDateKey, formatTimeLabel } from "../../../../lib/availability";
import { CONTACT_PREFERENCE_LABELS, isContactPreference } from "../../../../lib/fields";
import QuoteStatusBadge from "../../../../components/admin/QuoteStatusBadge";

export const dynamic = "force-dynamic";

/** "Midnight Choco Drip" for a single-cake quote, "Midnight Choco Drip +1
 *  more" for a multi-cake one — the admin list only has room for one line. */
function summarizeItemNames(names: string[]): string {
  if (names.length === 0) return "Custom Cake";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more`;
}

export default async function QuotesInboxPage() {
  await closePastPickupOrders();

  const [allOrdersRaw, allItems] = await Promise.all([
    db
      .select({
        id: orders.id,
        customerName: orders.customerName,
        customerEmail: orders.customerEmail,
        status: orders.status,
        quoteStatus: orders.quoteStatus,
        totalPriceCents: orders.totalPriceCents,
        contactPreference: orders.contactPreference,
        createdAt: orders.createdAt,
        pickupDate: orders.pickupDate,
        pickupTime: orders.pickupTime,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt)),
    db
      .select({
        orderId: orderItems.orderId,
        designName: designs.name,
        sortOrder: orderItems.sortOrder,
      })
      .from(orderItems)
      .leftJoin(designs, eq(orderItems.designId, designs.id)),
  ]);

  // A quote lives here until accepted — see orders.quoteStatus in
  // src/db/schema.ts. Once accepted it moves to /admin/orders instead.
  const allOrders = allOrdersRaw.filter((o) => o.quoteStatus != null && o.quoteStatus !== "accepted");

  const itemNamesByOrder = new Map<number, string[]>();
  for (const item of allItems.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = itemNamesByOrder.get(item.orderId) ?? [];
    list.push(item.designName ?? "Custom Cake");
    itemNamesByOrder.set(item.orderId, list);
  }

  return (
    <>
      <h1>Quotes</h1>
      <p className="admin-main__subtitle">
        Custom-cake quote requests, from first inquiry through pricing and confirmation. Accepted quotes move to{" "}
        <Link href="/admin/orders">Orders</Link>.
      </p>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Cakes</th>
              <th>Pickup</th>
              <th>Contact</th>
              <th>Price</th>
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
                <td>
                  {o.contactPreference && isContactPreference(o.contactPreference)
                    ? CONTACT_PREFERENCE_LABELS[o.contactPreference]
                    : "—"}
                </td>
                <td>{o.quoteStatus === "new" ? "—" : formatCents(o.totalPriceCents)}</td>
                <td>
                  <QuoteStatusBadge status={o.quoteStatus ?? "new"} />
                </td>
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="admin-btn-sm admin-btn-sm--ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {allOrders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: "var(--text-soft)" }}>
                  No quote requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
