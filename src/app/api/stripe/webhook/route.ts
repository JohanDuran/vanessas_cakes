import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getWebhookSecret } from "../../../../lib/stripe";
import {
  finalizeOrderPaymentFromSession,
  markOrderPaymentExpired,
  markOrderPaymentFailed,
} from "../../../../lib/payments";

export const dynamic = "force-dynamic";

/** Stripe's source of truth for "did this order actually get paid" — the
 *  only inputs this route trusts are the raw body + signature, verified
 *  against STRIPE_WEBHOOK_SECRET; nothing here is driven by what the
 *  customer's browser reports. See src/lib/payments.ts for the idempotent
 *  order-update logic shared with the thank-you page's fallback check. */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing stripe-signature header", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      finalizeOrderPaymentFromSession(session);
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      markOrderPaymentFailed(session.id);
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      markOrderPaymentExpired(session.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
