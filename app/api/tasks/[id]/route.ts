import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

function authHeaders(withContentType = false): Record<string, string> {
  const secret = process.env.HALSETH_SECRET;
  return {
    ...(withContentType ? { "Content-Type": "application/json" } : {}),
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const raw = await request.json();
  if (
    typeof raw.status !== "string" ||
    !["open", "in_progress", "done"].includes(raw.status)
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    // completed_by: this route is Principal's surface -- Hearth has no other user -- so a task
    // closed here was closed by him. Without it the companions get "someone closed this",
    // which is the exact thing he asked to fix ("if I click done on the Hearth page it
    // translates back to them"). Sent only on 'done'; the handler clears it on a reopen.
    const res = await fetch(`${base}/tasks/${id}`, {
      cache: "no-store",
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({
        status: raw.status,
        ...(raw.status === "done" ? { completed_by: "principal" } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ error: "Request failed" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
