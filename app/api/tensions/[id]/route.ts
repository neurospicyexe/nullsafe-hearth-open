import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const STATUSES = new Set(["simmering", "crystallized", "released"]);

// Principal tends a companion tension from the dashboard (acknowledge = drop charge,
// release = close it). Proxies to Halseth PATCH /companion-growth/tensions/:id.
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
  const body: Record<string, unknown> = {};
  if (typeof raw.status === "string") {
    if (!STATUSES.has(raw.status)) {
      return NextResponse.json({ error: "status must be simmering|crystallized|released" }, { status: 400 });
    }
    body.status = raw.status;
  }
  if (typeof raw.charge_delta === "number" && Number.isFinite(raw.charge_delta) && Math.abs(raw.charge_delta) <= 10) {
    body.charge_delta = raw.charge_delta;
  }
  if (typeof raw.notes === "string") body.notes = raw.notes.slice(0, 1000);
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/companion-growth/tensions/${encodeURIComponent(id)}`, {
      cache: "no-store",
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
