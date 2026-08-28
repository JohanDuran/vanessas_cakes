import { NextResponse, type NextRequest } from "next/server";
import { db } from "../../../db";
import { profiles } from "../../../db/schema";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSiteUrl } from "../../../lib/stripe";

function safeNext(next: string | null): string {
  return next && (next.startsWith("/account") || next.startsWith("/admin") || next.startsWith("/cart"))
    ? next
    : "/account";
}

/** Landing point for Supabase OAuth (Google) sign-in — Supabase redirects the
 *  browser here with a `code` once the provider confirms the user. Password
 *  signups get their profiles row from the signup Server Action (see
 *  ../../account/actions.ts); OAuth never goes through that action, so this
 *  is the equivalent step. onConflictDoNothing so a returning Google user's
 *  existing name/phone/marketing prefs aren't clobbered.
 *
 *  Redirects are built from SITE_URL, not `new URL(path, req.url)` — behind
 *  the Docker + Cloudflare Tunnel setup, req.url's origin resolves to the
 *  container's own hostname:PORT (Next's standalone server ignores Host /
 *  X-Forwarded-Host when building it), not the real public domain. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const siteUrl = getSiteUrl();

  if (!code) return NextResponse.redirect(`${siteUrl}/account/login?error=1`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) return NextResponse.redirect(`${siteUrl}/account/login?error=1`);

  const { id, email, user_metadata: metadata } = data.user;
  const name =
    (metadata?.full_name as string | undefined) ??
    (metadata?.name as string | undefined) ??
    email?.split("@")[0] ??
    "Customer";

  await db
    .insert(profiles)
    .values({ id, email: email ?? "", name })
    .onConflictDoNothing({ target: profiles.id });

  return NextResponse.redirect(`${siteUrl}${next}`);
}
