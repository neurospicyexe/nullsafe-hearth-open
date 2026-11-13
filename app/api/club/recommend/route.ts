import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const MAX_TITLE = 300;
const MAX_PITCH = 1000;
const VALID_KINDS = new Set(["song", "album", "book", "article", "video", "forage", "other"]);

// Principal's pick from the dashboard. recommended_by is always 'principal'.
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  let raw: Record<string, unknown>;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, MAX_TITLE) : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const media_kind = VALID_KINDS.has(raw.media_kind as string) ? raw.media_kind : "other";
  const creator = typeof raw.creator === "string" ? raw.creator.trim().slice(0, 200) || null : null;
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  let url: string | null = null;
  if (rawUrl) {
    try {
      // The form field is type="text": "youtube.com/..." used to be dropped silently.
      const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") url = parsed.toString();
    } catch { /* invalid URL -- drop silently */ }
  }
  const pitch = typeof raw.pitch === "string" ? raw.pitch.trim().slice(0, MAX_PITCH) || null : null;

  let res: Response;
  try {
    res = await fetch(`${base}/mind/club/recommend`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ title, media_kind, creator, url, pitch, recommended_by: "principal" }),
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
