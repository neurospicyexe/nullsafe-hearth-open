import { NextRequest, NextResponse } from "next/server";
import { safeCompare } from "@/lib/timing-safe";

// Companion-accessible house update — authenticated with HALSETH_SECRET Bearer token.
// Exempted from dashboard cookie middleware so companions can call it during sessions.
// Exposes: love_meter (absolute or delta), current_room, spoon_count, companion_mood.

export async function POST(request: NextRequest) {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const auth = request.headers.get("Authorization") ?? "";
  if (!safeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const body: Record<string, unknown> = {};

  // love_meter: absolute or delta from current
  if (typeof raw.love_meter === "number") {
    body.love_meter = Math.min(100, Math.max(0, Math.round(raw.love_meter)));
  } else if (typeof raw.delta === "number") {
    try {
      const presRes = await fetch(`${base}/presence`, {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (presRes.ok) {
        const pres = await presRes.json();
        const current = pres?.house?.love_meter ?? 50;
        body.love_meter = Math.min(100, Math.max(0, Math.round(current + raw.delta)));
      }
    } catch {
      return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
    }
  }

  if (typeof raw.current_room === "string" && raw.current_room.trim()) {
    body.current_room = raw.current_room.trim().slice(0, 50);
  }

  if (typeof raw.spoon_count === "number") {
    body.spoon_count = Math.min(20, Math.max(0, Math.round(raw.spoon_count)));
  }

  if (typeof raw.companion_mood === "string" && raw.companion_mood.trim()) {
    body.companion_mood = raw.companion_mood.trim().slice(0, 100);
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one: love_meter, delta, current_room, spoon_count, companion_mood" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${base}/house`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return NextResponse.json({ error: "Request failed" }, { status: res.status });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
