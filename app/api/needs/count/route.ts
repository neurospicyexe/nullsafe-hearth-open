import { NextResponse } from "next/server";

// Count of items waiting on Principal (tab badge). Server-bearer proxy to Halseth.
export async function GET() {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  if (!secret) return NextResponse.json({ error: "HALSETH_SECRET not set" }, { status: 500 });

  try {
    const upstream = await fetch(`${base}/principal/needs/count`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) return NextResponse.json({ error: "Halseth error" }, { status: 502 });
    return NextResponse.json(await upstream.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
