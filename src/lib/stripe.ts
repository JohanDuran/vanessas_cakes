import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/** Lazily-constructed singleton — reading STRIPE_SECRET_KEY at call time (not
 *  module load time) so a missing key only breaks the payment path, not
 *  every route that happens to import this module (e.g. during build). */
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY env var is not set");
  cachedClient = new Stripe(key);
  return cachedClient;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET env var is not set");
  return secret;
}

/** Base URL used to build Stripe's success/cancel redirect targets — must be
 *  an absolute, publicly-reachable URL (Stripe redirects the customer's
 *  browser here directly), not derived from request headers since those can
 *  be spoofed behind a misconfigured proxy. */
export function getSiteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL env var is not set");
  return url.replace(/\/+$/, "");
}
