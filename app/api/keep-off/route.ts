import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal's keep-off list (Halseth mig 0152): names that never become a dot on the memory map.
//   POST { action: "add", term, note? } -> Halseth POST /mind/keep-off
//   POST { action: "archive", id }      -> POST /mind/keep-off/:id/archive
// Halseth takes the admin token only for this list, which is the HALSETH_SECRET held here.
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  const raw = await request.json().catch(() => ({}));
  const headers = { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) };

  let path: string;
  let body: unknown;
  if (raw.action === "archive" && typeof raw.id === "string" && /^[\w-]+$/.test(raw.id)) {
    path = `/mind/keep-off/${raw.id}/archive`;
    body = {};
  } else if (raw.action === "add" && typeof raw.term === "string" && raw.term.trim()) {
    path = "/mind/keep-off";
    body = { term: raw.term.trim(), note: typeof raw.note === "string" ? raw.note : null };
  } else {
    return NextResponse.json({ error: 'need { action: "add", term } or { action: "archive", id }' }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}${path}`, {
      cache: "no-store", method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
