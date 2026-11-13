import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

// Principal creates a calendar event from the dashboard. Proxies to Halseth POST /events.
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await request.json().catch(() => ({}));
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 300) : "";
  const startTime = typeof raw.start_time === "string" && !isNaN(Date.parse(raw.start_time)) ? raw.start_time : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!startTime) return NextResponse.json({ error: "start_time must be a valid datetime" }, { status: 400 });

  const body = {
    title,
    start_time: startTime,
    end_time: typeof raw.end_time === "string" && !isNaN(Date.parse(raw.end_time)) ? raw.end_time : undefined,
    description: typeof raw.description === "string" ? raw.description.slice(0, 2000) : undefined,
    category: typeof raw.category === "string" && raw.category ? raw.category.slice(0, 60) : undefined,
    created_by: "principal",
  };

  try {
    const res = await fetch(`${base}/events`, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Halseth unreachable" }, { status: 502 });
  }
}
