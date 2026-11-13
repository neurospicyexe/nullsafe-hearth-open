import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const VALID_NOTE_TYPES = ["letter:drevan", "letter:cypher", "letter:gaia"] as const;
const MAX_CONTENT_LENGTH = 10_000;
const MAX_AUTHOR_LENGTH = 64;

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await request.json();

  const author    = typeof raw.author    === "string" ? raw.author.slice(0, MAX_AUTHOR_LENGTH) : undefined;
  const content   = typeof raw.content   === "string" ? raw.content   : undefined;
  const note_type = typeof raw.note_type === "string" ? raw.note_type : undefined;

  if (!content || content.length === 0) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `content exceeds ${MAX_CONTENT_LENGTH} characters` }, { status: 400 });
  }
  if (note_type && !(VALID_NOTE_TYPES as readonly string[]).includes(note_type)) {
    return NextResponse.json(
      { error: `note_type must be one of: ${VALID_NOTE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${base}/notes`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ author, content, note_type }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return NextResponse.json({ error: "Request failed" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
