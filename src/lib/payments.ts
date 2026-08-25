import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../db";
import { orders, cartItems } from "../db/schema";
import { getStripe, getSiteUrl } from "./stripe";
import { formatCents } from "./pricing";

/** How long a customer has to complete Stripe Checkout before the session
 *  (and the pickup slot the pending order is holding) is released. Stripe
 *  allows 30min-24h; an hour is generous for entering card details without
 *  tying up a pickup slot all day over an abandoned checkout. */
const CHECKOUT_SESSION_TTL_SECONDS = 60 * 60;

export type PaymentLineItem = { name: string; priceCents: number };
export type PaymentPlan = "full" | "deposit";

/** Creates a Stripe Checkout Session for an already-created, already-priced
 *  order (see submitCart) and records the session id on it. The order's own
 *  totalPriceCents/amountDueCents — computed server-side from trusted catalog
 *  data, never from client input — are what's actually charged; `items` only
 *  controls how a full-payment charge is itemized on Stripe's page and
 *  receipt. A deposit charge can't be itemized per cake (each cake's full
 *  price would overstate what's being charged today), so it collapses to one
 *  line item for the deposit amount instead. */
export async function createCheckoutSessionForOrder(params: {
  orderId: number;
  customerEmail: string;
  items: PaymentLineItem[];
  paymentPlan: PaymentPlan;
  amountDueCents: number;
  totalPriceCents: number;
}): Promise<Stripe.Checkout.Session> {
  const { orderId, customerEmail, items, paymentPlan, amountDueCents, totalPriceCents } = params;
  const stripe = getStripe();
  const siteUrl = getSiteUrl();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    paymentPlan === "deposit"
      ? [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountDueCents,
              product_data: {
                name: `50% Deposit — Order #${orderId} (total ${formatCents(totalPriceCents)})`,
              },
            },
          },
        ]
      : items.map((item) => ({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: item.priceCents,
            product_data: { name: item.name },
          },
        }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    client_reference_id: String(orderId),
    metadata: { orderId: String(orderId), paymentPlan, amountDueCents: String(amountDueCents) },
    line_items: lineItems,
    success_url: `${siteUrl}/order/thank-you?id=${orderId}`,
    cancel_url: `${siteUrl}/cart?payment=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
  });

  db.update(orders).set({ stripeCheckoutSessionId: session.id }).where(eq(orders.id, orderId)).run();

  return session;
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}

/** The only code path allowed to mark an order "paid" — called from the
 *  webhook handler AND, as a fallback in case that webhook is delayed or
 *  never arrives, from the thank-you page. Safe to call repeatedly with the
 *  same session (idempotent): a session that doesn't match this order, isn't
 *  actually paid yet, or was already recorded as paid is a no-op. Also
 *  re-checks the charged amount against the order's own trusted total before
 *  accepting it, as a last line of defense against a mismatched session. */
export function finalizeOrderPaymentFromSession(session: Stripe.Checkout.Session): void {
  const orderId = Number(session.client_reference_id ?? session.metadata?.orderId);
  if (!Number.isInteger(orderId)) return;

  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order || order.stripeCheckoutSessionId !== session.id) return;
  if (order.paymentStatus === "paid") return;
  // Stripe's fulfillment guidance: treat anything other than "unpaid" as
  // payable, not just "paid" — with delayed-notification payment methods
  // checkout.session.completed can fire while still unpaid, and gating on
  // exactly "paid" would also (harmlessly, but incorrectly) skip the
  // no_payment_required case a $0 session would report.
  if (session.payment_status === "unpaid") return;

  if (session.amount_total !== order.amountDueCents) {
    db.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, orderId)).run();
    return;
  }

  db.update(orders)
    .set({ paymentStatus: "paid", stripePaymentIntentId: paymentIntentId(session) })
    .where(eq(orders.id, orderId))
    .run();

  // only now — payment confirmed — drop whatever's left of the customer's
  // saved DB cart, mirroring the no-payment submitCart path
  if (order.userId) {
    db.delete(cartItems).where(eq(cartItems.userId, order.userId)).run();
  }
}

/** A Checkout Session's expiry (default ~1h, see above) fired without the
 *  customer completing payment — free up the pickup slot the pending order
 *  was holding. Never touches an order that's already paid. */
export function markOrderPaymentExpired(sessionId: string): void {
  db.update(orders)
    .set({ paymentStatus: "expired" })
    .where(and(eq(orders.stripeCheckoutSessionId, sessionId), eq(orders.paymentStatus, "pending")))
    .run();
}

/** An async payment method (e.g. a bank debit) ended up failing after the
 *  customer left Checkout having seemingly succeeded. */
export function markOrderPaymentFailed(sessionId: string): void {
  db.update(orders)
    .set({ paymentStatus: "failed" })
    .where(and(eq(orders.stripeCheckoutSessionId, sessionId), eq(orders.paymentStatus, "pending")))
    .run();
}
