export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchCompanionJournal,
  fetchCompanionDeltas,
  fetchCypherAudit,
  fetchGaiaWitness,
  fetchNotes,
  fetchCompanionNotesByAgent,
  fetchMindState,
  wmOrientFromMindState,
  fetchSynthesisSummaries,
  fetchInterCompanionNotes,
  fetchSomaStates,
  fetchFermentation,
  fetchSomaFeelings,
  fetchLoops,
  fetchSittingNotes,
  fetchRelationalHistory,
  fetchLiveThreads,
  fetchDriftLog,
  fetchGrowthJournal,
  fetchAutonomyRuns,
  fetchConclusions,
  fetchVoiceScores,
} from "@/lib/halseth";
import type {
  CypherAuditEntry,
  GaiaWitnessEntry,
  Note,
  CompanionNote,
  CompanionSomaState,
  SomaFeeling,
  OpenLoop,
  SittingNote,
  RelationalState,
  LiveThread,
  DriftEntry,
  GrowthJournalEntry,
  AutonomyRun,
} from "@/lib/halseth";
import { LetterFormClient } from "../client";
import {
  COMPANION_CONFIG,
  fmtTime,
  JournalSection,
  DeltasSection,
  NotesSection,
  CypherAuditSection,
  GaiaWitnessSection,
  ContinuitySection,
  SynthesisSummarySection,
  InterCompanionNotesSection,
  SomaFeelingsSection,
  FermentationSection,
  OpenLoopsSection,
  SittingNotesSection,
  RelationalStateSection,
  LiveThreadsSection,
  DriftLogSection,
  VoiceLaneSection,
} from "../sections";
import { parseCompanionId } from "@/lib/companion-page";
import { COMPANION_COLOR } from "@/lib/shell";
import { entryTypeColor, runStatusColor, beliefTypeColor, FLAG_COLOR } from "../domain-colors";
import ExpandText from "@/components/kit/ExpandText";

// ── Letters ───────────────────────────────────────────────────────────────────

type LetterItem =
  | { kind: "incoming"; note: CompanionNote; at: string }
  | { kind: "outgoing"; note: Note;          at: string };

