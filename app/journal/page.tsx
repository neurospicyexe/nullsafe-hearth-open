export const dynamic = "force-dynamic";

import Link from "next/link";
import { fetchCompanionJournal, fetchHumanJournalOrNull } from "@/lib/halseth";
import { isLetterRow } from "@/lib/journal-model";
import { HALSETH_DOWN } from "@/lib/archive-copy";
import { toneOf } from "@/lib/tone";
import ClientTime from "@/components/ClientTime";

export const metadata = { title: "Journals | Hearth" };

function agentDisplayName(agent: string): string {
  return agent.charAt(0).toUpperCase() + agent.slice(1);
}

export default async function JournalPage() {
  const [companion, human] = await Promise.all([
    fetchCompanionJournal(undefined, 200, { substantive: true }),
    fetchHumanJournalOrNull(100),
  ]);

  const companionEntries = companion ? companion.filter((e) => !isLetterRow(e.tags, e.review_state)) : null;

  return (
    <div className="h-reading">
      <h1 className="h-page-title">Journals</h1>

      <section className="h-section">
        <h2 className="h-section-title">Companion journal</h2>
        {companionEntries === null ? (
          <p className="h-home-quiet">{HALSETH_DOWN}</p>
        ) : companionEntries.length === 0 ? (
          <p className="h-home-quiet">No companion entries yet.</p>
        ) : (
          companionEntries.map((e) => (
            <article key={e.id} className="h-journal-entry">
              <header className="h-journal-head">
                <b className={toneOf(e.agent)}>{agentDisplayName(e.agent)}</b>
                {e.review_state && e.review_state !== "kept" && (
                  <span className="h-meta">{e.review_state}</span>
                )}
                <span className="h-meta"><ClientTime iso={e.created_at} /></span>
              </header>
              <p className="h-journal-text">{e.note_text}</p>
            </article>
          ))
        )}
        <Link href="/letters" className="h-foot-link">Letters are in their own door</Link>
      </section>

      <section className="h-section">
        <h2 className="h-section-title">My record</h2>
        {human === null ? (
          <p className="h-home-quiet">{HALSETH_DOWN}</p>
        ) : human.length === 0 ? (
          <p className="h-home-quiet">No personal entries yet.</p>
        ) : (
          human.map((e) => (
            <article key={e.id} className="h-journal-entry">
              <header className="h-journal-head">
                {e.emotion_tag && (
                  <span className="h-meta">
                    {e.emotion_tag}{e.sub_emotion ? ` · ${e.sub_emotion}` : ""}
                  </span>
                )}
                <span className="h-meta"><ClientTime iso={e.created_at} /></span>
              </header>
              <p className="h-journal-text">{e.entry_text}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
