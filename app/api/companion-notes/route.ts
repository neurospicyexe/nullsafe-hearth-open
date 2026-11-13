import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

function authHeaders(): Record<string, string> {
  const secret = process.env.HALSETH_SECRET;
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

export async function GET(request: NextRequest) {
  const base = process.env.HALSETH_URL;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const rawAgent = searchParams.get("agent");
  const VALID_AGENTS = new Set(["drevan", "cypher", "gaia"]);
  const agent = rawAgent && VALID_AGENTS.has(rawAgent) ? rawAgent : null;
  const url = agent
    ? `${base}/companion-notes?agent=${encodeURIComponent(agent)}&review_state=all`
    : `${base}/companion-notes?review_state=all`;

  try {
    const res = await fetch(url, { headers: authHeaders(), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return NextResponse.json({ error: "Request failed" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await request.json();
  const body = {
    agent:     typeof raw.agent     === "string" ? raw.agent     : undefined,
    note_text: typeof raw.note_text === "string" ? raw.note_text : undefined,
    tags:      Array.isArray(raw.tags)            ? raw.tags      : undefined,
    source:    "hearth",
  };
  try {
    // Halseth serves only GET /companion-notes (an alias of the journal read); writes land on
    // POST /companion-journal. Posting to /companion-notes 404'd, so the /mind form never saved.
    const res = await fetch(`${base}/companion-journal`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Pass Halseth's reason through (e.g. "note_text exceeds 4000 character limit").
      const detail = await res.json().catch(() => null) as { error?: string } | null;
      return NextResponse.json({ error: detail?.error ?? "Request failed" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
