import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@markethub/shared";

/**
 * Browsing shops is public; only the business area needs an account.
 * Sends users without a session cookie to /login. The backends do the real
 * token verification; this is only a UX redirect.
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.has(AUTH_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/mis-tiendas/:path*"],
};
