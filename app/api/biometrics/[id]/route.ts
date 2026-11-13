import { NextRequest, NextResponse } from "next/server";
import { biometricsPatchBody } from "@/lib/biometrics-body";
import { isValidId } from "@/lib/valid-id";
import { requireSession } from "@/lib/require-session";

type Ctx = { params: Promise<{ id: string }> };

function config() {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return { error: NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 }) };
  if (!secret) return { error: NextResponse.json({ error: "HALSETH_SECRET not set" }, { status: 500 }) };
  return { base, secret };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const cfg = config();
  if ("error" in cfg) return cfg.error;
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const r = raw as Record<string, unknown>;

  // Allowlist: only the fields a check-in can be amended with (spoons, mood, energy, pain, pain_where, notes).
  const body = biometricsPatchBody(r);

  try {
    const upstream = await fetch(`${cfg.base}/biometrics/${encodeURIComponent(id)}`, {
      cache: "no-store",
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.secret}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();

    // Same house mirror as POST: best-effort, clamped 0-12.
    if (upstream.ok && typeof body.spoons === "number") {
      const spoonCount = Math.min(12, Math.max(0, Math.round(body.spoons)));
      await fetch(`${cfg.base}/house`, {
        cache: "no-store",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.secret}` },
        body: JSON.stringify({ spoon_count: spoonCount }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}

// After an undo, /house spoon_count still shows the removed reading. Point it back at the newest
// remaining check-in that has spoons, as POST/PATCH mirror forward. Best-effort: the snapshot table
// is the record of truth, house is a mirror, and nothing here may fail the DELETE.
async function remirrorHouseSpoons(base: string, secret: string): Promise<void> {
  try {
    const res = await fetch(`${base}/biometrics?limit=30`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return;
    const row = rows.find((x) => typeof (x as { spoons?: unknown })?.spoons === "number") as { spoons: number } | undefined;
    if (!row) return;
    await fetch(`${base}/house`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ spoon_count: Math.min(12, Math.max(0, Math.round(row.spoons))) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // best-effort
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await requireSession(_req);
  if (denied) return denied;
  const cfg = config();
  if ("error" in cfg) return cfg.error;
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const upstream = await fetch(`${cfg.base}/biometrics/${encodeURIComponent(id)}`, {
      cache: "no-store",
      method: "DELETE",
      headers: { Authorization: `Bearer ${cfg.secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();
    if (upstream.ok) await remirrorHouseSpoons(cfg.base, cfg.secret);
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
