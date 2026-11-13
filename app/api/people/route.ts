import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal's people list (Halseth mig 0149, map M5).
//   POST { action: "add", label, match_names?: string[], kind?, note? } -> Halseth POST /mind/people
//   POST { action: "archive", id }                                      -> POST /mind/people/:id/archive
//   POST { action: "update", id, match_names?, shares_name_with?, + the 0163 fields } -> POST /mind/people/:id
// 0163 fields: system_of, relation, frame_line, discord_user_id, pk_system (string = set, null = clear).
// update also forwards `note` (string or null) when sent; Halseth ignores it until updatePerson accepts it.
// Halseth records added_by = 'principal'. Links appear at the next graph rebuild.
const KINDS = new Set(["self", "person", "pet", "other"]);
const FRAME_KEYS = ["system_of", "relation", "frame_line", "discord_user_id", "pk_system"] as const;
/** Only string or null passes; absent stays absent (unchanged on update). Halseth validates the values. */
function frameFields(raw: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of FRAME_KEYS) if (raw[k] === null || typeof raw[k] === "string") out[k] = raw[k] as string | null;
  return out;
}

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
    path = `/mind/people/${raw.id}/archive`;
    body = {};
  } else if (raw.action === "add" && typeof raw.label === "string" && raw.label.trim()) {
    path = "/mind/people";
    body = {
      label: raw.label.trim(),
      match_names: Array.isArray(raw.match_names) ? raw.match_names.filter((x: unknown) => typeof x === "string") : [],
      kind: typeof raw.kind === "string" && KINDS.has(raw.kind) ? raw.kind : "person",
      note: typeof raw.note === "string" ? raw.note : null,
      shares_name_with: typeof raw.shares_name_with === "string" ? raw.shares_name_with : null,
      ...frameFields(raw),
    };
  } else if (raw.action === "update" && typeof raw.id === "string" && /^[\w-]+$/.test(raw.id)) {
    path = `/mind/people/${raw.id}`;
    const upd: Record<string, unknown> = {};
    if (Array.isArray(raw.match_names)) upd.match_names = raw.match_names.filter((x: unknown) => typeof x === "string");
    if (raw.shares_name_with === null || typeof raw.shares_name_with === "string") upd.shares_name_with = raw.shares_name_with;
    if (raw.note === null || typeof raw.note === "string") upd.note = raw.note;
    Object.assign(upd, frameFields(raw));
    body = upd;
  } else {
    return NextResponse.json({ error: 'need { action: "add", label }, { action: "update", id } or { action: "archive", id }' }, { status: 400 });
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
