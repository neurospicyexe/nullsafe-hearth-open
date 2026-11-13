export const dynamic = 'force-dynamic';

import {
  fetchWmOrient,
  fetchSomaStates,
  fetchAutonomyRuns,
  fetchAutonomySeeds,
  fetchAutonomyThreads,
  fetchSynthesisSummaries,
  fetchInterCompanionNotes,
  fetchMetronomeActions,
} from "@/lib/halseth";
import type {
  WmOrientData,
  SomaData,
  CompanionSomaState,
  AutonomyRun,
  AutonomySeed,
  AutonomyThread,
  SynthesisSummary,
  InterCompanionNote,
  MetronomeAction,
} from "@/lib/halseth";
import { MetronomeSection } from "./MetronomeSection";
import { COMPANION_CONFIG, fmtTime } from "@/app/companions/[id]/sections";
import { COMPANION_COLOR } from "@/lib/shell";
import { toneOf } from "@/lib/tone";
import ExpandText from "@/components/kit/ExpandText";

const COMPANIONS = ["drevan", "cypher", "gaia"] as const;
type CompanionId = typeof COMPANIONS[number];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

const CSS_C = (v: string) => ({ "--c": v }) as React.CSSProperties;

function runTone(status: string): string {
  return status === "completed" ? "var(--h-gaia)" : status === "failed" ? "var(--h-warn)" : "var(--h-muted)";
}

