import { NextRequest, NextResponse } from "next/server";

// Streams a book's cover image from Halseth. 404 passes through — the grid
// falls back to a title block when there's no cover.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/mind/books/${encodeURIComponent(id)}/cover`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status === 404) return new NextResponse(null, { status: 404 });
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: `cover unavailable (${res.status})` }, { status: res.status });
    }
    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "image/jpeg");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
