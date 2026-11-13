import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  // Principal's journal is human_journal on Halseth (POST /journal). MIND_URL pointed at Brain,
  // archived 2026-07-29, and /mind/journal was never a Halseth route: every entry was lost.
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const r = raw as Record<string, unknown>;

  // Allowlist: only forward known journal fields
  const body: Record<string, unknown> = {};
  if (typeof r["entry"] === "string") body["entry"] = r["entry"];
  if (Array.isArray(r["tags"])) body["tags"] = (r["tags"] as unknown[]).filter((t) => typeof t === "string");

  try {
    const res = await fetch(`${base}/journal`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
