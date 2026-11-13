import { NextRequest, NextResponse } from "next/server";
import { parseCompanionId } from "@/lib/companion-page";
import { requireSession } from "@/lib/require-session";

// Records that Principal looked at a companion's page, so "Since you last looked" follows them across devices.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSession(_req);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  if (!secret) return NextResponse.json({ error: "HALSETH_SECRET not set" }, { status: 500 });

  const id = parseCompanionId((await params).id);
  if (!id) return NextResponse.json({ error: "unknown companion" }, { status: 400 });

  try {
    const upstream = await fetch(`${base}/principal/companion/${id}/looked`, {
      cache: "no-store",
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
