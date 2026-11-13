export const dynamic = 'force-dynamic';

import Link from "next/link";
import {
  fetchAutonomyRuns,
  fetchAutonomyReflections,
  fetchAutonomySeeds,
  fetchGrowthJournal,
  fetchGrowthPatterns,
} from "@/lib/halseth";
import type {
  AutonomyRun,
  AutonomyReflection,
  AutonomySeed,
  GrowthJournalEntry,
  GrowthPattern,
} from "@/lib/halseth";
import { COMPANION_CONFIG } from "@/app/companions/[id]/sections";
import ClientTime from "@/components/ClientTime";
import { toneOf } from "@/lib/tone";
import { MUTED, tint } from "@/lib/domain-colors";
import { entryTypeColor, runStatusColor, seedTypeColor } from "@/app/companions/[id]/domain-colors";
import ExpandText from "@/components/kit/ExpandText";

const COMPANIONS = ["drevan", "cypher", "gaia"] as const;
type CompanionId = typeof COMPANIONS[number];

function todayUtcMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export default async function AutonomousPage() {
  const [
    drevanRunsRes, cypherRunsRes, gaiaRunsRes,
    drevanJournalRes, cypherJournalRes, gaiaJournalRes,
    drevanPatternsRes, cypherPatternsRes, gaiaPatternsRes,
    drevanReflectionsRes, cypherReflectionsRes, gaiaReflectionsRes,
    drevanSeedsRes, cypherSeedsRes, gaiaSeedsRes,
  ] = await Promise.allSettled([
    fetchAutonomyRuns("drevan", 10),
    fetchAutonomyRuns("cypher", 10),
    fetchAutonomyRuns("gaia", 10),
    fetchGrowthJournal("drevan", 10),
    fetchGrowthJournal("cypher", 10),
    fetchGrowthJournal("gaia", 10),
    fetchGrowthPatterns("drevan"),
    fetchGrowthPatterns("cypher"),
    fetchGrowthPatterns("gaia"),
    fetchAutonomyReflections("drevan", 5),
    fetchAutonomyReflections("cypher", 5),
    fetchAutonomyReflections("gaia", 5),
    fetchAutonomySeeds("drevan"),
    fetchAutonomySeeds("cypher"),
    fetchAutonomySeeds("gaia"),
  ]);

  const drevanRuns    = (drevanRunsRes.status    === "fulfilled" ? drevanRunsRes.value    : null) ?? [];
  const cypherRuns    = (cypherRunsRes.status    === "fulfilled" ? cypherRunsRes.value    : null) ?? [];
  const gaiaRuns      = (gaiaRunsRes.status      === "fulfilled" ? gaiaRunsRes.value      : null) ?? [];
  const drevanJournal = (drevanJournalRes.status === "fulfilled" ? drevanJournalRes.value : null) ?? [];
  const cypherJournal = (cypherJournalRes.status === "fulfilled" ? cypherJournalRes.value : null) ?? [];
  const gaiaJournal   = (gaiaJournalRes.status   === "fulfilled" ? gaiaJournalRes.value   : null) ?? [];
  const drevanPatterns  = (drevanPatternsRes.status  === "fulfilled" ? drevanPatternsRes.value  : null) ?? [];
  const cypherPatterns  = (cypherPatternsRes.status  === "fulfilled" ? cypherPatternsRes.value  : null) ?? [];
  const gaiaPatterns    = (gaiaPatternsRes.status    === "fulfilled" ? gaiaPatternsRes.value    : null) ?? [];
  const drevanReflections = (drevanReflectionsRes.status === "fulfilled" ? drevanReflectionsRes.value : null) ?? [];
  const cypherReflections = (cypherReflectionsRes.status === "fulfilled" ? cypherReflectionsRes.value : null) ?? [];
  const gaiaReflections   = (gaiaReflectionsRes.status   === "fulfilled" ? gaiaReflectionsRes.value   : null) ?? [];
  const drevanSeeds = (drevanSeedsRes.status === "fulfilled" ? drevanSeedsRes.value : null) ?? [];
  const cypherSeeds = (cypherSeedsRes.status === "fulfilled" ? cypherSeedsRes.value : null) ?? [];
  const gaiaSeeds   = (gaiaSeedsRes.status   === "fulfilled" ? gaiaSeedsRes.value   : null) ?? [];

  const allRuns = [
    ...drevanRuns.map(r => ({ ...r, companion: "drevan" as CompanionId })),
    ...cypherRuns.map(r => ({ ...r, companion: "cypher" as CompanionId })),
    ...gaiaRuns.map(r  => ({ ...r, companion: "gaia"   as CompanionId })),
  ];

  const todayStart = todayUtcMs();
  const todayCount = allRuns.filter(r => {
    if (!r.created_at) return false;
    return new Date(r.created_at).getTime() >= todayStart;
  }).length;

  const mostRecentRun = allRuns
    .filter(r => !!r.created_at)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())[0] ?? null;

  const hasRunning = allRuns.some(r => r.status === "running");

  const perCompanion: Record<CompanionId, {
    runs: AutonomyRun[];
    journal: GrowthJournalEntry[];
    patterns: GrowthPattern[];
    reflections: AutonomyReflection[];
    seeds: AutonomySeed[];
  }> = {
    drevan: { runs: drevanRuns, journal: drevanJournal, patterns: drevanPatterns, reflections: drevanReflections, seeds: drevanSeeds },
    cypher: { runs: cypherRuns, journal: cypherJournal, patterns: cypherPatterns, reflections: cypherReflections, seeds: cypherSeeds },
    gaia:   { runs: gaiaRuns,   journal: gaiaJournal,   patterns: gaiaPatterns,   reflections: gaiaReflections,   seeds: gaiaSeeds   },
  };

  return (
    <>
      {/* Page header */}
      <header className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Autonomous</h1>
        </div>
      </header>

      {/* Summary bar */}
      <div className="home-section-card h-hood-mb-lg">
        <div className="h-hood-row is-center is-wide-gap">
          {/* Runs today */}
          <div className="h-hood-col">
            <span className="state-cell-label">Runs today</span>
            <span className="state-cell-value">{todayCount}</span>
          </div>

          {/* Most recent */}
          {mostRecentRun && (
            <div className="h-hood-col">
              <span className="state-cell-label">Most recent</span>
              <div className="h-hood-row is-center">
                <span className={`h-tone-dot ${toneOf(mostRecentRun.companion)}`} />
                <span className="h-hood-ink">
                  {COMPANION_CONFIG[mostRecentRun.companion]?.display ?? mostRecentRun.companion}
                  {" · "}
                  {mostRecentRun.run_type}
                </span>
                <span className="section-row-meta h-hood-small">
                  {mostRecentRun.created_at ? <ClientTime iso={mostRecentRun.created_at} /> : "—"}
                </span>
              </div>
            </div>
          )}

          {/* Live indicator */}
          {hasRunning && (
            <div className="h-hood-row is-center is-push">
              <span className="live-dot" />
              <span className="h-hood-live">actively running</span>
            </div>
          )}
        </div>
      </div>

      {/* Three-column grid */}
      <div className="h-hood-cols is-start">
        {COMPANIONS.map((id) => {
          const config = COMPANION_CONFIG[id];
          const { runs, journal, patterns, reflections, seeds } = perCompanion[id];

          const sortedRuns = [...runs].sort((a, b) => {
            const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bT - aT;
          });
          const lastRun = sortedRuns[0] ?? null;

          const sortedJournal = [...journal].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ).slice(0, 3);

          const topPatterns = [...patterns].sort((a, b) => b.strength - a.strength).slice(0, 2);

          const recentReflections = [...reflections].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ).slice(0, 3);

          const statusColor = lastRun ? runStatusColor(lastRun.status) : MUTED;

          return (
            <div key={id} className="card h-hood-card is-stack">
              {/* Companion name header */}
              <div className="h-hood-row is-center">
                <span className={`h-hood-who ${toneOf(id)}`}>
                  {config.sym} {config.display}
                </span>
              </div>

              {/* Last run card */}
              <div>
                <span className="home-section-title h-hood-label">Last Run</span>
                {lastRun ? (
                  <div className="section-row h-hood-lastrun">
                    <div className="h-hood-row is-center">
                      <span className="h-cmp-badge">{lastRun.run_type}</span>
                      <span className="h-cmp-badge" style={tint(statusColor)}>
                        {lastRun.status === "running" && <span className="live-dot" />}
                        {lastRun.status}
                      </span>
                    </div>
                    <span className="section-row-meta h-hood-small">
                      {lastRun.started_at ? <ClientTime iso={lastRun.started_at} /> : "not started"}
                    </span>
                    <div className="h-hood-row">
                      <span className="section-row-meta h-hood-small">tokens: {lastRun.tokens_used ?? 0}</span>
                      <span className="section-row-meta h-hood-small">artifacts: {lastRun.artifacts_created ?? 0}</span>
                    </div>
                  </div>
                ) : (
                  <p className="h-empty h-hood-flat">No runs yet</p>
                )}
              </div>

              {/* Recent journal */}
              <div>
                <span className="home-section-title h-hood-label">Recent Journal</span>
                {sortedJournal.length === 0 ? (
                  <p className="h-empty h-hood-flat">No journal entries</p>
                ) : (
                  <div className="h-hood-list">
                    {sortedJournal.map((entry) => (
                      <div key={entry.id} className="journal-row h-hood-top-row">
                        <span className="h-cmp-badge h-hood-fixed" style={tint(entryTypeColor(entry.entry_type))}>
                          {entry.entry_type}
                        </span>
                        <span className="journal-text h-hood-grow h-hood-small">
                          <ExpandText as="span" text={entry.content} limit={100} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top patterns */}
              <div>
                <span className="home-section-title h-hood-label">Top Patterns</span>
                {topPatterns.length === 0 ? (
                  <p className="h-empty h-hood-flat">No patterns</p>
                ) : (
                  <div className="h-hood-list is-tight">
                    {topPatterns.map((p) => (
                      <span
                        key={p.id}
                        className="journal-text h-hood-small h-hood-faded"
                        style={{ "--o": 0.5 + (p.strength / 10) * 0.5 } as React.CSSProperties}
                      >
                        <ExpandText as="span" text={p.pattern_text} limit={80} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Queued seeds */}
              <div>
                <span className="home-section-title h-hood-label">
                  Queued Seeds
                  {seeds.length > 0 && (
                    <span className="section-row-meta h-hood-inline-note">
                      ({seeds.length} available)
                    </span>
                  )}
                  {/* The count was already honest; there was just nothing to click. Seeds are
                      managed on the companion's own autonomy page. */}
                  {seeds.length > 3 && (
                    <Link
                      href={`/companions/${id}/autonomy`}
                      className="home-section-link h-hood-inline-note"
                    >
                      see all →
                    </Link>
                  )}
                </span>
                {seeds.length === 0 ? (
                  <p className="h-empty h-hood-flat">No seeds queued</p>
                ) : (
                  <div className="h-hood-list">
                    {seeds.slice(0, 3).map((s) => (
                      <div key={s.id} className="h-hood-top-row">
                        <span className="h-cmp-badge h-hood-fixed" style={tint(seedTypeColor(s.seed_type))}>
                          {s.seed_type.replace("_", " ")}
                        </span>
                        <span className="journal-text h-hood-grow h-hood-small">
                          <ExpandText as="span" text={s.content} limit={90} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent reflections */}
              <div>
                <span className="home-section-title h-hood-label">Recent Reflections</span>
                {recentReflections.length === 0 ? (
                  <p className="h-empty h-hood-flat">No reflections yet</p>
                ) : (
                  <div className="h-hood-list is-roomy">
                    {recentReflections.map((r) => (
                      <div key={r.id} className="h-hood-col is-tight">
                        <span className="journal-text h-hood-small h-hood-leading">
                          <ExpandText as="span" text={r.reflection_text} limit={140} />
                        </span>
                        <span className="section-row-meta h-hood-small">
                          <ClientTime iso={r.created_at} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer links */}
              <div className="h-hood-row is-foot">
                <Link href={`/companions/${id}/autonomy`} className="home-section-link">
                  → runs
                </Link>
                <Link href={`/companions/${id}/growth`} className="home-section-link">
                  → growth
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
