import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
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

  // Allowlist: only forward known fields that /bridge/act accepts
  const body: Record<string, unknown> = {};
  if (typeof r["action"] === "string") body["action"] = r["action"];
  if (typeof r["id"] === "string") body["id"] = r["id"];
  if (typeof r["status"] === "string") body["status"] = r["status"];

  try {
    const res = await fetch(`${base}/bridge/act`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    // Halseth sends bridge errors as plain text ("Not found or not shared"); res.json() threw
    // and every rejection surfaced as 502 "Halseth unreachable".
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: text || `HTTP ${res.status}` }; }
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
