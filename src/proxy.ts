import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { withDbRetry } from "./db/retry";
import { siteSettings, profiles } from "./db/schema";
import { createSupabaseMiddlewareClient } from "./lib/supabase/middleware";

// Shorter budget than page-data reads (src/db/retry.ts's default) — this
// runs in front of every request, so during a real outage we'd rather fail
// fast to the maintenance page than make every navigation hang for seconds.
const PROXY_RETRY_BUDGET_MS = 3000;

// Proxy runs ahead of page rendering — it has no error.tsx/global-error.tsx
// to fall back on, so an uncaught throw here would surface as a raw 500
// instead of the friendly maintenance page. If the DB is still unreachable
// after retrying, fail to the safe default (deny elevated access / assume
// not in maintenance) and let the page itself — which does have an error
// boundary — handle a real outage.
async function isAdminUser(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const profile = await withDbRetry(
      () =>
        db
          .select({ isAdmin: profiles.isAdmin })
          .from(profiles)
          .where(eq(profiles.id, userId))
          .then((r) => r[0]),
      PROXY_RETRY_BUDGET_MS,
    );
    return profile?.isAdmin ?? false;
  } catch (err) {
    console.error("[proxy] isAdminUser failed, defaulting to non-admin:", err);
    return false;
  }
}

// Hides the site from everyone except admins while deploying/testing in
// production. Visitors get the static /maintenance page instead; admins (and
// the login page they need to get there) pass through untouched. Toggled at
// runtime from the admin Settings page (site_settings row); MAINTENANCE_MODE
// env var is an extra force-on switch for use before that row/DB is reachable.
const MAINTENANCE_BYPASS_PATHS = new Set(["/maintenance", "/account/login", "/auth/callback"]);

async function isMaintenanceModeOn(): Promise<boolean> {
  if (process.env.MAINTENANCE_MODE === "true") return true;
  try {
    const row = await withDbRetry(
      () => db.select({ maintenanceMode: siteSettings.maintenanceMode }).from(siteSettings).limit(1).then((r) => r[0]),
      PROXY_RETRY_BUDGET_MS,
    );
    return row?.maintenanceMode ?? false;
  } catch (err) {
    console.error("[proxy] isMaintenanceModeOn failed, defaulting to off:", err);
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const { supabase, getResponse } = createSupabaseMiddlewareClient(req);
  // getUser() (not getSession()) — it revalidates the token against Supabase
  // Auth instead of just trusting whatever's in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ((await isMaintenanceModeOn()) && !MAINTENANCE_BYPASS_PATHS.has(pathname)) {
    if (!(await isAdminUser(user?.id))) {
      return NextResponse.rewrite(new URL("/maintenance", req.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const loginUrl = new URL("/account/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!(await isAdminUser(user.id))) {
      return NextResponse.redirect(new URL("/account", req.url));
    }
    return getResponse();
  }

  if (pathname.startsWith("/account")) {
    if (pathname === "/account/login" || pathname === "/account/signup") return getResponse();

    if (!user) {
      const loginUrl = new URL("/account/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return getResponse();
  }

  return getResponse();
}

export const config = {
  // Runs on every page route so maintenance mode can gate the whole app;
  // excludes API routes, Next internals, and any path with a file extension
  // (favicon.ico, logo.png, robots.txt, etc).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
