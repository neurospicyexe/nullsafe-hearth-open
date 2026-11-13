import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal keeps or drops one imp-tray draft from the dashboard (mig 0132).
// Proxies to Halseth POST /admin/tray/review; the admin secret never leaves the server.
// Body: { agent, kind: "journal"|"note", id, decision: "kept"|"dropped", content? }

const VALID_AGENTS = new Set(["drevan", "cypher", "gaia"]);
const MAX_CONTENT_LENGTH = 8000;

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await request.json().catch(() => ({}));
  const agent = typeof raw.agent === "string" && VALID_AGENTS.has(raw.agent) ? raw.agent : "";
  const kind = raw.kind === "journal" || raw.kind === "note" ? raw.kind : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const decision = raw.decision === "kept" || raw.decision === "dropped" ? raw.decision : "";
  const content =
    decision === "kept" && typeof raw.content === "string" && raw.content.trim()
      ? raw.content.trim().slice(0, MAX_CONTENT_LENGTH)
      : undefined;

  if (!agent) return NextResponse.json({ error: "agent must be cypher, drevan, or gaia" }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "kind must be 'journal' or 'note'" }, { status: 400 });
  if (!/^[a-zA-Z0-9_-]{8,}$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (!decision) return NextResponse.json({ error: "decision must be 'kept' or 'dropped'" }, { status: 400 });

  try {
    const res = await fetch(`${base}/admin/tray/review`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ agent, kind, id, decision, ...(content ? { content } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
