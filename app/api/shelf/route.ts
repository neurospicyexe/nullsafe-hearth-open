import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal manages his obsession shelf from the dashboard (0094). POST adds an item;
// PATCH archives/edits one (body carries the id). Triad reactions come through the worker.
function halseth() {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  return { base, secret };
}

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const { base, secret } = halseth();
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  const raw = await request.json().catch(() => ({}));
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const body = { title, kind: typeof raw.kind === "string" ? raw.kind : "other", note: typeof raw.note === "string" ? raw.note : null };

  try {
    const res = await fetch(`${base}/mind/shelf`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const { base, secret } = halseth();
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  const raw = await request.json().catch(() => ({}));
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (raw.status === "active" || raw.status === "archived") patch.status = raw.status;
  if (typeof raw.note === "string") patch.note = raw.note;
  if (typeof raw.title === "string" && raw.title.trim()) patch.title = raw.title.trim();

  try {
    const res = await fetch(`${base}/mind/shelf/${id}`, {
      cache: "no-store",
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
