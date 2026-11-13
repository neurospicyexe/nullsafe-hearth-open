import { NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { safeCompare } from "@/lib/timing-safe";
import {
  isLoginBlocked,
  recordLoginFailure,
  clearLoginFailures,
  getClientKey,
  LOGIN_FAIL_WINDOW_S,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  // Brute-force brake (same semantics as Halseth's /oauth/authorize): after LOGIN_FAIL_LIMIT failed
  // passphrases from one IP, refuse even a correct one until 15 min pass with no further failure.
  const ip = getClientKey(request.headers);
  if (await isLoginBlocked(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(LOGIN_FAIL_WINDOW_S) } },
    );
  }

  let body: { secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body?.secret !== "string" || !safeCompare(body.secret, secret)) {
    await recordLoginFailure(ip);
    return NextResponse.json({ error: "Incorrect passphrase" }, { status: 401 });
  }

  await clearLoginFailures(ip);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, await signSession(secret), SESSION_COOKIE_OPTIONS);
  return response;
}
