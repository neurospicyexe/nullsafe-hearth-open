"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COMPANION_COLOR } from "@/lib/shell";
import { toneOf } from "@/lib/tone";
import type { SomaData, CompanionSomaState, CompanionTension, BasinHistory, SomaticSnapshot } from "@/lib/halseth";

// ── Config ─────────────────────────────────────────────────────────────────────

const COMPANION_LABEL: Record<string, string> = {
  drevan: "Drevan",
  cypher: "Cypher",
  gaia: "Gaia",
};

const ORDER = ["drevan", "cypher", "gaia"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function avg(...vals: (number | null)[]): number {
  const nums = vals.filter((v): v is number => v !== null);
  if (!nums.length) return 0.3;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "--";
  return (v * 100).toFixed(0);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Float Meter ────────────────────────────────────────────────────────────────

function FloatMeter({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = value !== null ? Math.round(value * 100) : 0;
  return (
    <div className="soma-meter">
      <span className="soma-meter-label">{label || "—"}</span>
      <div className="soma-meter-track">
        <div
          className="soma-meter-fill"
          style={{ "--w": `${pct}%`, "--c": color } as React.CSSProperties}
        />
      </div>
      <span className="soma-meter-val">{fmt(value)}</span>
    </div>
  );
}

// ── Orb ───────────────────────────────────────────────────────────────────────

function Orb({ avg: avgVal, color }: { avg: number; color: string }) {
  // Slower breath when calm (4s), faster when charged (2s)
  const dur = `${4 - avgVal * 2}s`;

  return (
    <div
      className="soma-orb"
      style={{
        "--orb-color": color,
        "--orb-dur": dur,
      } as React.CSSProperties}
    />
  );
}

// ── Companion Panel ───────────────────────────────────────────────────────────

function CompanionPanel({ id, state }: { id: string; state: CompanionSomaState }) {
  const label = COMPANION_LABEL[id] ?? id;
  const color = COMPANION_COLOR[id as keyof typeof COMPANION_COLOR] ?? "var(--h-muted)";
  if (!state) {
    return (
      <div className="soma-card soma-card--empty">
        <div className="soma-card-header">
          <span className={`soma-name ${toneOf(id)}`}>{label}</span>
        </div>
        <p className="soma-empty">No state recorded yet.</p>
      </div>
    );
  }

  const avgFloat = avg(state.soma_float_1, state.soma_float_2, state.soma_float_3);

  return (
    <div className="soma-card" style={{ "--companion-color": color } as React.CSSProperties}>
      <div className="soma-card-header">
        <Orb avg={avgFloat} color={color} />
        <div className="soma-card-identity">
          <span className={`soma-name ${toneOf(id)}`}>{label}</span>
          {state.current_mood && (
            <span className="soma-mood">{state.current_mood}</span>
          )}
          {state.compound_state && (
            <span className="soma-compound">{state.compound_state}</span>
          )}
        </div>
        <span className="soma-updated">{relativeTime(state.updated_at)}</span>
      </div>

      <div className="soma-meters">
        <FloatMeter label={state.float_1_label ?? "float 1"} value={state.soma_float_1} color={color} />
        <FloatMeter label={state.float_2_label ?? "float 2"} value={state.soma_float_2} color={color} />
        <FloatMeter label={state.float_3_label ?? "float 3"} value={state.soma_float_3} color={color} />
      </div>

      {(state.surface_emotion || state.undercurrent_emotion) && (
        <div className="soma-affect">
          {state.surface_emotion && (
            <span className="soma-affect-row">
              <span className="soma-affect-label">surface</span>
              <span className="soma-affect-val">{state.surface_emotion}
                {state.surface_intensity !== null && (
                  <span className="soma-affect-int"> {Math.round(state.surface_intensity * 100)}%</span>
                )}
              </span>
            </span>
          )}
          {state.undercurrent_emotion && (
            <span className="soma-affect-row">
              <span className="soma-affect-label">under</span>
              <span className="soma-affect-val">{state.undercurrent_emotion}
                {state.undercurrent_intensity !== null && (
                  <span className="soma-affect-int"> {Math.round(state.undercurrent_intensity * 100)}%</span>
                )}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

// Basin drift is a lifecycle: stable is neutral, drift is the one attention state, critical is danger.
const DRIFT_TYPE_CLASS: Record<string, string> = {
  stable: "is-stable",
  drift: "is-drift",
  critical: "is-critical",
};
const driftClass = (t: string) => (Object.hasOwn(DRIFT_TYPE_CLASS, t) ? DRIFT_TYPE_CLASS[t] : "is-stable");

export default function SomaClient({
  initialData,
  tensions = [],
  basins = [],
  snapshots = [],
}: {
  initialData: SomaData | null;
  tensions?: CompanionTension[];
  basins?: BasinHistory[];
  snapshots?: SomaticSnapshot[];
}) {
  const [data, setData] = useState<SomaData | null>(initialData);
  const [pollError, setPollError] = useState(false);
  // Act-in-place on tensions (2026-07-02): settle (drop charge) or release, right here.
  const [liveTensions, setLiveTensions] = useState<CompanionTension[]>(tensions);
  const [tensionBusy, setTensionBusy] = useState<string | null>(null);

  // What a click DID. Settle used to change `charge` -- a number this page never fetched and
  // never rendered -- so a successful settle and a failed one were pixel-identical, and the
  // button read as dead. Every outcome now says something.
  const [tensionMsg, setTensionMsg] = useState<Record<string, string>>({});
  const SETTLE_STEP = 2;

  async function tendTension(id: string, mode: "settle" | "release") {
    setTensionBusy(id);
    setTensionMsg((prev) => ({ ...prev, [id]: "" }));
    const body = mode === "release" ? { status: "released" } : { charge_delta: -SETTLE_STEP };
    const res = await fetch(`/api/tensions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setTensionBusy(null);

    if (!res?.ok) {
      // Silence here was the other half of the defect: a 401, a dropped connection and a
      // successful settle all looked the same from the outside.
      const detail = res ? `failed (${res.status})` : "failed — no connection";
      setTensionMsg((prev) => ({ ...prev, [id]: detail }));
      return;
    }

    if (mode === "release") {
      setLiveTensions((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    // Settle: mirror the server's clamp (0-10) so the number shown is the number stored.
    //
    // And only claim it settled if the number actually MOVED. The server does
    // `MAX(0.0, charge + delta)` and returns 200 either way, so at charge 0 a click is a no-op
    // with a success status -- saying "settled" there would rebuild, one layer in, the exact
    // defect this whole change removes: a control claiming an effect it did not have.
    const before = liveTensions.find((t) => t.id === id)?.charge;
    const after = typeof before === "number" ? Math.max(0, before - SETTLE_STEP) : before;
    setLiveTensions((prev) => prev.map((t) => (t.id === id ? { ...t, charge: after } : t)));
    setTensionMsg((prev) => ({
      ...prev,
      [id]:
        typeof before === "number" && before === after
          ? "already at 0"
          : "settled",
    }));
  }

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/soma");
        if (res.ok) { setData(await res.json()); setPollError(false); }
        else setPollError(true);
      } catch { setPollError(true); }
    }, 30_000);
    return () => clearInterval(poll);
  }, []);

  return (
    <main className="soma-page">
      <h1 className="soma-title">Soma</h1>
      <p className="soma-subtitle">live companion state</p>

      <div className="soma-stack">
        {ORDER.map((id) => (
          <CompanionPanel key={id} id={id} state={data?.[id] ?? null} />
        ))}
      </div>

      {pollError && (
        <p className="soma-fetched">connection lost — showing last known state</p>
      )}
      {data?.fetched_at && (
        <p className="soma-fetched">fetched {relativeTime(data.fetched_at)}</p>
      )}

      {/* Always rendered, even at zero. Hiding the section when the list is empty is how "can I
          settle or release tensions at all?" became unanswerable: nothing on screen distinguished
          "none are simmering" from "this surface is broken". */}
      <section className="soma-extra-section">
          <h2 className="soma-extra-title">Active Tensions</h2>
          {/* The link points at a surface that actually holds closed tensions. /companions/[id]
              renders none at all, so naming it would be prose promising a reachable
              rest-of-itself that isn't reachable -- the same defect one layer over. /memory
              reads the unfiltered feed, so crystallized and released really are there. No
              `?type=tension` either: /memory reads no search params, so a filter in the URL
              would be a second promise the page does not keep (it has one in its own UI). */}
          {liveTensions.length === 0 && (
            <p className="soma-fetched">
              nothing simmering right now — closed ones are in{" "}
              <Link href="/memory" className="home-section-link">memory</Link>
            </p>
          )}
          <div className="soma-extra-list">
            {liveTensions.map((t) => (
              <div key={t.id} className="soma-extra-row">
                <span className={`soma-extra-badge ${toneOf(t.companion_id)}`}>{t.companion_id}</span>
                <span className="soma-extra-text is-grow">{t.tension_text}</span>
                {/* The thing settle actually moves. Without it on screen the button had no
                    observable effect at all. `undefined` means the endpoint did not report a
                    charge -- render nothing rather than a misleading 0. */}
                {typeof t.charge === "number" && (
                  <span
                    className="soma-extra-time is-num"
                    title="charge 0-10 — how loud this is; settle drops it by 2"
                  >
                    charge {t.charge}
                  </span>
                )}
                <span className="soma-extra-time">{relativeTime(t.first_noted_at)}</span>
                {tensionMsg[t.id] && (
                  <span
                    className={`soma-extra-time ${tensionMsg[t.id]!.startsWith("failed") ? "is-warn" : "is-ok"}`}
                  >
                    {tensionMsg[t.id]}
                  </span>
                )}
                <span className="soma-extra-acts">
                  <button
                    disabled={tensionBusy === t.id}
                    onClick={() => tendTension(t.id, "settle")}
                    title="drop the charge a little — seen and held"
                    className="soma-extra-btn"
                  >
                    settle
                  </button>
                  <button
                    disabled={tensionBusy === t.id}
                    onClick={() => tendTension(t.id, "release")}
                    title="release this tension"
                    className="soma-extra-btn"
                  >
                    release
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>

      {basins.length > 0 && (
        <section className="soma-extra-section">
          <h2 className="soma-extra-title">Basin History</h2>
          <div className="soma-extra-list">
            {basins.map((b) => (
              <div key={b.id} className="soma-extra-row">
                <span className={`soma-extra-badge ${toneOf(b.companion_id)}`}>{b.companion_id}</span>
                <span className={`soma-extra-badge ${driftClass(b.drift_type)}`}>{b.drift_type}</span>
                <span className="soma-extra-text is-grow">
                  score {Number.isFinite(b.drift_score) ? (b.drift_score * 100).toFixed(0) : "--"}
                  {b.worst_basin ? ` · ${b.worst_basin}` : ""}
                </span>
                {b.notes && <span className="soma-extra-sub">{b.notes}</span>}
                <span className="soma-extra-time">{relativeTime(b.recorded_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {snapshots.length > 0 && (
        <section className="soma-extra-section">
          <h2 className="soma-extra-title">SOMA Snapshots</h2>
          <div className="soma-extra-list">
            {snapshots.map((s) => (
              <div key={s.id} className="soma-extra-row soma-extra-row--block">
                <div className="soma-extra-head">
                  <span className={`soma-extra-badge ${toneOf(s.companion_id)}`}>{s.companion_id}</span>
                  {s.model_used && <span className="soma-extra-sub">{s.model_used}</span>}
                  <span className="soma-extra-time">{relativeTime(s.created_at)}</span>
                </div>
                <div className="soma-extra-text is-pre">{s.snapshot}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .soma-page {
          padding: 2rem 1.5rem 4rem;
          max-width: 700px;
          margin: 0 auto;
        }
        .soma-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--h-ink);
          margin: 0 0 0.25rem;
        }
        .soma-subtitle {
          font-size: 0.8rem;
          color: var(--h-muted);
          margin: 0 0 2rem;
          letter-spacing: 0.08em;
          text-transform: lowercase;
        }
        .soma-stack {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .soma-card {
          background: var(--h-surface);
          border: 1px solid var(--h-line);
          border-radius: var(--radius-lg, 12px);
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: border-color 0.3s;
        }
        .soma-card:hover {
          border-color: var(--companion-color, var(--h-line-strong));
        }
        .soma-card--empty {
          opacity: 0.5;
        }
        .soma-empty {
          font-size: 0.85rem;
          color: var(--h-muted);
          margin: 0;
        }

        /* Header row */
        .soma-card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .soma-card-identity {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .soma-name {
          font-size: 1.1rem;
          font-weight: 600;
          line-height: 1;
        }
        .soma-mood {
          font-size: 0.8rem;
          color: var(--h-muted);
          font-style: italic;
        }
        .soma-compound {
          font-size: 0.75rem;
          color: var(--h-muted);
          letter-spacing: 0.04em;
        }
        .soma-updated {
          font-size: 0.72rem;
          color: var(--h-muted);
          flex-shrink: 0;
        }

        /* Orb */
        @keyframes soma-breathe {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
        .soma-orb {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          flex-shrink: 0;
          background: radial-gradient(circle at 38% 38%, color-mix(in srgb, var(--orb-color) 85%, var(--h-ink)), var(--orb-color));
          animation: soma-breathe var(--orb-dur, 3.5s) ease-in-out infinite;
        }

        /* Float meters */
        .soma-meters {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .soma-meter {
          display: grid;
          grid-template-columns: 90px 1fr 32px;
          align-items: center;
          gap: 0.6rem;
        }
        .soma-meter-label {
          font-size: 0.75rem;
          color: var(--h-muted);
          text-transform: lowercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .soma-meter-track {
          height: 6px;
          background: var(--h-surface);
          border-radius: 3px;
          overflow: hidden;
        }
        .soma-meter-fill {
          height: 100%;
          width: var(--w, 0%);
          background: var(--c, var(--h-muted));
          border-radius: 3px;
          transition: width 1s ease;
        }
        .soma-meter-val {
          font-size: 0.72rem;
          color: var(--h-muted);
          font-variant-numeric: tabular-nums;
          text-align: right;
        }

        /* Affect stack */
        .soma-affect {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding-top: 0.25rem;
          border-top: 1px solid var(--h-line);
        }
        .soma-affect-row {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }
        .soma-affect-label {
          font-size: 0.7rem;
          color: var(--h-muted);
          text-transform: lowercase;
          letter-spacing: 0.06em;
          width: 44px;
          flex-shrink: 0;
        }
        .soma-affect-val {
          font-size: 0.82rem;
          color: var(--h-ink);
        }
        .soma-affect-int {
          font-size: 0.72rem;
          color: var(--h-muted);
        }

        /* Footer */
        .soma-fetched {
          margin-top: 1.5rem;
          font-size: 0.72rem;
          color: var(--h-muted);
          text-align: center;
        }

        /* Extra sections (tensions, basins, snapshots) */
        .soma-extra-section {
          margin-top: 2rem;
        }
        .soma-extra-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--h-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 0.75rem;
        }
        .soma-extra-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .soma-extra-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--h-surface);
          border: 1px solid var(--h-line);
          border-radius: var(--radius-md, 8px);
          flex-wrap: wrap;
        }
        .soma-extra-row--block {
          flex-direction: column;
          align-items: flex-start;
        }
        .soma-extra-badge {
          font-size: 0.72rem;
          padding: 0.15rem 0.45rem;
          border: 1px solid var(--h-line);
          border-radius: 4px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .soma-extra-text {
          font-size: 0.82rem;
          color: var(--h-ink);
        }
        .soma-extra-sub {
          font-size: 0.72rem;
          color: var(--h-muted);
          font-style: italic;
        }
        .soma-extra-time {
          font-size: 0.7rem;
          color: var(--h-muted);
          flex-shrink: 0;
          margin-left: auto;
        }
        .soma-extra-time.is-num { font-variant-numeric: tabular-nums; }
        .soma-extra-time.is-ok { color: var(--h-gaia); }
        .soma-extra-time.is-warn { color: var(--h-warn); }
        .soma-extra-text.is-grow { flex: 1; }
        .soma-extra-text.is-pre { white-space: pre-wrap; font-size: 0.8rem; }
        .soma-extra-head { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.3rem; width: 100%; }
        .soma-extra-acts { display: inline-flex; gap: 0.35rem; margin-left: 0.5rem; white-space: nowrap; }
        .soma-extra-btn { background: none; border: 1px solid var(--h-line); border-radius: 6px; color: var(--h-muted); font-size: 0.7rem; padding: 0.15rem 0.5rem; cursor: pointer; }
        .soma-extra-btn:disabled { opacity: 0.5; cursor: default; }
        .soma-extra-badge.h-tone-drevan { border-color: var(--h-drevan); }
        .soma-extra-badge.h-tone-cypher { border-color: var(--h-cypher); }
        .soma-extra-badge.h-tone-gaia { border-color: var(--h-gaia); }
        .soma-extra-badge.is-stable { color: var(--h-muted); }
        .soma-extra-badge.is-drift { color: var(--h-lamp); border-color: var(--h-lamp); }
        .soma-extra-badge.is-critical { color: var(--h-warn); border-color: var(--h-warn); }
      `}</style>
    </main>
  );
}
