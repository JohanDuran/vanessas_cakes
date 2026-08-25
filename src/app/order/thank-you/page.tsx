import Link from "next/link";
import { loadOrderWithItems } from "../../../db/queries";
import { fromDateKey, formatTimeLabel } from "../../../lib/availability";
import { formatCents } from "../../../lib/pricing";
import { getStripe } from "../../../lib/stripe";
import { finalizeOrderPaymentFromSession } from "../../../lib/payments";
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
  let result = orderId && Number.isInteger(orderId) ? await loadOrderWithItems(orderId) : null;

  // Normally the webhook (src/app/api/stripe/webhook) has already marked the
  // order paid by the time Stripe redirects the customer back here, but
  // webhook delivery isn't instant or guaranteed — so this page double-checks
  // directly with Stripe as a fallback, using the same idempotent finalize
  // logic the webhook uses. Never trusts the redirect itself as proof of payment.
  if (result?.order.paymentStatus === "pending" && result.order.stripeCheckoutSessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(result.order.stripeCheckoutSessionId);
      finalizeOrderPaymentFromSession(session);
      result = await loadOrderWithItems(orderId!);
    } catch {
      // Stripe unreachable/misconfigured — fall through and show the
      // "confirming" state below; the webhook will still resolve this later.
    }
  }

  const order = result?.order;
  const paymentStillPending = order?.paymentStatus === "pending";
  const paymentFailed = order?.paymentStatus === "failed" || order?.paymentStatus === "expired";

  return (
    <>
      <Navbar />
      {paymentStillPending && <meta httpEquiv="refresh" content="3" />}
      <ClearCartOnMount />
      <main className="order-page">
        <div className="container order-thankyou">
          <Donut size={70} rotate={-10} />
          <span className="section-eyebrow">
            {paymentStillPending ? "Confirming Payment" : paymentFailed ? "Payment Issue" : "Order Sent"}
          </span>
          <h1>
            {paymentStillPending
              ? "Confirming your payment…"
              : paymentFailed
                ? "We couldn't confirm your payment."
                : order?.paymentStatus === "paid"
                  ? "Thank you! Your payment is confirmed."
                  : "Thank you! Your cake is on its way to the baker."}
          </h1>
          <p>
            {paymentStillPending
              ? "This page will update automatically in a few seconds."
              : paymentFailed
                ? "Your card wasn't charged and this order hasn't been sent to the baker. Please return to your cart and try again, or contact us if you were charged."
                : order?.paymentStatus === "paid"
                  ? `${id ? `Order #${id}` : "Your order"} is paid in full and on its way to the baker.`
                  : `${id ? `Order #${id} has` : "Your order has"} been received. We’ll reach out at the email you provided to confirm details and pricing.`}
          </p>
          {paymentFailed && (
            <Link href="/cart" className="btn btn-primary">
              Back to Cart
            </Link>
          )}
          {order?.paymentStatus === "paid" && (
            <p className="order-thankyou__pickup">
              Amount charged: <strong>{formatCents(order.totalPriceCents)}</strong>
            </p>
          )}
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
