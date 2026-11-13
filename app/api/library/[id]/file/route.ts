import { NextRequest, NextResponse } from "next/server";

// Streams the book's bytes (epub/pdf) from Halseth. The browser fetches this
// route so the bearer secret never leaves the server.
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
    // Longer window than the JSON routes — this is a whole book crossing the wire.
    const res = await fetch(`${base}/mind/books/${encodeURIComponent(id)}/file`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: `book file unavailable (${res.status})` }, { status: res.status });
    }
    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "application/octet-stream");
    const len = res.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
