import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Defense in depth (2026-11-10): route handlers carry no auth of their own, so a middleware
// matcher gap (e.g. the static-extension exemption reaching `/api/x/zz.png`) exposed every
// mutating route. Every POST/PATCH/PUT/DELETE handler calls this first and returns the result
// when it is non-null. Reuses the middleware's HMAC cookie check (lib/session.ts), same
// fail-closed rule: no DASHBOARD_SECRET denies, except in `next dev`.

function cookieFromHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export async function requireSession(request?: Request): Promise<NextResponse | null> {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") return null;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let token: string | undefined;
  if (request) {
    token = cookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE);
  } else {
    try { token = (await cookies()).get(SESSION_COOKIE)?.value; } catch { token = undefined; }
  }
  if (token && (await verifySession(token, secret))) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
