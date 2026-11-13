import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const VALID_SEED_TYPES = new Set(["topic", "question", "reflection_prompt"]);

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await req.json();
  const companion_id = typeof raw.companion_id === "string" ? raw.companion_id : undefined;
  const content = typeof raw.content === "string" ? raw.content.trim() : undefined;
  const seed_type = typeof raw.seed_type === "string" && VALID_SEED_TYPES.has(raw.seed_type)
    ? raw.seed_type
    : "topic";

  if (!companion_id || !content) {
    return NextResponse.json({ error: "companion_id and content required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/mind/autonomy/seeds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ companion_id, content, seed_type }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return NextResponse.json({ error: "Request failed" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
