export const dynamic = 'force-dynamic';

import { notFound, redirect } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import Link from "next/link";
import {
  fetchGrowthJournal,
  fetchGrowthJournalPage,
  fetchGrowthPatterns,
  fetchGrowthMarkers,
  fetchGrowthPendingCount,
} from "@/lib/halseth";
import type {
  GrowthPattern,
  GrowthMarker,
} from "@/lib/halseth";
import { COMPANION_CONFIG, fmtTime } from "../sections";
import JournalClient from "./JournalClient";
import { markerTypeColor } from "../domain-colors";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

// Halseth caps a single request at 100 rows, so 100 is the PAGE size, not the ceiling: it accepts
// ?offset and returns a total, and this page walks it. Before that the cap WAS the ceiling and all
// three companions sat exactly at it, which is how "view the full list" showed a first page and
// called it the list.
const PAGE_SIZE = 100;

type JournalView = "recent" | "pending" | "all";

export default async function GrowthPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const { view: rawView, page: rawPage } = await searchParams;
  const view: JournalView =
    rawView === "pending" ? "pending" : rawView === "all" ? "all" : "recent";

  // 1-indexed in the URL because it is a thing Principal reads and edits; 0-indexed offset below.
  const parsedPage = parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = view === "recent" ? 0 : (page - 1) * PAGE_SIZE;

  const [journalRes, patternsRes, markersRes, pendingRes] = await Promise.allSettled([
    view === "recent"
      // 21 for a 20-row clip: the 21st is the evidence that a "more" pointer is warranted.
      ? fetchGrowthJournalPage(id, 21, 0)
      : fetchGrowthJournalPage(id, PAGE_SIZE, offset, { pending: view === "pending" }),
    fetchGrowthPatterns(id),
    fetchGrowthMarkers(id),
    fetchGrowthPendingCount(),
  ]);

  const journalPage = journalRes.status === "fulfilled" ? journalRes.value : null;
  const allJournal  = journalPage?.entries ?? [];
  const allPatterns = (patternsRes.status === "fulfilled" ? patternsRes.value : null) ?? [];
  const allMarkers  = (markersRes.status  === "fulfilled" ? markersRes.value  : null) ?? [];
  const pendingData = pendingRes.status  === "fulfilled" ? pendingRes.value  : null;

  // The queue's real size, from the same predicate the queue view lists on. `allJournal.length`
  // could only ever say "at least 21" -- which is why the old footer could not name a number.
  const pendingCount =
    pendingData?.per_companion.find((c) => c.companion_id === id)?.pending ?? null;

  // Halseth already orders each view (queue ASC, everything else DESC) and does it across the WHOLE
  // set, not just this page. Re-sorting here would only ever reorder the 100 rows in hand, which is
  // what made a client-side sort look like it fixed the queue order while the server was still
  // cutting the oldest rows off the end.
  const entries = view === "recent" ? allJournal.slice(0, 20) : allJournal;

  const total = journalPage?.total ?? null;
  const hasMorePages = journalPage?.hasMore ?? false;
  const moreThanShown = view === "recent" && (allJournal.length > 20 || hasMorePages);

  // Page N of M, only when Halseth gave a real total. Never computed from a page length.
  const lastPage = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;
  const pageHref = (p: number) => `/companions/${id}/growth?view=${view}&page=${p}`;

  // A page number past the end reproduced the exact bug this page exists to fix: ?page=999 asked
  // for offset 99800, got nothing back, and rendered "No journal entries yet" plus a count line
  // reading "0-99800 of 186" -- an empty state standing in for a companion with 186 entries.
  // The URL is hand-editable by design, so it has to survive being edited wrong.
  if (view !== "recent" && lastPage !== null && page > lastPage) {
    redirect(pageHref(lastPage));
  }

  // Without a total (a Halseth predating the paging response) there is nothing to clamp against, so
  // an overshot page can only be named, not corrected. Say which it is rather than letting the
  // generic empty state read as "this companion has no growth".
  const overshot = view !== "recent" && page > 1 && entries.length === 0;

  const shownFrom = entries.length > 0 ? offset + 1 : 0;
  const shownTo = offset + entries.length;

  const patterns = [...allPatterns].sort((a, b) => b.strength - a.strength);

  return (
    <div data-companion={id}>
      {/* Page title */}
      <div className="companion-header">
        <div className={`companion-avatar companion-avatar--lg ${id}`}>
          {config.sym}
        </div>
        <div className="h-cmp-grow">
          <h1 className="companion-header-name">Growth</h1>
          <p className="companion-header-tagline">{config.display}</p>
        </div>
      </div>

      {/* ── Section 1: Patterns ── */}
      <section className="page-section">
        <h2 className="section-title">Patterns</h2>
        {patterns.length === 0 ? (
          <p className="h-empty">No patterns recorded yet</p>
        ) : (
          <div className="section-list">
            {patterns.map((p) => {
              let evidenceCount = 0;
              try {
                const parsed = JSON.parse(p.evidence_json);
                evidenceCount = Array.isArray(parsed) ? parsed.length : 0;
              } catch {
                evidenceCount = 0;
              }
              const barWidth = `${Math.min((p.strength / 10) * 100, 100)}%`;
              return (
                <div key={p.id} className="section-row h-cmp-pattern">
                  <span className="section-row-text h-cmp-body is-bold">
                    {p.pattern_text}
                  </span>
                  <div className="h-cmp-pattern-bar">
                    <div className="h-cmp-bar is-grow">
                      <i style={{ "--w": barWidth } as React.CSSProperties} />
                    </div>
                    <span className="section-row-meta h-cmp-sm h-cmp-fixed">
                      {evidenceCount} {evidenceCount === 1 ? "piece" : "pieces"} of evidence
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Journal ── */}
      <section className="page-section">
        <div className="h-cmp-heading-row">
          <h2 className="section-title">
            {view === "pending" ? "Ratification queue" : view === "all" ? "Journal — full" : "Journal"}
          </h2>
          {view !== "recent" && (
            <Link href={`/companions/${id}/growth`} className="home-section-link h-cmp-sm">
              ← recent
            </Link>
          )}
        </div>

        {view === "pending" && (
          <p className="section-row-meta h-cmp-sub-meta">
            Oldest first. Accept or decline empties the queue; entries disappear from this view once reviewed.
          </p>
        )}

        <div className="h-cmp-mt-md">
          <JournalClient
            entries={entries}
            companionId={id}
            emptyText={
              overshot
                ? `Page ${page} is past the end — use “← newer” to go back.`
                : view === "pending"
                  ? "Nothing left to ratify"
                  : undefined
            }
          />
        </div>

        {/* Footer links. The old copy here ("More entries available — view the full list") was a
            plain <p> with nothing to click, on a page whose whole point is draining a queue. */}
        <div className="h-cmp-wrap is-wide h-cmp-mt-md">
          {pendingCount !== null && pendingCount > 0 && view !== "pending" && (
            <Link href={`/companions/${id}/growth?view=pending`} className="home-section-link h-cmp-fine">
              {pendingCount} awaiting ratification → ratify all
            </Link>
          )}
          {(moreThanShown || view === "pending") && (
            <Link href={`/companions/${id}/growth?view=all`} className="home-section-link h-cmp-fine">
              view the full list →
            </Link>
          )}
        </div>

        {/* Pager. Only on the paged views -- "recent" is a deliberate 20-row clip with its own
            pointer above, not page 1 of anything. */}
        {view !== "recent" && (
          <div className="h-cmp-pager">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="home-section-link h-cmp-fine">
                ← newer
              </Link>
            ) : null}

            <span className="section-row-meta h-cmp-sm">
              {entries.length === 0
                ? /* No rows: a range would read "0-99800", which is a range of nothing dressed up
                     as a position in the data. */
                  total !== null ? `0 of ${total}` : "nothing on this page"
                : total !== null
                  ? `${shownFrom}–${shownTo} of ${total}${lastPage && lastPage > 1 ? ` · page ${page} of ${lastPage}` : ""}`
                  : /* No total: this Halseth predates the paging response. Say what is known
                       rather than presenting a page length as a total. */
                    `showing ${shownFrom}–${shownTo}${hasMorePages ? " (more follow)" : ""}`}
            </span>

            {hasMorePages ? (
              <Link href={pageHref(page + 1)} className="home-section-link h-cmp-fine">
                older →
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {/* ── Section 3: Markers (hidden when empty) ── */}
      {allMarkers.length > 0 && (
        <section className="page-section">
          <h2 className="section-title">Markers</h2>
          <div className="h-cmp-wrap">
            {allMarkers.map((m) => {
              return (
                <div
                  key={m.id}
                  className="h-cmp-chip"
                  style={{ "--c": markerTypeColor(m.marker_type) } as React.CSSProperties}
                >
                  <span className="h-cmp-chip-kind">{m.marker_type}</span>
                  <span className="h-cmp-chip-text">{m.description}</span>
                  {m.related_pattern_id && (
                    <span className="h-cmp-chip-fine">(see pattern above)</span>
                  )}
                  <span className="h-cmp-chip-fine">
                    {fmtTime(m.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
