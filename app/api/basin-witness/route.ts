import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal's witness on a companion's basin revision (mig 0172). POST { id, decision: "witness" | "decline", note? }
// -> Halseth POST /mind/basins/:id/witness, which takes ADMIN_SECRET only (a companion token is 403).
// This route sits behind the dashboard session (middleware) and is the only holder of the secret.
const ID = /^[0-9a-f]{32}$/;

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  const raw = await request.json().catch(() => ({}));
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const decision = raw.decision;
  if (!ID.test(id) || (decision !== "witness" && decision !== "decline")) {
    return NextResponse.json({ error: "need id (32 hex) and decision (witness|decline)" }, { status: 400 });
  }
  const note = typeof raw.note === "string" ? raw.note.slice(0, 1000) : undefined;

  try {
    const res = await fetch(`${base}/mind/basins/${id}/witness`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ decision, note }),
      signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
