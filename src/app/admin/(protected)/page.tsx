import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { designs, orders } from "../../../db/schema";
import { loadPickupAvailability } from "../../../db/queries";
import { formatCents } from "../../../lib/pricing";
import { fromDateKey, formatTimeLabel, toDateKey, isDayAtCapacity } from "../../../lib/availability";

export const dynamic = "force-dynamic";

const UPCOMING_WINDOW_DAYS = 7;
const RECENT_ORDERS_LIMIT = 6;

export default async function AdminDashboardPage() {
  const now = new Date();
  const todayKey = toDateKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const upcomingEndKey = toDateKey(new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000));

  const [allOrders, allDesigns, { settings, orderCountsByDate }] = await Promise.all([
    db
      .select({
        id: orders.id,
        customerName: orders.customerName,
        totalPriceCents: orders.totalPriceCents,
        status: orders.status,
        createdAt: orders.createdAt,
        pickupDate: orders.pickupDate,
        pickupTime: orders.pickupTime,
        designName: designs.name,
      })
      .from(orders)
      .leftJoin(designs, eq(orders.designId, designs.id))
      .orderBy(desc(orders.createdAt))
      .all(),
    db.select({ published: designs.published }).from(designs).all(),
    loadPickupAvailability(),
  ]);

  const newOrders = allOrders.filter((o) => o.status === "new");
  const ordersThisMonth = allOrders.filter((o) => o.createdAt >= monthStart);
  const revenueThisMonthCents = ordersThisMonth.reduce((sum, o) => sum + o.totalPriceCents, 0);

  const upcomingPickups = allOrders
    .filter(
      (o) => o.status !== "archived" && o.pickupDate && o.pickupDate >= todayKey && o.pickupDate <= upcomingEndKey
    )
    .sort((a, b) => (a.pickupDate! < b.pickupDate! ? -1 : a.pickupDate! > b.pickupDate! ? 1 : 0));

  const capacityAlerts = settings.maxOrdersPerDay
    ? Array.from(new Set(upcomingPickups.map((o) => o.pickupDate!)))
        .filter((dateKey) => isDayAtCapacity(dateKey, settings, orderCountsByDate))
        .sort()
    : [];

  const publishedDesignsCount = allDesigns.filter((d) => d.published).length;

  const recentOrders = allOrders.slice(0, RECENT_ORDERS_LIMIT);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="admin-main__subtitle">A snapshot of what needs your attention today.</p>

      <div className="admin-stats">
        <div className="admin-stat">
          <span className="admin-stat__label">New Orders</span>
          <span className="admin-stat__value">{newOrders.length}</span>
          <Link href="/admin/orders" className="admin-stat__link">
            Review inbox
          </Link>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__label">Revenue This Month</span>
          <span className="admin-stat__value">{formatCents(revenueThisMonthCents)}</span>
          <span className="admin-stat__hint">{ordersThisMonth.length} order{ordersThisMonth.length === 1 ? "" : "s"}</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__label">Upcoming Pickups</span>
          <span className="admin-stat__value">{upcomingPickups.length}</span>
          <span className="admin-stat__hint">Next {UPCOMING_WINDOW_DAYS} days</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__label">Published Designs</span>
          <span className="admin-stat__value">{publishedDesignsCount}</span>
          <Link href="/admin/designs" className="admin-stat__link">
            Manage designs
          </Link>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-card">
          <h2 className="admin-card__title">Needs Attention</h2>
          {newOrders.length === 0 && capacityAlerts.length === 0 ? (
            <p style={{ color: "var(--text-soft)" }}>You&apos;re all caught up — no new orders or capacity alerts.</p>
          ) : (
            <ul className="admin-alert-list">
              {newOrders.slice(0, 5).map((o) => (
                <li key={o.id} className="admin-alert-list__item">
                  <Link href={`/admin/orders/${o.id}`}>
                    <span className="admin-alert-list__badge admin-alert-list__badge--new">New</span>
                    {o.customerName} · {o.designName ?? "Custom Cake"} · {formatCents(o.totalPriceCents)}
                  </Link>
                </li>
              ))}
              {capacityAlerts.map((dateKey) => (
                <li key={dateKey} className="admin-alert-list__item">
                  <Link href="/admin/orders">
                    <span className="admin-alert-list__badge admin-alert-list__badge--full">Full</span>
                    {fromDateKey(dateKey).toLocaleDateString(undefined, { month: "short", day: "numeric" })} is at
                    max capacity ({orderCountsByDate[dateKey] ?? 0}/{settings.maxOrdersPerDay})
                  </Link>
                </li>
              ))}
              {newOrders.length > 5 && (
                <li className="admin-alert-list__item admin-alert-list__item--more">
                  <Link href="/admin/orders">+{newOrders.length - 5} more new order{newOrders.length - 5 === 1 ? "" : "s"}</Link>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="admin-card">
          <h2 className="admin-card__title">Upcoming Pickups</h2>
          {upcomingPickups.length === 0 ? (
            <p style={{ color: "var(--text-soft)" }}>No pickups scheduled in the next {UPCOMING_WINDOW_DAYS} days.</p>
          ) : (
            <ul className="admin-alert-list">
              {upcomingPickups.slice(0, 6).map((o) => (
                <li key={o.id} className="admin-alert-list__item">
                  <Link href={`/admin/orders/${o.id}`}>
                    {fromDateKey(o.pickupDate!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {o.pickupTime ? ` · ${formatTimeLabel(o.pickupTime)}` : ""} — {o.customerName}
                  </Link>
                </li>
              ))}
              {upcomingPickups.length > 6 && (
                <li className="admin-alert-list__item admin-alert-list__item--more">
                  <Link href="/admin/orders">+{upcomingPickups.length - 6} more</Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Recent Orders</h2>
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
            {recentOrders.map((o) => (
              <tr key={o.id} className={o.status === "archived" ? "is-inactive" : ""}>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>{o.customerName}</td>
                <td>{o.designName ?? "Custom Cake"}</td>
                <td>{formatCents(o.totalPriceCents)}</td>
                <td style={{ textTransform: "capitalize" }}>{o.status}</td>
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="admin-btn-sm admin-btn-sm--ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
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
