import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const base = () => process.env.HALSETH_URL!;
const authHeader = (): Record<string, string> => {
  const s = process.env.HALSETH_SECRET;
  return s ? { Authorization: `Bearer ${s}` } : {};
};

export async function GET() {
  try {
    const res = await fetch(`${base()}/dream-seeds`, {
      headers: authHeader(),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ error: `Halseth returned ${res.status}` }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const VALID_COMPANIONS = new Set(["drevan", "cypher", "gaia"]);
  const body = {
    content:       typeof (raw as Record<string, unknown>).content       === "string" ? (raw as Record<string, unknown>).content : undefined,
    for_companion: typeof (raw as Record<string, unknown>).for_companion === "string" && VALID_COMPANIONS.has((raw as Record<string, unknown>).for_companion as string)
                     ? (raw as Record<string, unknown>).for_companion : undefined,
  };

  try {
    const res = await fetch(`${base()}/dream-seeds`, {
      cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || `Halseth returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
