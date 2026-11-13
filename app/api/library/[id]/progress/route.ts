import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Reading-position upsert (0099). Partial by design — the reader only sends
// what changed (current_cfi, current_chapter, progress_percent, finished).
export async function PUT(
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
  if (typeof raw.current_cfi === "string") body.current_cfi = raw.current_cfi;
  if (typeof raw.current_chapter === "string") body.current_chapter = raw.current_chapter;
  if (typeof raw.progress_percent === "number" && Number.isFinite(raw.progress_percent)) {
    body.progress_percent = raw.progress_percent;
  }
  if (typeof raw.finished === "boolean") body.finished = raw.finished;
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/mind/books/${encodeURIComponent(id)}/progress`, {
      cache: "no-store",
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
