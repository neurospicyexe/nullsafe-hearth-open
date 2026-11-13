import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

// Principal creates a task from the dashboard. Proxies to Halseth POST /tasks.
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return NextResponse.json({ error: "HALSETH_URL not set" }, { status: 500 });

  const raw = await request.json().catch(() => ({}));
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 300) : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const body = {
    title,
    description: typeof raw.description === "string" ? raw.description.slice(0, 2000) : undefined,
    priority: PRIORITIES.has(raw.priority) ? raw.priority : "normal",
    due_at: typeof raw.due_at === "string" && raw.due_at ? raw.due_at : undefined,
    assigned_to: typeof raw.assigned_to === "string" && raw.assigned_to ? raw.assigned_to : undefined,
    created_by: "principal",
  };

  try {
    const res = await fetch(`${base}/tasks`, {
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
