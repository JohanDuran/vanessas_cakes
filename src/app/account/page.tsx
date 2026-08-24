import { redirect } from "next/navigation";
import { getCurrentUser, loadOrdersForUser } from "../../db/queries";
import { fromDateKey, formatTimeLabel } from "../../lib/availability";
import { formatCents } from "../../lib/pricing";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { logout } from "./actions";
import "./account.css";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?next=/account");

  const orders = await loadOrdersForUser(user.id);

  return (
    <>
      <Navbar />
      <main className="account-page">
        <div className="container account-page__inner">
          <div className="account-page__header">
            <div>
              <span className="section-eyebrow">My Account</span>
              <h1>Hi, {user.name}</h1>
              <p>{user.email}</p>
            </div>
            <form action={logout}>
              <button type="submit" className="btn btn-outline">
                Log Out
              </button>
            </form>
          </div>

          <h2>Order History</h2>
          {orders.length === 0 ? (
            <p className="account-page__empty">You haven&apos;t placed any orders yet.</p>
          ) : (
            <ul className="account-orders">
              {orders.map((order) => (
                <li key={order.id} className="account-orders__item">
                  <div className="account-orders__main">
                    <strong>{order.cakeNames.join(", ") || "Order"}</strong>
                    <span className="account-orders__date">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {order.pickupDate && order.pickupTime && (
                    <span className="account-orders__pickup">
                      Pickup {fromDateKey(order.pickupDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      at {formatTimeLabel(order.pickupTime)}
                    </span>
                  )}
                  <span className={`account-orders__status account-orders__status--${order.status}`}>
                    {order.status}
                  </span>
                  <strong className="account-orders__total">{formatCents(order.totalPriceCents)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
