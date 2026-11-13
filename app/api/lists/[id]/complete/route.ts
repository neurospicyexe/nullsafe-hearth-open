import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

function authHeaders(): Record<string, string> {
  const secret = process.env.HALSETH_SECRET;
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(_request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const { id } = await params;
  try {
    const res = await fetch(`${base}/lists/${id}/complete`, {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ error: "Request failed" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
