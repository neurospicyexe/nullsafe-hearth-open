// lib/safe-redirect.ts
//
// Sanitizes a post-login redirect target so it can only ever point back into
// this app. "//evil.com" is a protocol-relative URL browsers redirect
// off-site; "/\evil.com" does the same thing because the WHATWG URL parser
// treats "\" as "/" for special schemes (http/https), so it normalizes to
// "//evil.com" before the browser ever compares origins.

export function sanitizeRedirectTarget(raw: string | null): string {
  const from = raw ?? "/";
  return from.startsWith("/") && !from.startsWith("//") && !from.includes("\\") ? from : "/";
}
