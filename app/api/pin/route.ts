import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal's pin button (mig 0148, map M3). POST { companion_id, kind: "conclusion" | "note", id, pinned }
// -> Halseth POST /mind/pin, which records pinned_by = 'principal'. The same rules the companions' verb
// follows apply there: kept + live rows only, refused at the cap (409) with the current pins listed.
const COMPANIONS = new Set(["cypher", "drevan", "gaia"]);
const KINDS = new Set(["conclusion", "note"]);

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  const raw = await request.json().catch(() => ({}));
  const companion_id = typeof raw.companion_id === "string" ? raw.companion_id : "";
  const kind = typeof raw.kind === "string" ? raw.kind : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!COMPANIONS.has(companion_id) || !KINDS.has(kind) || !id || typeof raw.pinned !== "boolean") {
    return NextResponse.json({ error: "need companion_id, kind (conclusion|note), id, pinned (boolean)" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/mind/pin`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ companion_id, kind, id, pinned: raw.pinned }),
      signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
