import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal addressing a basin pressure reading from the dashboard (B2).
//   confirm -> real growth; re-baselines the identity anchor.
//   dismiss -> measurement noise; clears the warning WITHOUT re-baselining.
// Confirm/dismiss are Principal's call here; companions do it in-voice via Librarian.
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await request.json();
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const action = raw.action === "confirm" || raw.action === "dismiss" ? raw.action : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "action must be confirm or dismiss" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${base}/companion-growth/basin-history/${encodeURIComponent(id)}/${action}`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: (body as { error?: string }).error ?? "Request failed" }, { status: res.status });
  }
  return NextResponse.json(body);
}
