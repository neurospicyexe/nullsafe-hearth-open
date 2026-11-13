import { NextRequest, NextResponse } from "next/server";
import { biometricsPostBody } from "@/lib/biometrics-body";
import { requireSession } from "@/lib/require-session";

export async function GET() {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  try {
    const res = await fetch(`${base}/biometrics`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  if (!secret) return NextResponse.json({ error: "HALSETH_SECRET not set" }, { status: 500 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Allowlist: only forward known BiometricSnapshot fields (plus the client row id).
  const body = biometricsPostBody(raw as Record<string, unknown>);

  try {
    const upstream = await fetch(`${base}/biometrics`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await upstream.json();

    // Keep the dashboard header live: a logged spoon count also updates house
    // state. Best-effort — the snapshot is the record of truth, house is a mirror.
    // Clamped 0-12 to match the worker's snapshot-side clamp (house POST doesn't validate).
    // A repeat POST of an id Halseth already has is a no-op (200, duplicate): mirroring it again could
    // overwrite a value the check-in was amended to since.
    const duplicate = (data as { duplicate?: unknown } | null)?.duplicate === true;
    if (upstream.ok && !duplicate && typeof body.spoons === "number") {
      const spoonCount = Math.min(12, Math.max(0, Math.round(body.spoons)));
      await fetch(`${base}/house`, {
        cache: "no-store",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ spoon_count: spoonCount }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
