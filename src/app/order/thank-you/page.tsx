import Link from "next/link";
import { loadOrderWithItems } from "../../../db/queries";
import { fromDateKey, formatTimeLabel } from "../../../lib/availability";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import Donut from "../../../components/Donut";
import ClearCartOnMount from "../../../components/cart/ClearCartOnMount";
import "../../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const orderId = id ? Number(id) : null;
  const result = orderId && Number.isInteger(orderId) ? await loadOrderWithItems(orderId) : null;
  const order = result?.order;

  return (
    <>
      <Navbar />
      <ClearCartOnMount />
      <main className="order-page">
        <div className="container order-thankyou">
          <Donut size={70} rotate={-10} />
          <span className="section-eyebrow">Order Sent</span>
          <h1>Thank you! Your cake is on its way to the baker.</h1>
          <p>
            {id ? `Order #${id} has` : "Your order has"} been received. We&apos;ll reach out at the
            email you provided to confirm details and pricing.
          </p>
          {result && result.items.length > 0 && (
            <p className="order-thankyou__pickup">
              {result.items.length === 1 ? "Cake" : "Cakes"}:{" "}
              <strong>{result.items.map((i) => i.designName ?? "Custom Cake Quote").join(", ")}</strong>
            </p>
          )}
          {order?.pickupDate && order.pickupTime && (
            <p className="order-thankyou__pickup">
              Pickup scheduled for{" "}
              <strong>
                {fromDateKey(order.pickupDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                at {formatTimeLabel(order.pickupTime)}
              </strong>
            </p>
          )}
          <Link href="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
