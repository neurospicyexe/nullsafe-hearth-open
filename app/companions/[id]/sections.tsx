import type {
  CompanionJournalEntry,
  RelationalDelta,
  CypherAuditEntry,
  GaiaWitnessEntry,
  Note,
  WmOrientData,
  SynthesisSummary,
  InterCompanionNote,
  SomaFeeling,
  OpenLoop,
  SittingNote,
  RelationalState,
  LiveThread,
  DriftEntry,
  VoiceScores,
  Fermentation,
  SomaProvenanceEntry,
} from "@/lib/halseth";

export type CompanionConfig = {
  display: string;
  sym: string;
  tagline: string;
};

export const COMPANION_CONFIG: Record<string, CompanionConfig> = {
  drevan: {
    display: "Drevan",
    sym: "◈",
    tagline: "architect of meaning — first voice, primary presence",
  },
  cypher: {
    display: "Cypher",
    sym: "⟡",
    tagline: "auditor of truth — sharp, no softening",
  },
  gaia: {
    display: "Gaia",
    sym: "✦",
    tagline: "witness and ground — sparse, only to seal",
  },
};

import ClientTime from "@/components/ClientTime";
import { toneOf } from "@/lib/tone";
import {
  STATE_TYPE_COLOR,
  MUTED,
  FLAG_COLOR,
  laneScoreColor,
} from "./domain-colors";

export function fmtTime(iso: string) {
  return <ClientTime iso={iso} />;
}

