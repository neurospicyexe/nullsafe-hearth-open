# Security — Hearth

## Reporting a Vulnerability

If you find a security vulnerability in this code, please report it privately before public disclosure. Open a GitHub security advisory on this repository or contact the maintainer directly. Do not post exploit details publicly until there has been a chance to patch. See the root [SECURITY.md](../SECURITY.md) for full context on this project's security posture.

---

Hearth is a read-only dashboard — it reads from Halseth and displays data. It does not store companion data itself.

See root `SECURITY.md` at `C:\dev\Bigger_Better_Halseth\SECURITY.md` for the full architecture overview and 2FA guidance.

---

## What's Protected Here

Hearth renders Halseth data in a browser. The risk here is primarily access to the dashboard itself — if someone loads the URL and your Halseth credentials are set, they can see companion state.

**If Hearth is deployed publicly:** Consider adding authentication to the Next.js app (e.g., middleware that checks a password) if you don't want the dashboard visible to anyone with the URL.

---

## Secrets Used by This Service

| Secret | Where | Risk if leaked |
|--------|-------|---------------|
| `HALSETH_URL` | Vercel environment variables | Exposes the Halseth endpoint (still requires HALSETH_SECRET to use) |
| `HALSETH_SECRET` | Vercel environment variables | Full read access to all Halseth data from Hearth's server-side routes |

These are set in the Vercel dashboard (Settings → Environment Variables) and are never committed to code.

---

## Vercel Deployment Security

- Vercel encrypts environment variables at rest
- All Hearth routes use `cache: 'no-store'` — data is never cached at the edge (no stale sensitive data sitting in CDN)
- Server-side fetches to Halseth happen on Vercel's servers, not in the browser — `HALSETH_SECRET` is never exposed to the client

---

## If HALSETH_SECRET Is Compromised

See Halseth's `SECURITY.md` — rotating the secret there requires updating it here too via the Vercel dashboard.
