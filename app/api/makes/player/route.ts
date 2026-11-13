import { NextRequest, NextResponse } from "next/server";
import { fetchMakeSource } from "@/lib/halseth";
import { FRAME_HEADERS, PLAYER_CSP, strudelShell } from "@/lib/makes";
import { reportSeen } from "@/lib/make-reception";

// Strudel player for a music_code make (B62). The pattern is fetched here by validated id and embedded
// in a JSON script block; the page frames this URL with sandbox="allow-scripts" (no same-origin) after
// a click. Excluded from next.config's global headers so the CSP below is the one that applies, and
// unpkg is allowed here and nowhere else in Hearth.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{32}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const code = await fetchMakeSource(id);
  if (code === null) return new NextResponse("Not found", { status: 404 });
  reportSeen(id); // Principal pressed play: the maker hears it landed
  return new NextResponse(strudelShell(code), {
    headers: { ...FRAME_HEADERS, "Content-Security-Policy": PLAYER_CSP },
  });
}
