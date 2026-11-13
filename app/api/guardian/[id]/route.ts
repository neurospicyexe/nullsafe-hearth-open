import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal acknowledges/resolves a guardian flag from the dashboard.
// Proxies to Halseth PATCH /mind/guardian/flags/:id.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const raw = await request.json().catch(() => ({}));
  const status = raw.status === "acknowledged" || raw.status === "resolved" ? raw.status : "";
  if (!status) {
    return NextResponse.json({ error: "status must be 'acknowledged' or 'resolved'" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/mind/guardian/flags/${encodeURIComponent(id)}`, {
      cache: "no-store",
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
