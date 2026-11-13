import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Records that Principal opened Gaia's garden. Halseth counts it as being seen at the light tier (her words:
// "ground is seen by being stood on, not answered"), once a day at most. Admin token only upstream.
export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  if (!secret) return NextResponse.json({ error: "HALSETH_SECRET not set" }, { status: 500 });

  try {
    const upstream = await fetch(`${base}/mind/garden/gaia/looked`, {
      cache: "no-store",
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
