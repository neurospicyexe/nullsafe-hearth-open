import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const MAX_REASON_LENGTH = 500;

// Principal's vote from the dashboard. Voter is always 'principal' here -- companions vote in-voice at
// the worker's voting tick, never through Hearth. A client-sent voter is never read.
async function forward(method: "POST" | "DELETE", payload: Record<string, unknown>): Promise<NextResponse> {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  let res: Response;
  try {
    res = await fetch(`${base}/mind/club/vote`, {
      cache: "no-store",
      method,
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Pass halseth's reason through ("no voting for your own pick", "no round is accepting votes", etc.)
    return NextResponse.json({ error: (body as { error?: string }).error ?? "Request failed" }, { status: res.status });
  }
  return NextResponse.json(body);
}

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  if (!process.env.HALSETH_URL) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  const raw = await request.json().catch(() => ({}));
  const recommendation_id = typeof raw?.recommendation_id === "string" ? raw.recommendation_id.trim() : "";
  const reason = typeof raw?.reason === "string" ? raw.reason.slice(0, MAX_REASON_LENGTH) : null;
  if (!recommendation_id) {
    return NextResponse.json({ error: "recommendation_id required" }, { status: 400 });
  }
  return forward("POST", { recommendation_id, voter: "principal", reason });
}

// Withdraw Principal's vote in the current round. The request body is ignored.
export async function DELETE(_request: NextRequest) {
  const denied = await requireSession(_request);
  if (denied) return denied;
  return forward("DELETE", { voter: "principal" });
}
