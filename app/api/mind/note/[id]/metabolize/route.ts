import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const { id } = await params;
  const raw = await request.json();
  const body = { companion_id: typeof raw.companion_id === "string" ? raw.companion_id : undefined };

  try {
    const res = await fetch(`${base}/mind/note/${id}/metabolize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return NextResponse.json({ error: "Request failed" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
