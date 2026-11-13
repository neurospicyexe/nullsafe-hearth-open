import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  let res: Response;
  try {
    res = await fetch(`${base}/soma`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }

  if (!res.ok) return NextResponse.json({ error: "Halseth /soma failed" }, { status: res.status });
  // H11: validate upstream JSON before forwarding. Without these guards a malformed
  // 200 from Halseth (string body, non-object) would propagate raw to the client.
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return NextResponse.json({ error: "malformed Halseth response" }, { status: 502 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "malformed Halseth response" }, { status: 502 });
  }
  return NextResponse.json(payload);
}