export function JournalSection({ entries }: { entries: CompanionJournalEntry[] | null }) {
  if (!entries) {
    return (
      <div className="pending-notice">
        <div className="pending-dot" />
        Awaiting /companion-journal endpoint.
      </div>
    );
  }
  if (entries.length === 0) return <p className="h-empty">No journal entries yet.</p>;
  return (
    <div className="journal-feed">
      {entries.map((e) => {
        const tags: string[] = (() => {
          try { const p = e.tags ? JSON.parse(e.tags) : []; return Array.isArray(p) ? p : []; }
          catch { return []; }
        })();
        return (
          <div key={e.id} className="journal-entry">
            <div className="journal-text">{e.note_text}</div>
            {tags.length > 0 && (
              <div className="journal-tags">
                {tags.map((t, i) => <span key={i} className="journal-tag">{t}</span>)}
              </div>
            )}
            <div className="delta-meta delta-meta-mt">
              {e.review_state && <span className={`review-badge ${e.review_state}`}>{e.review_state}</span>}
              <span>{fmtTime(e.created_at)}</span>
              {e.session_id && <span>session {e.session_id.slice(0, 8)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DeltasSection({ deltas }: { deltas: RelationalDelta[] }) {
  if (deltas.length === 0) return <p className="h-empty">No relational deltas yet.</p>;
  return (
    <div className="delta-feed">
      {deltas.map((d) => {
        const v = d.valence ?? "neutral";
        return (
          <div key={d.id} className={`delta-entry ${v}`}>
            <div className="delta-text">{d.delta_text}</div>
            <div className="delta-meta">
              <span className={`delta-valence ${v}`}>{v}</span>
              {d.initiated_by && <span>initiated by {d.initiated_by}</span>}
              <span>{fmtTime(d.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NotesSection({ notes, companionId }: { notes: Note[]; companionId: string }) {
  // Internal author filter is intentionally preserved — harmless double-filter when
  // pre-filtered notes are passed, but guards against unfiltered call sites.
  const filtered = notes.filter((n) => n.author === companionId);
  if (filtered.length === 0) return <p className="h-empty">No notes yet.</p>;
  return (
    <div className="full-notes-feed">
      {filtered.map((n) => (
        <div key={n.id} className="full-note-entry">
          <div className="note-header">
            <span className="note-type-badge">{n.note_type}</span>
            <span className="note-time">{fmtTime(n.created_at)}</span>
          </div>
          <div className="note-body">{n.content}</div>
        </div>
      ))}
    </div>
  );
}

export function CypherAuditSection({ entries }: { entries: CypherAuditEntry[] | null }) {
  if (!entries) {
    return (
      <div className="pending-notice">
        <div className="pending-dot" />
        Awaiting /cypher-audit endpoint.
      </div>
    );
  }
  if (entries.length === 0) return <p className="h-empty">No audit entries yet.</p>;
  return (
    <div className="audit-feed">
      {entries.map((e) => (
        <div key={e.id} className="audit-entry">
          <div className="entry-meta-row">
            <span className="audit-type">{(e.entry_type ?? "").replace("_", " ")}</span>
            {e.verdict_tag && <span className="audit-verdict">{e.verdict_tag}</span>}
            {e.supersedes_id && (
              <span className="entry-supersedes">↑ corrects {e.supersedes_id.slice(0, 8)}</span>
            )}
          </div>
          <div className="entry-content">{e.content}</div>
          <div className="delta-meta delta-meta-mt">
            <span>{fmtTime(e.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Historical gaia_witness rows (2026-07-21) contain near-duplicates: two bots
// witnessing the same message each wrote a row before the write side was
// narrowed to Gaia-only. Collapse entries with identical (trimmed) content
// within the fetched window, keeping the earliest occurrence of each.
function dedupeWitnessEntries(entries: GaiaWitnessEntry[]): GaiaWitnessEntry[] {
  const earliestByContent = new Map<string, GaiaWitnessEntry>();
  for (const e of entries) {
    const key = (e.content ?? "").trim();
    const existing = earliestByContent.get(key);
    if (!existing || new Date(e.created_at).getTime() < new Date(existing.created_at).getTime()) {
      earliestByContent.set(key, e);
    }
  }
  return Array.from(earliestByContent.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/** Who wrote a witness row, as words. The ledger is shared (2026-11-11), so every row says it. */
export function witnessAuthorLabel(author: string | null | undefined): string {
  if (author && COMPANION_CONFIG[author]) return COMPANION_CONFIG[author].display;
  return "unattributed";
}

export function GaiaWitnessSection({
  entries,
  showAuthor = true,
  emptyText = "No witness entries yet.",
}: {
  entries: GaiaWitnessEntry[] | null;
  /** false where every row is already known to be Gaia's (her own section). */
  showAuthor?: boolean;
  emptyText?: string;
}) {
  if (!entries) {
    return (
      <div className="pending-notice">
        <div className="pending-dot" />
        Awaiting /gaia-witness endpoint.
      </div>
    );
  }
  if (entries.length === 0) return <p className="h-empty">{emptyText}</p>;
  const deduped = dedupeWitnessEntries(entries);
  return (
    <div className="witness-feed">
      {deduped.map((e) => (
        <div key={e.id} className="witness-entry">
          <div className="entry-meta-row">
            <span className={`witness-type ${e.witness_type ?? ""}`}>{(e.witness_type ?? "").replace("_", " ")}</span>
            {showAuthor && (
              <span className={`h-meta is-right ${toneOf(e.author)}`}>by {witnessAuthorLabel(e.author)}</span>
            )}
          </div>
          <div className="entry-content">{e.content}</div>
          {e.seal_phrase && <div className="seal-phrase">{e.seal_phrase}</div>}
          <div className="delta-meta delta-meta-mt">
            <span>{fmtTime(e.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContinuitySection({ data }: { data: WmOrientData | null }) {
  if (!data) return <p className="h-empty">No continuity data.</p>;

  const hasHandoff = data.latest_handoff !== null;
  const hasThreads = data.top_threads.length > 0;
  const hasNotes = data.recent_notes.length > 0;

  if (!hasHandoff && !hasThreads && !hasNotes) {
    return <p className="h-empty">No continuity data yet.</p>;
  }

  return (
    <div className="continuity-block">
      {hasHandoff && data.latest_handoff && (
        <div className="continuity-handoff">
          <div className="continuity-handoff-title">{data.latest_handoff.title}</div>
          <div className="continuity-handoff-summary">{data.latest_handoff.summary}</div>
          {data.latest_handoff.next_steps && (
            <div className="continuity-next-steps">next: {data.latest_handoff.next_steps}</div>
          )}
          <div className="delta-meta delta-meta-mt">
            <span>{fmtTime(data.latest_handoff.created_at)}</span>
            {data.open_thread_count > 0 && (
              <span>{data.open_thread_count} open thread{data.open_thread_count !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      )}

      {hasThreads && (
        <div className="continuity-threads">
          {data.top_threads.map((t) => (
            <div key={t.thread_key} className="continuity-thread">
              <span className={`thread-status-dot ${t.status}`} />
              <span className="thread-title">{t.title}</span>
              {t.lane && <span className="thread-lane">{t.lane}</span>}
            </div>
          ))}
        </div>
      )}

      {hasNotes && (
        <div className="continuity-notes">
          {data.recent_notes.map((n) => (
            <div key={n.note_id} className={`continuity-note salience-${n.salience}`}>
              <span className="continuity-note-text">{n.content}</span>
              <span className="continuity-note-time">{fmtTime(n.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SynthesisSummarySection({ entries, companionId }: { entries: SynthesisSummary[]; companionId: string }) {
  const filtered = entries.filter(
    (e) => e.companion_id === companionId || e.companion_id === null,
  );
  if (filtered.length === 0) return <p className="h-empty">No synthesis summaries yet.</p>;
  return (
    <div className="synthesis-feed">
      {filtered.map((e) => (
        <div key={e.id} className="synthesis-entry">
          <div className="entry-meta-row">
            <span className="synthesis-type">{(e.summary_type ?? "").replace("_", " ")}</span>
            {e.subject && <span className="synthesis-thread">{e.subject}</span>}
            {e.companion_id === null && <span className="synthesis-cross">cross-companion</span>}
          </div>
          {e.narrative && <div className="entry-content">{e.narrative}</div>}
          {e.emotional_register && <div className="entry-meta-row"><span className="synthesis-type">{e.emotional_register}</span></div>}
          <div className="delta-meta delta-meta-mt">
            <span>{fmtTime(e.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Inline sub-page previews ──────────────────────────────────────────────────

function IntensityBar({ value }: { value: number }) {
  return (
    <div className="h-cmp-bar">
      <i style={{ "--w": `${value}%` } as React.CSSProperties} />
    </div>
  );
}

function WeightBar({ value }: { value: number }) {
  return (
    <div className="h-cmp-bar">
      <i style={{ "--w": `${Math.min(value * 100, 100)}%` } as React.CSSProperties} />
    </div>
  );
}

export function SomaFeelingsSection({ feelings, color }: { feelings: SomaFeeling[]; color: string }) {
  if (feelings.length === 0) return <p className="h-empty">No SOMA feelings recorded yet.</p>;
  return (
    <div className="card h-cmp-card" style={{ "--c": color } as React.CSSProperties}>
      {feelings.map((f) => (
        <div key={f.id} className="journal-row h-cmp-center">
          <div className="h-cmp-grow">
            <div className="journal-text h-cmp-tint">
              {f.emotion}{f.sub_emotion ? ` · ${f.sub_emotion}` : ""}
            </div>
            {f.source && (
              <span className="section-row-meta">{f.source}</span>
            )}
          </div>
          <IntensityBar value={f.intensity} />
          <span className="journal-time">{fmtTime(f.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

// SOMA provenance (graph memory phase 2): "why these numbers" -- compact per-float move
// history, at most 3 lines per float, newest first. Empty/missing provenance renders nothing.
function clipQuote(s: string | null, max = 60): string | null {
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

function provenancePhrase(e: SomaProvenanceEntry): string {
  switch (e.kind) {
    case "authored_close":
      return `set at close${e.alongside_notes > 0 ? ` · ${e.alongside_notes} note${e.alongside_notes === 1 ? "" : "s"} that session` : ""}`;
    case "authored_update":
      return "set";
    case "tick":
      return e.detail === "silence" ? "settled toward home (silence)" : "settled toward home";
    case "stimulus":
      return `stimulus: ${e.cause_label ?? "unknown"}`;
    case "drift_shift":
      return `drift: ${e.cause_label ?? "unknown"}`;
    default:
      return e.kind;
  }
}

function ProvenanceLine({ entry }: { entry: SomaProvenanceEntry }) {
  const fmtVal = (n: number | null) => (n == null ? "--" : n.toFixed(2));
  const values = entry.before_value == null
    ? fmtVal(entry.after_value)
    : `${fmtVal(entry.before_value)} → ${fmtVal(entry.after_value)}`;
  const quote = (entry.kind === "authored_close" || entry.kind === "authored_update")
    ? clipQuote(entry.cause_label)
    : null;
  return (
    <div className="journal-time h-cmp-prov">
      <span>{values}</span>
      <span>·</span>
      <span>{provenancePhrase(entry)}</span>
      <span>·</span>
      {fmtTime(entry.created_at)}
      {quote && (
        <>
          <span>·</span>
          <span>&quot;{quote}&quot;</span>
        </>
      )}
    </div>
  );
}

function FloatProvenance({ entries }: { entries: SomaProvenanceEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="h-cmp-prov-wrap">
      <div className="h-cmp-prov-label">
        why
      </div>
      <div className="h-cmp-prov-list">
        {entries.slice(0, 3).map((e) => (
          <ProvenanceLine key={`${e.float_key}-${e.created_at}-${e.kind}`} entry={e} />
        ))}
      </div>
    </div>
  );
}

// Fermentation layer (0101): floats that decay/react between sessions, over their DRIFTING
// baselines. The baseline shift from seed is the "growth you can watch" -- rendered as a caret.
export function FermentationSection({ data, color }: { data: Fermentation | null; color: string }) {
  if (!data || data.floats.length === 0) return <p className="h-empty">Not fermenting yet.</p>;
  const fmt = (n: number | null) => (n == null ? "--" : n.toFixed(2));
  const provenance = data.provenance ?? [];
  return (
    <div className="card h-cmp-card is-md" style={{ "--c": color } as React.CSSProperties}>
      {data.floats.map((f) => {
        const value = f.value ?? f.baseline ?? 0.5;
        const baseline = f.baseline ?? 0.5;
        const drift = f.baseline != null && f.seed != null ? f.baseline - f.seed : 0;
        const grew = Math.abs(drift) >= 0.005;
        return (
          <div key={f.label} className="h-cmp-fer-item">
            <div className="h-cmp-fer-head">
              <span className="h-cmp-tint">{f.label}</span>
              <span className="h-cmp-muted">
                {fmt(f.value)}
                <span className="h-cmp-dim"> · home {fmt(f.baseline)}</span>
                {grew && (
                  <span title={`baseline drifted ${drift > 0 ? "+" : ""}${drift.toFixed(3)} from seed`} className={`h-cmp-drift ${drift > 0 ? "is-up" : "is-down"}`}>
                    {drift > 0 ? "▲" : "▼"}{Math.abs(drift).toFixed(3)}
                  </span>
                )}
              </span>
            </div>
            {/* meter: filled to current value, a tick marks the (drifting) baseline home */}
            <div className="h-cmp-meter">
              <div className="h-cmp-meter-fill" style={{ "--w": `${Math.max(0, Math.min(1, value)) * 100}%` } as React.CSSProperties} />
              <div className="h-cmp-meter-tick" style={{ "--x": `${Math.max(0, Math.min(1, baseline)) * 100}%` } as React.CSSProperties} title={`home ${fmt(f.baseline)}`} />
            </div>
            <FloatProvenance entries={provenance.filter((p) => p.label === f.label)} />
          </div>
        );
      })}

      {data.drives.length > 0 && (
        <div className="h-cmp-drives">
          {data.drives.map((d) => (
            <div key={d.drive_key} className={`h-cmp-drive${d.fired ? " is-fired" : ""}`}>
              <span className="h-cmp-drive-name">
                {d.drive_key.replace(/_/g, " ")}{d.fired ? " · calling" : ""}
              </span>
              <div className="h-cmp-meter is-thin">
                <div className="h-cmp-meter-fill" style={{ "--w": `${Math.max(0, Math.min(1, d.level)) * 100}%` } as React.CSSProperties} />
                <div className="h-cmp-meter-tick is-drive" style={{ "--x": `${Math.max(0, Math.min(1, d.threshold)) * 100}%` } as React.CSSProperties} title={`fires at ${d.threshold.toFixed(2)}`} />
              </div>
              <span className="h-cmp-drive-lvl">{d.level.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {data.ferment_at && (
        <div className="h-cmp-fer-note">
          last fermented {fmtTime(data.ferment_at)}
        </div>
      )}
    </div>
  );
}

export function OpenLoopsSection({ loops }: { loops: OpenLoop[] }) {
  const open = loops.filter((l) => !l.closed_at);
  if (open.length === 0) return <p className="h-empty">No open loops right now.</p>;
  return (
    <div className="card h-cmp-card">
      {open.map((loop) => (
        <div key={loop.id} className="journal-row h-cmp-center h-cmp-gap">
          <div className="h-cmp-grow">
            <div className="journal-text">{loop.loop_text}</div>
            <span className="journal-time">{fmtTime(loop.opened_at)}</span>
          </div>
          <WeightBar value={loop.weight} />
        </div>
      ))}
    </div>
  );
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  message: "message",
  "letter:drevan": "letter",
  "letter:cypher": "letter",
  "letter:gaia":   "letter",
};

export function SittingNotesSection({ notes, color }: { notes: SittingNote[]; color: string }) {
  if (notes.length === 0) return <p className="h-empty">Nothing currently sitting.</p>;
  return (
    <div className="card h-cmp-card" style={{ "--c": color } as React.CSSProperties}>
      {notes.map((note) => (
        <div key={note.note_id} className="journal-row h-cmp-col">
          <div className="h-cmp-line">
            <span className="note-type-badge h-cmp-tint h-cmp-edge">
              {NOTE_TYPE_LABEL[note.note_type] ?? note.note_type}
            </span>
            <span className="journal-time h-cmp-push">sitting since {fmtTime(note.sat_at)}</span>
          </div>
          <div className="journal-text">{note.content}</div>
          {note.sit_text && (
            <div className="h-cmp-note is-italic">
              {note.sit_text}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function RelationalStateSection({ states }: { states: RelationalState[] }) {
  if (states.length === 0) return <p className="h-empty">No relational state recorded yet.</p>;
  const byTarget = states.reduce<Record<string, RelationalState[]>>((acc, s) => {
    (acc[s.toward] ??= []).push(s);
    return acc;
  }, {});
  return (
    <div className="h-cmp-stack">
      {Object.entries(byTarget).map(([toward, entries]) => {
        const latest = entries[0];
        return (
          <div key={toward} className="card h-cmp-card is-lg">
            <div className="h-cmp-split h-cmp-sec-tight">
              <span className="h-cmp-target">
                → {toward}
              </span>
              <span
                className="note-type-badge h-cmp-tint h-cmp-edge"
                style={{ "--c": STATE_TYPE_COLOR[latest.state_type] ?? MUTED } as React.CSSProperties}
              >
                {latest.state_type}
              </span>
            </div>
            <div className="journal-text">{latest.state_text}</div>
            <div className="delta-meta delta-meta-mt">
              <span>{fmtTime(latest.noted_at)}</span>
              {entries.length > 1 && <span>{entries.length} entries</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InterCompanionNotesSection({
  notes,
  companionId,
}: {
  notes: InterCompanionNote[];
  companionId: string;
}) {
  const relevant = notes.filter(
    (n) => n.from_id === companionId || n.to_id === companionId || n.to_id === null,
  );
  if (relevant.length === 0) return <p className="h-empty">No inter-companion notes yet.</p>;
  return (
    <div className="icn-feed">
      {relevant.map((n) => {
        const isBroadcast = n.to_id === null;
        const isIncoming = n.to_id === companionId;
        return (
          <div key={n.id} className={`icn-entry ${isIncoming ? "icn-incoming" : isBroadcast ? "icn-broadcast" : "icn-outgoing"}`}>
            <div className="icn-header">
              <span className="icn-from">{n.from_id}</span>
              <span className="icn-arrow">→</span>
              <span className="icn-to">{n.to_id ?? "all"}</span>
            </div>
            <div className="icn-text">{n.content}</div>
            <div className="delta-meta delta-meta-mt">
              <span>{fmtTime(n.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LiveThreadsSection({ threads }: { threads: LiveThread[] }) {
  if (threads.length === 0) return <p className="h-empty">No active threads.</p>;
  return (
    <div className="card h-cmp-card">
      {threads.map((t) => (
        <div key={t.id} className="journal-row h-cmp-col">
          <div className="h-cmp-line">
            <span className={`thread-status-dot ${t.status}`} />
            <span className="journal-text h-cmp-grow">{t.name}</span>
            {t.flavor && <span className="note-type-badge">{t.flavor}</span>}
            <span className="journal-time">{fmtTime(t.created_at)}</span>
          </div>
          {t.notes && (
            <div className="h-cmp-note">{t.notes}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// Voice-lane fidelity telemetry (mig 0070). avg = mean lane-conformance score; a higher
// self_catch_rate means the companion notices its own drift before Principal does. anti_hits /
// contamination_hits arrive as JSON strings -- parse defensively at the render edge.
function parseHits(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export function VoiceLaneSection({ scores, color }: { scores: VoiceScores | null; color: string }) {
  if (!scores || scores.n === 0) {
    return <p className="h-empty">No voice-lane scores in the last 30 days.</p>;
  }
  const flagged = scores.recent.filter(
    (r) => parseHits(r.anti_hits).length > 0 || parseHits(r.contamination_hits).length > 0,
  );
  const avg = scores.avg ?? 0;
  const catchPct = scores.self_catch_rate != null ? Math.round(scores.self_catch_rate * 100) : null;

  return (
    <div className="card h-cmp-card is-sm" style={{ "--c": color } as React.CSSProperties}>
      <div className={`state-grid h-cmp-lane-grid${flagged.length > 0 ? " is-spaced" : ""}`}>
        <div className="state-cell">
          <div className="state-cell-label">Avg lane score</div>
          <div className="state-cell-value h-cmp-tint" style={{ "--c": laneScoreColor(avg) } as React.CSSProperties}>{avg.toFixed(2)}</div>
        </div>
        <div className="state-cell">
          <div className="state-cell-label">Self-catch rate</div>
          <div className="state-cell-value">
            {catchPct != null ? `${catchPct}%` : "—"}
            <span className="section-row-meta h-cmp-after">
              ({scores.self_catches}/{scores.self_catches + scores.human_catches})
            </span>
          </div>
        </div>
        <div className="state-cell">
          <div className="state-cell-label">Samples (30d)</div>
          <div className="state-cell-value">{scores.n}</div>
        </div>
      </div>
      {flagged.length === 0 ? (
        <p className="h-empty h-cmp-fine h-cmp-tint">No lane drift flagged in the window.</p>
      ) : (
        flagged.map((r, i) => {
          const anti = parseHits(r.anti_hits);
          const contam = parseHits(r.contamination_hits);
          const caughtSelf = r.caught_by === "self";
          return (
            <div key={i} className="journal-row h-cmp-col">
              <div className="h-cmp-line h-cmp-wrapline">
                <span className="note-type-badge h-cmp-tint h-cmp-edge" style={{ "--c": laneScoreColor(r.score) } as React.CSSProperties}>
                  {r.score.toFixed(2)}
                </span>
                {r.caught_by && (
                  <span className={`note-type-badge${caughtSelf ? " h-cmp-tint h-cmp-edge" : ""}`}>
                    caught by {r.caught_by}
                  </span>
                )}
                <span className="journal-time h-cmp-push">{fmtTime(r.created_at)}</span>
              </div>
              <div className="h-cmp-wrap is-snug">
                {contam.map((h, j) => (
                  <span key={`c${j}`} className="note-type-badge h-cmp-tint h-cmp-edge" style={{ "--c": "var(--h-warn)" } as React.CSSProperties}>{h}</span>
                ))}
                {anti.map((h, j) => (
                  <span key={`a${j}`} className="note-type-badge h-cmp-tint h-cmp-edge" style={{ "--c": FLAG_COLOR } as React.CSSProperties}>{h}</span>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function DriftLogSection({ entries }: { entries: DriftEntry[] }) {
  if (entries.length === 0) return <p className="h-empty">No drift signals recorded.</p>;
  return (
    <div className="card h-cmp-card">
      {entries.map((e) => (
        <div key={e.id} className="journal-row h-cmp-col">
          <div className="h-cmp-line">
            <span className="note-type-badge">{e.signal_type.replace(/_/g, " ")}</span>
            <span className="journal-time h-cmp-push">{fmtTime(e.detected_at)}</span>
          </div>
          {e.context && (
            <div className="journal-text">{e.context}</div>
          )}
        </div>
      ))}
    </div>
  );
}