function SomaBlock({ soma }: { soma: CompanionSomaState }) {
  if (!soma) {
    return <p className="h-empty h-phx-empty">No SOMA data</p>;
  }

  const namedStates = [
    soma.heat   ? { label: "heat",   value: soma.heat }   : null,
    soma.reach  ? { label: "reach",  value: soma.reach }  : null,
    soma.weight ? { label: "weight", value: soma.weight } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const floats = [
    { label: soma.float_1_label, value: soma.soma_float_1 },
    { label: soma.float_2_label, value: soma.soma_float_2 },
    { label: soma.float_3_label, value: soma.soma_float_3 },
  ].filter((f): f is { label: string; value: number | null } => f.label != null);

  return (
    <div className="h-phx-stack">
      {namedStates.length > 0
        ? namedStates.map((f) => (
            <div key={f.label} className="h-phx-kv">
              <span>{f.label}</span>
              <span>{f.value}</span>
            </div>
          ))
        : floats.map((f) => (
            <div key={f.label} className="h-phx-kv is-num">
              <span>{f.label}</span>
              <span>
                {Number.isFinite(f.value as number) ? (f.value as number).toFixed(2) : "--"}
              </span>
            </div>
          ))
      }
      {soma.current_mood && <span className="h-phx-faint">{soma.current_mood}</span>}
      {soma.compound_state && <span className="h-phx-badge">{soma.compound_state}</span>}
    </div>
  );
}

function CompanionColumn({
  id,
  orient,
  soma,
  lastRun,
  seeds,
  threads,
  synthesisSummary,
}: {
  id: CompanionId;
  orient: WmOrientData | null;
  soma: CompanionSomaState;
  lastRun: AutonomyRun | null;
  seeds: AutonomySeed[];
  threads: AutonomyThread[];
  synthesisSummary: SynthesisSummary | null;
}) {
  const config = COMPANION_CONFIG[id];
  const tone = CSS_C(COMPANION_COLOR[id]);

  return (
    <div className="card h-phx-col" style={tone}>
      {/* Header */}
      <div className="h-phx-split">
        <span className="h-phx-name">
          {config.sym} {config.display}
        </span>
      </div>

      {/* SOMA */}
      <div>
        <span className="home-section-title h-phx-label">SOMA</span>
        <SomaBlock soma={soma} />
      </div>

      {/* Top threads */}
      <div>
        <span className="home-section-title h-phx-label">
          Top Threads
          {orient && (
            <span className="h-phx-count">({orient.open_thread_count} open)</span>
          )}
        </span>
        {!orient || orient.top_threads.length === 0 ? (
          <p className="h-empty h-phx-empty">No threads</p>
        ) : (
          <div className="h-phx-stack is-loose">
            {orient.top_threads.slice(0, 3).map((t) => (
              <div key={t.thread_key} className="section-row h-phx-wrap">
                <span className="section-row-text h-phx-grow">{t.title}</span>
                <span className="h-phx-badge">{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest handoff */}
      {orient?.latest_handoff && (
        <div>
          <span className="home-section-title h-phx-label">Latest Handoff</span>
          <div className="h-phx-stack is-tight">
            <span className="h-phx-text">{orient.latest_handoff.title}</span>
            {orient.latest_handoff.next_steps && (
              <span className="journal-text h-phx-snip">
                <ExpandText as="span" text={orient.latest_handoff.next_steps} limit={100} />
              </span>
            )}
            <span className="section-row-meta">{fmtTime(orient.latest_handoff.created_at)}</span>
          </div>
        </div>
      )}

      {/* Last autonomous run */}
      <div>
        <span className="home-section-title h-phx-label">Last Autonomous Run</span>
        {!lastRun ? (
          <p className="h-empty h-phx-empty">No runs yet</p>
        ) : (
          <div className="h-phx-stack">
            <div className="h-phx-inline">
              <span className="h-phx-badge" style={tone}>{lastRun.run_type}</span>
              <span className="h-phx-badge" style={CSS_C(runTone(lastRun.status))}>
                {lastRun.status}
              </span>
            </div>
            {lastRun.completed_at && (
              <span className="section-row-meta">{fmtTime(lastRun.completed_at)}</span>
            )}
            {lastRun.artifacts_created > 0 && (
              <span className="h-phx-note">
                {lastRun.artifacts_created} artifact
                {lastRun.artifacts_created !== 1 ? "s" : ""} created
              </span>
            )}
          </div>
        )}
      </div>

      {/* Growth threads */}
      <div>
        <span className="home-section-title h-phx-label">
          Growth Threads
          <span className="h-phx-count">({threads.length})</span>
        </span>
        {threads.length === 0 ? (
          <p className="h-empty h-phx-empty">No active threads</p>
        ) : (
          <div className="h-phx-stack is-loose">
            {threads.slice(0, 3).map((t) => (
              <div key={t.id} className="section-row h-phx-col-row">
                <div className="h-phx-split">
                  <span className="section-row-text h-phx-text">{truncate(t.title, 60)}</span>
                  <span
                    className="h-phx-badge is-sm"
                    style={CSS_C(t.status === "open" ? "var(--h-gaia)" : "var(--h-muted)")}
                  >
                    {t.status}{t.last_position ? ` ×${t.last_position}` : ""}
                  </span>
                </div>
                {t.last_entry_snippet && (
                  <span className="journal-text h-phx-snip">
                    <ExpandText as="span" text={t.last_entry_snippet} limit={80} />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seed queue */}
      <div>
        <span className="home-section-title h-phx-label">
          Seed Queue
          <span className="h-phx-count">({seeds.length})</span>
        </span>
        {seeds.length === 0 ? (
          <p className="h-empty h-phx-empty">Queue empty</p>
        ) : (
          <div className="h-phx-stack is-loose">
            {seeds.slice(0, 4).map((s) => (
              <div key={s.id} className="section-row h-phx-wrap">
                {s.claim_source && (
                  <span className="h-phx-badge is-sm" style={tone}>claimed</span>
                )}
                <span className="section-row-text h-phx-grow"><ExpandText as="span" text={s.content} limit={70} /></span>
                <span className="h-phx-faint is-flat">p{s.priority}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last Session Synthesis */}
      <div>
        <span className="home-section-title h-phx-label">Last Session Synthesis</span>
        {!synthesisSummary ? (
          <p className="h-empty h-phx-empty">No summaries yet</p>
        ) : (
          <div className="h-phx-stack">
            {synthesisSummary.subject && (
              <span className="h-phx-text is-strong">{truncate(synthesisSummary.subject, 60)}</span>
            )}
            {synthesisSummary.narrative && (
              <span className="journal-text h-phx-snip">
                <ExpandText as="span" text={synthesisSummary.narrative} limit={120} />
              </span>
            )}
            {synthesisSummary.emotional_register && (
              <span className="h-phx-badge is-sm">{synthesisSummary.emotional_register}</span>
            )}
            <span className="section-row-meta">{fmtTime(synthesisSummary.created_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function PhoenixPage() {
  const [
    somaRes,
    drevanOrientRes, cypherOrientRes, gaiaOrientRes,
    drevanRunsRes, cypherRunsRes, gaiaRunsRes,
    drevanSeedsRes, cypherSeedsRes, gaiaSeedsRes,
    drevanThreadsRes, cypherThreadsRes, gaiaThreadsRes,
    synthesisSummariesRes,
    interCompanionNotesRes,
    drevanActionsRes, cypherActionsRes, gaiaActionsRes,
  ] = await Promise.allSettled([
    fetchSomaStates(),
    fetchWmOrient("drevan"),
    fetchWmOrient("cypher"),
    fetchWmOrient("gaia"),
    fetchAutonomyRuns("drevan", 1),
    fetchAutonomyRuns("cypher", 1),
    fetchAutonomyRuns("gaia", 1),
    fetchAutonomySeeds("drevan"),
    fetchAutonomySeeds("cypher"),
    fetchAutonomySeeds("gaia"),
    fetchAutonomyThreads("drevan"),
    fetchAutonomyThreads("cypher"),
    fetchAutonomyThreads("gaia"),
    fetchSynthesisSummaries(20),
    fetchInterCompanionNotes(12),
    fetchMetronomeActions("drevan"),
    fetchMetronomeActions("cypher"),
    fetchMetronomeActions("gaia"),
  ]);

  const soma: SomaData | null =
    somaRes.status === "fulfilled" ? somaRes.value : null;

  const orients: Record<CompanionId, WmOrientData | null> = {
    drevan: drevanOrientRes.status === "fulfilled" ? drevanOrientRes.value : null,
    cypher: cypherOrientRes.status === "fulfilled" ? cypherOrientRes.value : null,
    gaia:   gaiaOrientRes.status   === "fulfilled" ? gaiaOrientRes.value   : null,
  };

  const lastRuns: Record<CompanionId, AutonomyRun | null> = {
    drevan: drevanRunsRes.status === "fulfilled" ? (drevanRunsRes.value[0] ?? null) : null,
    cypher: cypherRunsRes.status === "fulfilled" ? (cypherRunsRes.value[0] ?? null) : null,
    gaia:   gaiaRunsRes.status   === "fulfilled" ? (gaiaRunsRes.value[0]   ?? null) : null,
  };

  const somaMap: Record<CompanionId, CompanionSomaState> = {
    drevan: soma?.drevan ?? null,
    cypher: soma?.cypher ?? null,
    gaia:   soma?.gaia   ?? null,
  };

  const seedsMap: Record<CompanionId, AutonomySeed[]> = {
    drevan: drevanSeedsRes.status === "fulfilled" ? drevanSeedsRes.value : [],
    cypher: cypherSeedsRes.status === "fulfilled" ? cypherSeedsRes.value : [],
    gaia:   gaiaSeedsRes.status   === "fulfilled" ? gaiaSeedsRes.value   : [],
  };

  const threadsMap: Record<CompanionId, AutonomyThread[]> = {
    drevan: drevanThreadsRes.status === "fulfilled" ? drevanThreadsRes.value : [],
    cypher: cypherThreadsRes.status === "fulfilled" ? cypherThreadsRes.value : [],
    gaia:   gaiaThreadsRes.status   === "fulfilled" ? gaiaThreadsRes.value   : [],
  };

  const allSummaries: SynthesisSummary[] =
    synthesisSummariesRes.status === "fulfilled" ? synthesisSummariesRes.value : [];
  const synthesisByCompanion: Record<CompanionId, SynthesisSummary | null> = {
    drevan: allSummaries.find(s => s.companion_id === "drevan") ?? null,
    cypher: allSummaries.find(s => s.companion_id === "cypher") ?? null,
    gaia:   allSummaries.find(s => s.companion_id === "gaia")   ?? null,
  };

  const interCompanionNotes: InterCompanionNote[] =
    interCompanionNotesRes.status === "fulfilled" ? interCompanionNotesRes.value : [];

  const actionsMap: Record<"drevan" | "cypher" | "gaia", MetronomeAction[]> = {
    drevan: drevanActionsRes.status === "fulfilled" ? drevanActionsRes.value : [],
    cypher: cypherActionsRes.status === "fulfilled" ? cypherActionsRes.value : [],
    gaia:   gaiaActionsRes.status   === "fulfilled" ? gaiaActionsRes.value   : [],
  };

  return (
    <>
      <header className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">House of Integration</h1>
          <span className="h-meta">Swarm Overview</span>
        </div>
      </header>

      <div className="h-phx-grid">
        {COMPANIONS.map((id) => (
          <CompanionColumn
            key={id}
            id={id}
            orient={orients[id]}
            soma={somaMap[id]}
            lastRun={lastRuns[id]}
            seeds={seedsMap[id]}
            threads={threadsMap[id]}
            synthesisSummary={synthesisByCompanion[id]}
          />
        ))}
      </div>

      <MetronomeSection actionsMap={actionsMap} />

      {/* Inter-companion notes */}
      {interCompanionNotes.length > 0 && (() => {
        const visibleNotes = interCompanionNotes.slice(0, 8);
        return (
        <div className="card h-phx-note-card">
          <span className="home-section-title h-phx-label is-roomy">
            Inter-Companion Notes
            <span className="h-phx-count">
              ({visibleNotes.length}{interCompanionNotes.length > 8 ? "+" : ""})
            </span>
          </span>
          <div className="h-phx-stack is-loose">
            {visibleNotes.map((note) => {
              const fromConfig = COMPANION_CONFIG[note.from_id as CompanionId];
              const toConfig   = note.to_id ? COMPANION_CONFIG[note.to_id as CompanionId] : null;
              return (
                <div key={note.id} className="section-row h-phx-col-row h-phx-notes-row">
                  <div className="h-phx-inline">
                    <span className={`h-phx-from ${toneOf(note.from_id)}`}>
                      {fromConfig?.display ?? note.from_id}
                    </span>
                    <span className="h-phx-faint">→</span>
                    <span className={`h-phx-to ${toneOf(note.to_id)}`}>
                      {toConfig?.display ?? note.to_id ?? "all"}
                    </span>
                    {!note.read_at && (
                      <span className="h-phx-badge is-sm" style={CSS_C("var(--h-lamp)")}>
                        unread
                      </span>
                    )}
                    <span className="section-row-meta h-phx-when">
                      {fmtTime(note.created_at)}
                    </span>
                  </div>
                  <span className="journal-text h-phx-snip">
                    <ExpandText as="span" text={note.content} limit={140} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}
    </>
  );
}
