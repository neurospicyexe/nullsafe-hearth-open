import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Library upload ticket (2026-09-27). Book files no longer pass through this app: Vercel caps a
// function's request body at ~4.5 MB, and books are routinely bigger. The browser asks here for
// a short-lived ticket (this route is behind the dashboard cookie via middleware), then PUTs the
// file straight to Halseth's upload_url. The browser never sees HALSETH_SECRET.
export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  try {
    const res = await fetch(`${base}/mind/books/upload-ticket`, {
      method: "POST",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
