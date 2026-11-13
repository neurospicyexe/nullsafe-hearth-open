// Reception signal for a companion make: Principal opened it on Hearth. Halseth records it in the make's
// heard_back (only when empty; the maker's own line always wins) and the next orient tells the companion
// "Principal looked". Server-side only (HALSETH_SECRET); every failure is swallowed, a view never breaks for it.
//
// Called from the routes Principal's own opening reaches: the player, the page frame, and the make's own file or
// source (never `preview`, which grid cards load without anyone opening anything; never a mid-stream Range
// continuation).

import { after } from "next/server";

export function shouldSignalSeen(which: string | null, rangeHeader: string | null): boolean {
  if (which !== null && which !== "file" && which !== "source") return false;
  if (rangeHeader && !/^bytes=0-/.test(rangeHeader.trim())) return false;
  return true;
}

export async function markMakeSeen(id: string): Promise<void> {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base || !secret || !/^[0-9a-f]{32}$/.test(id)) return;
  try {
    await fetch(`${base}/mind/makes/${id}/reception`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ signal: "seen", via: "hearth" }),
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // best effort
  }
}

/** Fire the signal after the response is sent; outside a request scope (tests, scripts) fall back to detached. */
export function reportSeen(id: string): void {
  try {
    after(() => markMakeSeen(id));
  } catch {
    void markMakeSeen(id);
  }
}
