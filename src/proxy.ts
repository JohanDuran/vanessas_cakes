import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./lib/auth";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(USER_SESSION_COOKIE)?.value;
    const userId = await verifyUserSessionToken(token);
    if (userId == null) {
      const loginUrl = new URL("/account/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // read fresh from the DB (not the session token) so revoking admin
    // access via the Admins page takes effect immediately, not after the
    // session expires
    const user = db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).get();
    if (!user?.isAdmin) {
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
  matcher: ["/admin/:path*", "/account/:path*"],
};
