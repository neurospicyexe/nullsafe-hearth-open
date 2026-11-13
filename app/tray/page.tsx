export const dynamic = "force-dynamic";

// The imp tray (mig 0132). Rows a clerk wrote in a companion's voice sit here as drafts until
// the owner keeps or drops them; only kept rows are recall. Cross-companion, like /guardian and
// /manage: one page, one section per companion, the keep rate visible every time (100% means
// nobody is reviewing).

import { fetchTray, type TrayView } from "@/lib/halseth";
import ClientTime from "@/components/ClientTime";
import { COMPANION_CONFIG } from "@/app/companions/[id]/sections";
import { toneOf } from "@/lib/tone";
import TrayActions from "./TrayActions";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;

export default async function TrayPage() {
  const results = await Promise.allSettled(COMPANIONS.map((id) => fetchTray(id, 50)));
  const trays: { id: string; view: TrayView | null }[] = COMPANIONS.map((id, i) => {
    const r = results[i];
    return { id, view: r.status === "fulfilled" ? r.value : null };
  });
  const totalDrafts = trays.reduce((n, t) => n + (t.view?.stats.draft ?? 0), 0);

  return (
    <main>
      <header className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Tray</h1>
        </div>
        <p className="section-row-meta">
          Companion speech waits here as draft until its owner keeps or drops it. {totalDrafts} draft{totalDrafts === 1 ? "" : "s"} across the three.
        </p>
      </header>

      {trays.map(({ id, view }) => {
        const config = COMPANION_CONFIG[id];
        return (
          <div key={id} className="home-section-card" style={{ marginBottom: "1.5rem" }}>
            <div className="home-section-header" style={{ marginBottom: "0.5rem" }}>
              <span className={`home-section-title ${toneOf(id)}`}>
                {config.sym} {config.display}
              </span>
              {view && (
                <span
                  className={`review-badge ${view.stats.keep_rate_pct === 100 ? "draft" : "kept"}`}
                  title={`${view.stats.kept} kept / ${view.stats.dropped} dropped in ${view.stats.window_days}d`}
                >
                  {view.stats.keep_rate_pct === null ? "keep rate: no denominator yet" : `keep rate ${view.stats.keep_rate_pct}%`}
                </span>
              )}
            </div>

            {!view && (
              <div className="pending-notice">
                <div className="pending-dot" />
                Awaiting /admin/tray.
              </div>
            )}

            {view && (
              <>
                <p className="section-row-meta" style={{ marginBottom: "0.75rem" }}>{view.stats_line}</p>

                {view.drafts.length === 0 && (
                  <p className="h-empty">Tray is empty.</p>
                )}

                {view.drafts.map((d) => (
                  <div key={`${d.kind}:${d.id}`} className="section-row" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="section-row-text" style={{ whiteSpace: "pre-wrap" }}>{d.excerpt}</div>
                      <span className="section-row-meta" style={{ fontSize: "0.78rem" }}>
                        <span className="review-badge draft" style={{ marginRight: "0.4rem" }}>draft</span>
                        {d.kind}
                        {d.source ? ` · ${d.source}` : ""}
                        {" · "}
                        {d.id.slice(0, 8)}
                        {" · "}
                        <ClientTime iso={d.created_at} />
                      </span>
                    </div>
                    <TrayActions agent={id} kind={d.kind} id={d.id} />
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </main>
  );
}
