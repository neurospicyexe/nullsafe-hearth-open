import { NextRequest, NextResponse } from "next/server";
import { isMakeId, isMakeWhich } from "@/lib/makes";
import { reportSeen, shouldSignalSeen } from "@/lib/make-reception";

// Download / inline proxy for a companion make (B62). Server-side so HALSETH_SECRET and the Halseth
// URL never reach the browser. Halseth decides the headers (Content-Disposition: attachment with a
// real filename, nosniff, a sandboxing CSP, and whether ?inline=1 is allowed for this type); this
// route passes them through unchanged and only validates what it sends upstream.
// Range is forwarded so Safari on an iPad can play and seek an mp4 / mp3.
const PASS = [
  "Content-Type", "Content-Disposition", "Content-Security-Policy", "X-Content-Type-Options",
  "Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified",
] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; which: string }> }) {
  const { id, which } = await params;
  if (!isMakeId(id) || !isMakeWhich(which)) return new NextResponse("Not found", { status: 404 });

  const base = process.env.HALSETH_URL;
  if (!base) return new NextResponse("HALSETH_URL not set", { status: 500 });

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const headers: Record<string, string> = {};
  const secret = process.env.HALSETH_SECRET;
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const range = request.headers.get("range");
  if (range) headers.Range = range;

  let res: Response;
  try {
    res = await fetch(`${base}/mind/makes/file/${id}/${which}${inline ? "?inline=1" : ""}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return new NextResponse("Upstream unreachable", { status: 502 });
  }
  if (!res.ok || !res.body) {
    return new NextResponse("Not found", { status: res.status === 403 ? 403 : 404 });
  }

  const out = new Headers();
  for (const name of PASS) {
    const v = res.headers.get(name);
    if (v) out.set(name, v);
  }
  if (shouldSignalSeen(which, range)) reportSeen(id);
  // Never let a response go out without nosniff, even if upstream forgot it.
  out.set("X-Content-Type-Options", "nosniff");
  out.set("Cache-Control", "private, max-age=300");
  return new NextResponse(res.body, { status: res.status === 206 ? 206 : 200, headers: out });
}
