import { NextRequest, NextResponse } from "next/server";
import { isValidId } from "@/lib/valid-id";
import { requireSession } from "@/lib/require-session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const url = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!url || !secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  try {
    const body = await req.json() as unknown;
    const res = await fetch(`${url}/mind/metronome/actions/${encodeURIComponent(id)}`, {
      cache: "no-store",
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const url = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!url || !secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  try {
    const companionId = new URL(req.url).searchParams.get("companion_id") ?? "";
    const res = await fetch(
      `${url}/mind/metronome/actions/${encodeURIComponent(id)}?companion_id=${encodeURIComponent(companionId)}`,
      {
    cache: "no-store", method: "DELETE", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000) },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
