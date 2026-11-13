import { NextRequest, NextResponse } from "next/server";
import { fetchMakeSource } from "@/lib/halseth";
import { FRAME_HEADERS, PAGE_CSP } from "@/lib/makes";
import { reportSeen } from "@/lib/make-reception";

// A companion-made `page` make (B62): their HTML, served with a CSP that allows inline script and style
// and data: images and nothing else (no network, no frames, no forms). Framed sandboxed after a click;
// the CSP's own sandbox directive keeps a direct visit in an opaque origin too.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{32}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const html = await fetchMakeSource(id);
  if (html === null) return new NextResponse("Not found", { status: 404 });
  reportSeen(id); // Principal opened the page: the maker hears it landed
  return new NextResponse(html, { headers: { ...FRAME_HEADERS, "Content-Security-Policy": PAGE_CSP } });
}
