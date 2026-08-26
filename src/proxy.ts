import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { siteSettings, users } from "./db/schema";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./lib/auth";

// read fresh from the DB (not the session token) so revoking admin access
// via the Admins page takes effect immediately, not after the session expires
async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(USER_SESSION_COOKIE)?.value;
  const userId = await verifyUserSessionToken(token);
  if (userId == null) return false;
  const user = db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).get();
  return user?.isAdmin ?? false;
}

// Hides the site from everyone except admins while deploying/testing in
// production. Visitors get the static /maintenance page instead; admins (and
// the login page they need to get there) pass through untouched. Toggled at
// runtime from the admin Settings page (site_settings row); MAINTENANCE_MODE
// env var is an extra force-on switch for use before that row/DB is reachable.
const MAINTENANCE_BYPASS_PATHS = new Set(["/maintenance", "/account/login"]);

function isMaintenanceModeOn(): boolean {
  if (process.env.MAINTENANCE_MODE === "true") return true;
  const row = db.select({ maintenanceMode: siteSettings.maintenanceMode }).from(siteSettings).limit(1).get();
  return row?.maintenanceMode ?? false;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isMaintenanceModeOn() && !MAINTENANCE_BYPASS_PATHS.has(pathname)) {
    if (!(await isAdminRequest(req))) {
      return NextResponse.rewrite(new URL("/maintenance", req.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(USER_SESSION_COOKIE)?.value;
    const userId = await verifyUserSessionToken(token);
    if (userId == null) {
      const loginUrl = new URL("/account/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!(await isAdminRequest(req))) {
      return NextResponse.redirect(new URL("/account", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
    if (pathname === "/account/login" || pathname === "/account/signup") return NextResponse.next();

    const token = req.cookies.get(USER_SESSION_COOKIE)?.value;
    const userId = await verifyUserSessionToken(token);
    if (userId == null) {
      const loginUrl = new URL("/account/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Runs on every page route so maintenance mode can gate the whole app;
  // excludes API routes, Next internals, and any path with a file extension
  // (favicon.ico, logo.png, robots.txt, uploaded images, etc).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
