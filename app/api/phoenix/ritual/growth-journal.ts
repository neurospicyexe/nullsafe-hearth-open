// hearth/app/api/phoenix/ritual/growth-journal.ts
//
// Recent growth-journal context for the check_in ritual. Lives beside the route (not in it)
// because Next.js rejects non-HTTP exports from route.ts, and this needs a unit test: the
// previous shape of this fetch was wrong for its whole life.
//
// 2026-10-08 (BUGS P1-4): this used to GET `/mind/growth/journal?companion_id=X&since=...`,
// a path Halseth has never served (only `GET /mind/growth/journal/:companion_id` exists,
// halseth/src/handlers/growth.ts getGrowthJournal), then `continue`d silently on the 404.
// Check-in was prompted with an empty growth section every time and nothing logged it.
// Halseth has no `since` filter, so the cutoff is applied here, on `created_at`.

import type { GrowthJournalEntry } from "@/lib/halseth";

export interface HalsethEnv { url: string; secret: string }

export const GROWTH_JOURNAL_LIMIT = 10;
export const GROWTH_JOURNAL_MAX_LINES = 15;

/** Shape of `GET /mind/growth/journal/:companion_id` (growth.ts, 2026-08-12). */
export interface GrowthJournalPage {
  journal: GrowthJournalEntry[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export async function fetchRecentGrowthJournal(
  env: HalsethEnv,
  companionIds: readonly string[],
  days: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const lines: string[] = [];
  for (const id of companionIds) {
    try {
      const url = `${env.url}/mind/growth/journal/${encodeURIComponent(id)}?limit=${GROWTH_JOURNAL_LIMIT}`;
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${env.secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.warn(`[phoenix/ritual] growth journal fetch failed for ${id}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json() as Partial<GrowthJournalPage> | null;
      const entries = Array.isArray(data?.journal) ? data.journal : [];
      for (const e of entries) {
        // Default DESC order, so the newest rows come first; the cutoff is a filter, not a page bound.
        if (typeof e.created_at !== "string" || e.created_at < cutoff) continue;
        const text = e.content ?? "";
        if (text) lines.push(`(${id}) ${text.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`[phoenix/ritual] growth journal fetch threw for ${id}:`, err instanceof Error ? err.message : err);
    }
  }
  return lines.slice(0, GROWTH_JOURNAL_MAX_LINES).join("\n");
}
