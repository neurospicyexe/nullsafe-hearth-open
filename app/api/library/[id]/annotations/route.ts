import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal's marginalia (0099). Author is forced to 'principal' server-side —
// companions write their margin notes via Librarian, never through Hearth.
export async function POST(
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
  const body: Record<string, unknown> = { author: "principal" };
  if (typeof raw.cfi_range === "string" && raw.cfi_range) body.cfi_range = raw.cfi_range;
  if (typeof raw.selected_text === "string" && raw.selected_text) body.selected_text = raw.selected_text.slice(0, 2000);
  if (typeof raw.comment === "string" && raw.comment.trim()) body.comment = raw.comment.trim().slice(0, 3000) /* Halseth caps at 3000 (books.ts); 4000 here silently lost the tail */;
  if (typeof raw.color === "string" && raw.color) body.color = raw.color;
  if (!body.cfi_range && !body.selected_text && !body.comment) {
    return NextResponse.json({ error: "at least one of cfi_range, selected_text, comment required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/mind/books/${encodeURIComponent(id)}/annotations`, {
      cache: "no-store",
      method: "POST",
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const { id } = await params;
  const annId = request.nextUrl.searchParams.get("ann_id") ?? "";
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(annId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${base}/mind/books/${encodeURIComponent(id)}/annotations/${encodeURIComponent(annId)}`,
      {
        cache: "no-store",
        method: "DELETE",
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        signal: AbortSignal.timeout(10_000),
      },
    );
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