function LettersSection({
  incoming,
  outgoing,
  companionId,
  config,
}: {
  incoming: CompanionNote[];
  outgoing: Note[];
  companionId: string;
  config: { display: string };
}) {
  const letters: LetterItem[] = [
    ...incoming.map((n): LetterItem => ({ kind: "incoming", note: n, at: n.created_at })),
    ...outgoing.map((n): LetterItem => ({ kind: "outgoing", note: n, at: n.created_at })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="letter-section-wrap">
      <LetterFormClient companionId={companionId} companionName={config.display} />
      {letters.length === 0 ? (
        <p className="h-empty">
          No letters yet. Write something — {config.display} will find it next session.
        </p>
      ) : (
        <div className="letter-thread">
          {letters.map((item) => {
            if (item.kind === "incoming") {
              return (
                <div key={item.note.id} className="letter-bubble incoming">
                  <div className="letter-body">{item.note.note_text}</div>
                  <div className="letter-meta">
                    <span className="h-cmp-who">{config.display}</span>
                    <span>·</span>
                    <span>{fmtTime(item.note.created_at)}</span>
                  </div>
                </div>
              );
            }
            return (
              <div key={item.note.id} className="letter-bubble outgoing">
                <div className="letter-body">{item.note.content}</div>
                <div className="letter-meta">
                  <span>{fmtTime(item.note.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default async function CompanionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  // Lowercase + validate once, before any Halseth call; every fetch below gets the parsed id.
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const [journal, deltas, notes, companionNotes, audit, witness, synthesis, icNotes, soma, feelings, loops, sitting, relational, liveThreads, driftLog, growthJournal, autonomyRuns, conclusionsRes, voiceScoresRes, fermentRes, mindStateRes] = await Promise.allSettled([
    fetchCompanionJournal(id, 6, { substantive: true }),
    fetchCompanionDeltas(id, 6),
    fetchNotes(100),
    fetchCompanionNotesByAgent(id, 50),
    id === "cypher" ? fetchCypherAudit(6)  : Promise.resolve(null as CypherAuditEntry[] | null),
    id === "gaia"   ? fetchGaiaWitness(6, { onlyGaia: true })  : Promise.resolve(null as GaiaWitnessEntry[] | null),
    fetchSynthesisSummaries(20),
    fetchInterCompanionNotes(30),
    fetchSomaStates(),
    fetchSomaFeelings(id, 6),
    fetchLoops(id),
    fetchSittingNotes(id),
    fetchRelationalHistory(id, 12),
    fetchLiveThreads(id, "active", 10),
    fetchDriftLog(id, 10),
    fetchGrowthJournal(id, 3),
    fetchAutonomyRuns(id, 3),
    fetchConclusions(id),
    fetchVoiceScores(id, 30),
    fetchFermentation(id),
    // D11 (2026-08-15): the loader names sources that FAILED this load in meta.degraded;
    // this page is the human tending surface, so it wears the badge. Pure read, safe to poll.
    // Also the single source for the continuity panel (wmOrientFromMindState below): the page used
    // to call fetchWmOrient(id) alongside this, which was the same /mind/state read twice.
    fetchMindState(id),
  ]);

  const journalEntries  = journal.status        === "fulfilled" ? journal.value        : null;
  const deltaEntries    = deltas.status         === "fulfilled" ? deltas.value         : [];
  const allNotes        = notes.status          === "fulfilled" ? notes.value          : [];
  const allCompNotes    = companionNotes.status === "fulfilled" ? companionNotes.value : [];
  const auditEntries    = audit.status          === "fulfilled" ? audit.value          : null;
  const witnessEntries  = witness.status        === "fulfilled" ? witness.value        : null;
  const summaryEntries  = synthesis.status      === "fulfilled" ? synthesis.value      : [];
  const icNoteEntries   = icNotes.status        === "fulfilled" ? icNotes.value        : [];
  // Same predicate InterCompanionNotesSection applies internally, hoisted so the clip and the
  // "see all" count are both taken AFTER the filter rather than above it.
  const icNotesForThisCompanion = icNoteEntries.filter(
    (n) => n.from_id === id || n.to_id === id || n.to_id === null,
  );
  const somaData        = soma.status           === "fulfilled" ? soma.value           : null;
  const companionSoma   = somaData ? (somaData[id as keyof typeof somaData] as CompanionSomaState) : null;
  const fermentData     = fermentRes.status     === "fulfilled" ? fermentRes.value : null;
  const feelingEntries  = feelings.status       === "fulfilled" ? (feelings.value as SomaFeeling[]) : [];
  const loopEntries     = loops.status          === "fulfilled" ? (loops.value as OpenLoop[])       : [];
  const sittingEntries  = sitting.status        === "fulfilled" ? (sitting.value as SittingNote[])  : [];
  const relationalItems    = relational.status    === "fulfilled" ? (relational.value as RelationalState[]) : [];
  const threadItems        = liveThreads.status   === "fulfilled" ? (liveThreads.value as LiveThread[])     : [];
  const driftItems         = driftLog.status      === "fulfilled" ? (driftLog.value as DriftEntry[])           : [];
  const growthJournalItems = (growthJournal.status === "fulfilled" ? growthJournal.value : null) ?? [];
  const autonomyRunItems   = (autonomyRuns.status  === "fulfilled" ? autonomyRuns.value  : null) ?? [];
  const conclusionItems    = (conclusionsRes.status === "fulfilled" ? conclusionsRes.value : null) ?? [];
  const voiceScores        = voiceScoresRes.status === "fulfilled" ? voiceScoresRes.value : null;
  const degradedSources    = mindStateRes.status === "fulfilled" ? (mindStateRes.value?.meta?.degraded ?? []) : [];
  const mindState          = mindStateRes.status === "fulfilled" ? mindStateRes.value : null;
  const orientData         = mindState ? wmOrientFromMindState(mindState) : null;

  const lettersOut   = allNotes.filter((n) => n.note_type === `letter:${id}`);
  const lettersIn    = allCompNotes.filter((n) => n.tags?.includes("letter") ?? false);
  const regularNotes = allNotes.filter(
    (n) => n.author === id && n.note_type !== `letter:${id}`,
  );

  return (
    <div data-companion={id}>
      {/* Header */}
      <div className="companion-header">
        <div className={`companion-avatar companion-avatar--lg ${id}`}>
          {config.sym}
        </div>
        <div className="h-cmp-grow">
          <h1 className="companion-header-name">{config.display}</h1>
          <p className="companion-header-tagline">{config.tagline}</p>
          {degradedSources.length > 0 && (
            // D11: a dead source must not pass for a quiet one. Sections fed by these sources
            // are MISSING below, not empty.
            <p className="h-cmp-warn">
              ⚠ state load degraded: {degradedSources.join(", ")} — affected sections are missing, not empty
            </p>
          )}
          {companionSoma && (
            <div className="soma-header-strip">
              {companionSoma.compound_state && (
                <span className="soma-compound">{companionSoma.compound_state}</span>
              )}
              {companionSoma.current_mood && (
                <span className="soma-mood">{companionSoma.current_mood}</span>
              )}
              {companionSoma.surface_emotion && (
                <span className="soma-surface">
                  {companionSoma.surface_emotion}
                  {companionSoma.surface_intensity != null && (
                    <span className="soma-intensity"> {companionSoma.surface_intensity}</span>
                  )}
                </span>
              )}
              {[
                { val: companionSoma.soma_float_1, label: companionSoma.float_1_label },
                { val: companionSoma.soma_float_2, label: companionSoma.float_2_label },
                { val: companionSoma.soma_float_3, label: companionSoma.float_3_label },
              ]
                .filter((f): f is { val: number; label: string | null } => Number.isFinite(f.val as number))
                .map((f, i) => (
                  <span key={i} className="soma-float-chip">
                    {f.label ?? `f${i + 1}`} <span className="soma-float-val">{f.val.toFixed(2)}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Fermentation — floats vs their drifting baselines + the new felt-needs (growth you can watch) */}
      <section className="page-section">
        <h2 className="section-title">Fermentation</h2>
        <FermentationSection data={fermentData} color={COMPANION_COLOR[id]} />
      </section>

      {/* Letters — full thread, unchanged */}
      <section className="page-section">
        <h2 className="section-title">Letters</h2>
        <LettersSection
          incoming={lettersIn}
          outgoing={lettersOut}
          companionId={id}
          config={config}
        />
      </section>

      {/* Identity Journal — clipped to 5 */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">Identity Journal</h2>
          {journalEntries !== null && journalEntries.length > 5 && (
            <Link href={`/companions/${id}/journal`} className="home-section-link">see more →</Link>
          )}
        </div>
        <JournalSection entries={journalEntries !== null ? journalEntries.slice(0, 5) : null} />
      </section>

      {/* Relational Deltas — clipped to 5 */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">Relational Deltas</h2>
          {deltaEntries.length > 5 && (
            <Link href={`/companions/${id}/deltas`} className="home-section-link">see more →</Link>
          )}
        </div>
        <DeltasSection deltas={deltaEntries.slice(0, 5)} />
      </section>

      {/* Notes — clipped to 5 */}
      {regularNotes.length > 0 && (
        <section className="page-section">
          <div className="section-header">
            <h2 className="section-title section-title-flush">Notes</h2>
            {regularNotes.length > 5 && (
              <Link href={`/companions/${id}/notes`} className="home-section-link">see more →</Link>
            )}
          </div>
          <NotesSection notes={regularNotes.slice(0, 5)} companionId={id} />
        </section>
      )}

      {/* Cypher Audit Log — clipped to 5 */}
      {id === "cypher" && (
        <section className="page-section">
          <div className="section-header">
            <h2 className="section-title section-title-flush">Audit Log</h2>
            {auditEntries !== null && auditEntries.length > 5 && (
              <Link href="/companions/cypher/audit" className="home-section-link">see more →</Link>
            )}
          </div>
          <CypherAuditSection entries={auditEntries !== null ? auditEntries.slice(0, 5) : null} />
        </section>
      )}

      {/* Gaia's own witnessing, clipped to 5. Only rows on a Gaia session: the table is a shared
          ledger (2026-11-11), so the rest belong to the shared page, labelled by author. */}
      {id === "gaia" && (
        <section className="page-section">
          <div className="section-header">
            <h2 className="section-title section-title-flush">Her witness</h2>
            <Link href="/companions/gaia/witness" className="home-section-link">shared ledger →</Link>
          </div>
          <GaiaWitnessSection
            entries={witnessEntries !== null ? witnessEntries.slice(0, 5) : null}
            showAuthor={false}
            emptyText="Nothing she has written here lately."
          />
        </section>
      )}

      {/* WebMind Continuity */}
      <section className="page-section">
        <h2 className="section-title">Continuity</h2>
        <ContinuitySection data={orientData} />
      </section>

      {/* Synthesis Summaries — clipped to 5 */}
      <section className="page-section">
        <h2 className="section-title">Synthesis</h2>
        <SynthesisSummarySection entries={summaryEntries.slice(0, 5)} companionId={id} />
      </section>

      {/* Inter-Companion Notes — clipped to 5.
          The clip used to be `.slice(0, 5)` BEFORE InterCompanionNotesSection filtered the list
          down to notes involving this companion, so five rows about the other two left this
          section empty and the notes that did belong here unreachable. Filter first, clip second:
          a limit applied above its own filter can only ever under-report. */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">Between Companions</h2>
          {icNotesForThisCompanion.length > 5 && (
            <Link href={`/between?companion=${id}`} className="home-section-link">
              see all {icNotesForThisCompanion.length}+ →
            </Link>
          )}
        </div>
        <InterCompanionNotesSection notes={icNotesForThisCompanion.slice(0, 5)} companionId={id} />
      </section>

      {/* SOMA Feelings — clipped to 6 */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">SOMA Feelings</h2>
          <Link href={`/companions/${id}/feelings`} className="home-section-link">all →</Link>
        </div>
        <SomaFeelingsSection feelings={feelingEntries} color={COMPANION_COLOR[id]} />
      </section>

      {/* Open Loops */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">Open Loops</h2>
          <Link href={`/companions/${id}/loops`} className="home-section-link">all →</Link>
        </div>
        <OpenLoopsSection loops={loopEntries} />
      </section>

      {/* Sitting Notes */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">Sitting Notes</h2>
          <Link href={`/companions/${id}/sitting`} className="home-section-link">all →</Link>
        </div>
        <SittingNotesSection notes={sittingEntries} color={COMPANION_COLOR[id]} />
      </section>

      {/* Relational State */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">Relational State</h2>
          <Link href={`/companions/${id}/relational`} className="home-section-link">full history →</Link>
        </div>
        <RelationalStateSection states={relationalItems} />
      </section>

      {/* Live Threads */}
      {threadItems.length > 0 && (
        <section className="page-section">
          <h2 className="section-title">Live Threads</h2>
          <LiveThreadsSection threads={threadItems} />
        </section>
      )}

      {/* Drift Log */}
      {driftItems.length > 0 && (
        <section className="page-section">
          <h2 className="section-title">Drift Signals</h2>
          <DriftLogSection entries={driftItems} />
        </section>
      )}

      {/* Voice Lane — lane-fidelity telemetry from bot replies */}
      <section className="page-section">
        <h2 className="section-title">Voice Lane</h2>
        <VoiceLaneSection scores={voiceScores} color={COMPANION_COLOR[id]} />
      </section>

      {/* Growth Preview */}
      {growthJournalItems.length > 0 && (
        <section className="page-section">
          <div className="section-header">
            <h2 className="section-title section-title-flush">Growth</h2>
            <Link href={`/companions/${id}/growth`} className="home-section-link">see more →</Link>
          </div>
          <div className="section-list">
            {growthJournalItems.map((entry) => {
              return (
                <div key={entry.id} className="section-row">
                  <span
                    className="h-cmp-badge"
                    style={{ "--c": entryTypeColor(entry.entry_type) } as React.CSSProperties}
                  >
                    {entry.entry_type}
                  </span>
                  <span className="section-row-text">
                    <ExpandText as="span" text={entry.content} limit={120} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Autonomy Preview */}
      {autonomyRunItems.length > 0 && (
        <section className="page-section">
          <div className="section-header">
            <h2 className="section-title section-title-flush">Autonomy</h2>
            <Link href={`/companions/${id}/autonomy`} className="home-section-link">see more →</Link>
          </div>
          <div className="section-list">
            {autonomyRunItems.map((run) => {
              return (
                <div key={run.id} className="section-row">
                  <span className="section-row-label">{run.run_type}</span>
                  <span
                    className="h-cmp-badge"
                    style={{ "--c": runStatusColor(run.status) } as React.CSSProperties}
                  >
                    {run.status}
                  </span>
                  <span className="section-row-meta">
                    {run.started_at ? new Date(run.started_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Worldview Preview */}
      {conclusionItems.filter((c) => !c.superseded_by).length > 0 && (
        <section className="page-section">
          <div className="section-header">
            <h2 className="section-title section-title-flush">Worldview</h2>
            <Link href={`/companions/${id}/worldview`} className="home-section-link">see more →</Link>
          </div>
          <div className="section-list">
            {conclusionItems
              .filter((c) => !c.superseded_by)
              .slice(0, 3)
              .map((c) => {
                const flagged = c.contradiction_flagged === 1;
                return (
                  <div key={c.id} className="section-row">
                    <span
                      className="h-cmp-badge"
                      style={{ "--c": beliefTypeColor(c.belief_type) } as React.CSSProperties}
                    >
                      {c.belief_type}
                    </span>
                    <span className="section-row-text">
                      <ExpandText as="span" text={c.conclusion_text} limit={120} />
                    </span>
                    {flagged && (
                      <span className="section-row-meta h-cmp-tint" style={{ "--c": FLAG_COLOR } as React.CSSProperties}>[?]</span>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Memory blocks link — data-heavy, sub-page only */}
      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title section-title-flush">Memory Blocks</h2>
          <Link href={`/companions/${id}/blocks`} className="home-section-link">view →</Link>
        </div>
        <p className="h-empty h-cmp-fine">
          Full context blocks live on the sub-page.
        </p>
      </section>
    </div>
  );
}
