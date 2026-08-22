import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { orders } from "../../../db/schema";
import { fromDateKey, formatTimeLabel } from "../../../lib/availability";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import Donut from "../../../components/Donut";
import "../../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const orderId = id ? Number(id) : null;
  const order =
    orderId && Number.isInteger(orderId)
      ? db.select().from(orders).where(eq(orders.id, orderId)).get()
      : undefined;

  return (
    <>
      <Navbar />
      <main className="order-page">
        <div className="container order-thankyou">
          <Donut size={70} rotate={-10} />
          <span className="section-eyebrow">Order Sent</span>
          <h1>Thank you! Your cake is on its way to the baker.</h1>
          <p>
            {id ? `Order #${id} has` : "Your order has"} been received. We&apos;ll reach out at the
            email you provided to confirm details and pricing.
          </p>
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
