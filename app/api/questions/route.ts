import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const MAX_ANSWER_LENGTH = 2000;

// Principal answers or dismisses a held question from the dashboard.
// Proxies to Halseth PATCH /mind/questions/:id with the dashboard's auth.
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await request.json();
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const status = raw.status === "answered" || raw.status === "dismissed" ? raw.status : "";
  const answer = typeof raw.answer === "string" ? raw.answer.slice(0, MAX_ANSWER_LENGTH) : null;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!status) return NextResponse.json({ error: "status must be 'answered' or 'dismissed'" }, { status: 400 });
  if (status === "answered" && !answer?.trim()) {
    return NextResponse.json({ error: "answer required to answer a question" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${base}/mind/questions/${encodeURIComponent(id)}`, {
      cache: "no-store",
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ status, answer }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: (body as { error?: string }).error ?? "Request failed" }, { status: res.status });
  }
  return NextResponse.json(body);
}
