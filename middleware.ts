import { NextRequest, NextResponse } from "next/server";
import {
  verifySession, signSession, sessionNeedsRenewal, SESSION_COOKIE, SESSION_COOKIE_OPTIONS,
} from "@/lib/session";

export async function middleware(request: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;

  // Missing secret now denies (fail-closed, 2026-07-12) -- previously allowed all
  // requests through, which meant a single missing env var silently opened the
  // whole dashboard. Login itself already 500s without a secret configured
  // (app/api/auth/route.ts), so this doesn't newly break anything reachable in
  // production. Dev-only carve-out restores the pre-hardening local convenience
  // (Next.js forces NODE_ENV=production on build/start; Vercel is always
  // production) -- without it, a fresh local clone with no secret configured
  // hits a dead end (redirect to /login, whose POST also 500s with no escape).
  if (!secret) {
    if (process.env.NODE_ENV === "development") return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session && await verifySession(session, secret)) {
    const res = NextResponse.next();
    // Sliding session (2026-10-27): a token over a day old is re-issued on the way through, so the
    // home-screen app stays signed in while it is used and only a month of silence signs it out.
    if (sessionNeedsRenewal(session)) {
      res.cookies.set(SESSION_COOKIE, await signSession(secret), SESSION_COOKIE_OPTIONS);
    }
    return res;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect all routes except login page, auth API, Next internals, and static files.
  // api/companion/* uses its own HALSETH_SECRET Bearer auth -- no cookie needed.
  // Every exclusion must end at `$` or `/`: a bare `api/companion` also matched `api/companion-notes`
  // and left every companion journal public until 2026-10-29 (pinned by lib/middleware-matcher.test.ts).
  // The static-extension exemption never applies under api/ (2026-11-10): `PATCH /api/biometrics/zz.png`
  // used to skip auth entirely and reach the handler.
  // Home-screen install files are public on purpose (2026-10-27): iOS fetches the manifest and the
  // apple-touch-icon without the session, and a redirect to /login there gave a screenshot instead of
  // an icon. The service worker and its offline page must be public too, or `cache.addAll` caches the
  // login page AS the offline page. None of these carry any data.
  matcher: [
    "/((?!api/auth$|api/companion/|login$|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest$|icon$|apple-icon$|pwa-icon/|sw\\.js$|offline\\.html$|(?!api/).*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
