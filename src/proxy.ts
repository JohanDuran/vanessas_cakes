import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, USER_SESSION_COOKIE, verifySessionToken, verifyUserSessionToken } from "./lib/auth";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();

    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const authed = await verifySessionToken(token);
    if (!authed) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
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
