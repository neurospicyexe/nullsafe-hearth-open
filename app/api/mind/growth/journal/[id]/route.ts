import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// DELETE /api/mind/growth/journal/:id?companion_id=
// Hard-prune for bad autonomous entries. Halseth refuses accepted canon (409) -- the
// status is forwarded so the UI can surface "decline or supersede instead".
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const { id } = await params;
  const companionId = new URL(req.url).searchParams.get("companion_id") ?? "";

  try {
    const res = await fetch(
      `${base}/mind/growth/journal/${encodeURIComponent(id)}?companion_id=${encodeURIComponent(companionId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
