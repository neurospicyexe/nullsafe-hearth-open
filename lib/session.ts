// lib/session.ts
//
// Stateless HMAC-SHA256 session token: payload is an issued-at timestamp + random
// id, signed with DASHBOARD_SECRET. The cookie no longer stores the secret itself
// (2026-07-11 audit, CRITICAL -- cookie theft used to hand over the permanent
// password). Built on Web Crypto (crypto.subtle) exclusively, never Node's `crypto`
// module: Next.js Middleware always runs on the Edge runtime, which has no Node
// `crypto` -- this same module is imported by both middleware.ts (Edge) and
// app/api/auth/route.ts (Node), so it must work in both without a runtime branch.
// crypto.subtle.verify() is itself a constant-time MAC comparison by spec, so no
// separate timing-safe-compare step is needed for the signature check.

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days -- matches the old cookie maxAge
const CLOCK_SKEW_TOLERANCE_MS = 60_000;

// ── The cookie (2026-10-27, home-screen app) ────────────────────────────────
// Principal's ask: open Hearth from the phone's home screen with FEWER steps, and sign in once. Two things
// broke that: the token expired 30 days from SIGN-IN no matter how often they used Hearth, and
// SameSite=strict drops the cookie on the first request whenever Hearth is opened from outside the site
// (a link in Discord or Telegram), which reads as "logged out" and lands on /login.
// Now: middleware re-issues the token once it is a day old (sliding), so daily use never expires and
// 30 days idle still does (a lost phone is still bounded); SameSite=lax, which keeps cross-site POSTs
// cookie-less (CSRF stays closed) but lets a top-level link arrive signed in. One definition here, used
// by the login route AND the middleware, so the two can never drift. Server-set and httpOnly on
// purpose: script-writable storage on iOS is capped at 7 days, a server-set httpOnly cookie is not.

export const SESSION_COOKIE = "hearth_session";
export const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: DEFAULT_MAX_AGE_MS / 1000,
  path: "/",
};

/** True when a token (already verified) is old enough that middleware should re-issue it. */
export function sessionNeedsRenewal(token: string, now: number = Date.now()): boolean {
  const issuedAt = Number(token.split(".")[0]);
  return Number.isFinite(issuedAt) && now - issuedAt > SESSION_RENEW_AFTER_MS;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(secret: string): Promise<string> {
  const payload = `${Date.now()}.${crypto.randomUUID()}`;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(sig)}`;
}

export async function verifySession(
  token: string | undefined | null,
  secret: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issuedAtRaw, nonce, sigB64Url] = parts;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;

  const now = Date.now();
  if (issuedAt > now + CLOCK_SKEW_TOLERANCE_MS) return false;
  if (now - issuedAt > maxAgeMs) return false;

  const sigBytes = fromBase64Url(sigB64Url ?? "");
  if (!sigBytes) return false;

  const key = await importKey(secret);
  const payload = `${issuedAtRaw}.${nonce}`;
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
}
