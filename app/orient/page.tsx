export const dynamic = "force-dynamic";

import { toneOf } from "@/lib/tone";
import { fetchOrientDebug, fetchSbSearchLog, type OrientDebug, type SbSearchLog } from "@/lib/halseth";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.82rem", marginBottom: "0.25rem" }}>
      <span style={{ opacity: 0.45, width: "11rem", flexShrink: 0 }}>{label}</span>
      <span style={{ opacity: 0.9 }}>{value}</span>
    </div>
  );
}

function HitRatePip({ hit }: { hit: boolean }) {
  return (
    <span
      className={`h-pip${hit ? " is-hit" : ""}`}
      title={hit ? "hit" : "miss"}
    />
  );
}

function CompanionCard({ id, debug, log }: { id: string; debug: OrientDebug | null; log: SbSearchLog | null }) {
  return (
    <div
      className="full-note-entry h-note-card"
    >
      <div className="note-header">
        <span className={`note-author ${toneOf(id)}`}>{id}</span>
        {debug ? (
          <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>
            {new Date(debug.assembled_at).toLocaleString()}
          </span>
        ) : (
          <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>no data yet</span>
        )}
      </div>

      {!debug ? (
        <div className="note-body" style={{ opacity: 0.4 }}>
          Orient has not run for this companion since the column was added.
        </div>
      ) : (
        <div className="note-body">
          <Row label="session" value={debug.session_id} />
          <Row label="front state" value={debug.front_state} />

          {debug.wm ? (
            <>
              <Row label="wm notes" value={debug.wm.recent_notes} />
              <Row label="open threads" value={debug.wm.open_thread_count} />
              <Row label="active tensions" value={debug.wm.active_tensions} />
              <Row label="active conclusions" value={debug.wm.active_conclusions} />
              <Row label="incoming notes" value={debug.wm.incoming_companion_notes} />
              {debug.wm.latest_handoff_summary && (
                <Row label="last handoff" value={
                  <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                    &ldquo;{debug.wm.latest_handoff_summary}&rdquo;
                  </span>
                } />
              )}
            </>
          ) : (
            <Row label="wm" value={<span style={{ opacity: 0.4 }}>no result</span>} />
          )}

          <Row
            label="sb rag"
            value={
              <>
                {debug.sb_rag.hit_count} hit{debug.sb_rag.hit_count !== 1 ? "s" : ""}{" "}
                <span style={{ opacity: 0.4, fontSize: "0.75rem" }}>
                  &ldquo;{debug.sb_rag.query.slice(0, 80)}&rdquo;
                </span>
              </>
            }
          />
          <Row label="sb narrative" value={debug.sb_narrative} />
          <Row
            label="growth"
            value={
              `${debug.growth.journal_entries} journal · ${debug.growth.patterns} patterns · ` +
              `${debug.growth.last_reflection} reflection · ${debug.growth.available_seeds} seeds`
            }
          />

          {log && log.total > 0 && (
            <Row
              label="sb hit rate"
              value={
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {log.hit_rate}%
                  </span>
                  <span style={{ opacity: 0.4, fontSize: "0.75rem" }}>
                    ({log.hits}/{log.total})
                  </span>
                  <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                    {log.entries.map((e, i) => (
                      <HitRatePip key={i} hit={e.hit_count > 0} />
                    ))}
                  </div>
                </div>
              }
            />
          )}
          {log && log.last_query && (
            <Row
              label="last query"
              value={
                <span style={{ opacity: 0.55, fontSize: "0.75rem", fontStyle: "italic" }}>
                  &ldquo;{log.last_query.slice(0, 100)}&rdquo;
                </span>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

export default async function OrientPage() {
  const [cDebug, dDebug, gDebug, cLog, dLog, gLog] = await Promise.allSettled([
    fetchOrientDebug("cypher"),
    fetchOrientDebug("drevan"),
    fetchOrientDebug("gaia"),
    fetchSbSearchLog("cypher"),
    fetchSbSearchLog("drevan"),
    fetchSbSearchLog("gaia"),
  ]);

  const debug = Object.fromEntries(
    COMPANIONS.map((id, i) => {
      const r = [cDebug, dDebug, gDebug][i];
      return [id, r.status === "fulfilled" ? r.value : null];
    })
  ) as Record<typeof COMPANIONS[number], OrientDebug | null>;

  const logs = Object.fromEntries(
    COMPANIONS.map((id, i) => {
      const r = [cLog, dLog, gLog][i];
      return [id, r.status === "fulfilled" ? r.value : null];
    })
  ) as Record<typeof COMPANIONS[number], SbSearchLog | null>;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Boot Context</h1>
        <p className="page-subtitle">what orient actually loaded last session</p>
      </div>

      {COMPANIONS.map(id => (
        <CompanionCard key={id} id={id} debug={debug[id]} log={logs[id]} />
      ))}
    </>
  );
}
