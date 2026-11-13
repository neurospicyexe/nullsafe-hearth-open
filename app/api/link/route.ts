import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal's link control on the map (M4, Halseth mig 0151). Two shapes, both id-only:
//   { src: { table, id }, dst: { table, id }, why? }   -> make a link, written as 'principal'
//   { unlink: true, link_id } or { unlink: true, src, dst } -> remove one of Principal's own links
// Halseth POST /mind/link forces writer = 'principal': this door can never make or remove a companion's
// link. A refusal (a draft, the same row twice, a why past 160 characters) comes back 422 with why.
type End = { table: string; id: string };
const end = (v: unknown): End | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return typeof o.table === "string" && typeof o.id === "string" && o.table && o.id.trim() ? { table: o.table, id: o.id.trim() } : null;
};

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });
  const raw = await request.json().catch(() => ({}));

  let body: Record<string, unknown>;
  if (raw.unlink === true) {
    const src = end(raw.src), dst = end(raw.dst);
    const linkId = typeof raw.link_id === "string" ? raw.link_id.trim() : "";
    if (!linkId && !(src && dst)) return NextResponse.json({ error: "need link_id, or src and dst" }, { status: 400 });
    body = linkId ? { unlink: true, link_id: linkId, surface: "hearth:map" } : { unlink: true, src, dst, surface: "hearth:map" };
  } else {
    const src = end(raw.src), dst = end(raw.dst);
    if (!src || !dst) return NextResponse.json({ error: "need src and dst, each { table, id }" }, { status: 400 });
    const why = typeof raw.why === "string" ? raw.why.trim().slice(0, 400) : "";
    body = { src, dst, why: why || undefined, surface: "hearth:map" };
  }

  try {
    const res = await fetch(`${base}/mind/link`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json(out, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
