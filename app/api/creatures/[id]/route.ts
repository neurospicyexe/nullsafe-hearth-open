import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const ACTIONS = new Set(["feed", "play", "talk", "give"]);

// Principal tends a creature from the dashboard.
// Proxies to Halseth POST /mind/creatures/:id/interact with actor=principal.
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
  const action = typeof raw.action === "string" ? raw.action.trim().toLowerCase() : "";
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "action must be feed, play, talk, or give" }, { status: 400 });
  }
  const note = typeof raw.note === "string" ? raw.note.slice(0, 500) : undefined;

  try {
    const res = await fetch(`${base}/mind/creatures/${encodeURIComponent(id)}/interact`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      // R28: Principal tending from Hearth is a tend by hand (weight 1.0); with no via Halseth reads it as autonomous.
      body: JSON.stringify({ actor: "principal", action, via: "hand", ...(note ? { note } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
