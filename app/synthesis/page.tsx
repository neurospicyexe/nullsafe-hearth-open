export const dynamic = 'force-dynamic';

import Link from "next/link";
import { fetchSynthesisSummariesOrNull } from "@/lib/halseth";
import { isCompanionKey, toneOf } from "@/lib/tone";
import { HALSETH_DOWN } from "@/lib/archive-copy";
import ClientTime from "@/components/ClientTime";

// Synthesis summaries were the last stream on the home dashboard with no "see all" -- every other
// section there had one, and this table had no full-list surface anywhere in Hearth. The home card
// showed 5 of 20 fetched and stopped.
//
// /ingest/synthesis-summaries caps limit at 500 and takes no offset, so this page names what it
// fetched rather than implying it holds everything.
const PAGE_LIMIT = 200;

const FILTERS = [
  { key: "", label: "all" },
  { key: "drevan", label: "drevan" },
  { key: "cypher", label: "cypher" },
  { key: "gaia", label: "gaia" },
  { key: "cross", label: "cross-companion" },
];

function parseThreads(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as string[]) : [];
  } catch {
    // Not JSON -- older rows stored a plain string. Show it rather than dropping it silently.
    return [raw];
  }
}

export default async function SynthesisPage({
  searchParams,
}: {
  searchParams: Promise<{ companion?: string }>;
}) {
  const { companion: rawCompanion } = await searchParams;
  const raw = rawCompanion?.toLowerCase();
  const companion = raw && (isCompanionKey(raw) || raw === "cross") ? raw : null;

  const all = await fetchSynthesisSummariesOrNull(PAGE_LIMIT);

  if (all === null) {
    return (
      <div className="h-reading">
        <h1 className="h-page-title">Synthesis</h1>
        <p className="h-home-quiet">{HALSETH_DOWN}</p>
      </div>
    );
  }

  // companion_id NULL means cross-companion, which is a real category rather than missing data --
  // so "cross" is a filter value, not an absence to hide.
  const summaries = companion
    ? all.filter((s) => (companion === "cross" ? s.companion_id === null : s.companion_id === companion))
    : all;

  return (
    <div className="h-reading">
      <h1 className="h-page-title">Synthesis</h1>
      <p className="h-synth-sub">what the swarm made of a session, a day, a topic</p>

      <div className="h-chips">
        {FILTERS.map((f) => {
          const active = (f.key || null) === companion;
          return (
            <Link
              key={f.key || "all"}
              href={f.key ? `/synthesis?companion=${f.key}` : "/synthesis"}
              className={`h-chip ${active ? "is-on" : ""}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {summaries.length === 0 ? (
        <p className="h-home-quiet">
          {companion ? `No synthesis for ${companion} in this window.` : "No synthesis summaries yet."}
        </p>
      ) : (
        <>
          <p className="h-synth-meta">
            {summaries.length} summar{summaries.length === 1 ? "y" : "ies"} (most recent {PAGE_LIMIT} fetched
            {all.length >= PAGE_LIMIT ? "; older ones exist beyond this window" : ""})
          </p>

          <div className="h-synth-feed">
            {summaries.map((s) => {
              const threads = parseThreads(s.open_threads);
              const who = s.companion_id ?? "cross-companion";
              return (
                <article key={s.id} className="h-synth-entry">
                  <header className="h-mem-head">
                    <b className={toneOf(s.companion_id)}>{who}</b>
                    <span className="h-mem-badge">{s.summary_type.replace(/_/g, " ")}</span>
                    <span className="h-mem-time"><ClientTime iso={s.created_at} /></span>
                  </header>
                  {s.subject && <p className="h-synth-subject">{s.subject}</p>}
                  {s.narrative && <p className="h-mem-body">{s.narrative}</p>}
                  {s.emotional_register && <p className="h-synth-register">{s.emotional_register}</p>}
                  {threads.length > 0 && (
                    <div className="h-synth-threads">
                      {threads.map((t, i) => (
                        <span key={i} className="h-synth-thread">{t}</span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
