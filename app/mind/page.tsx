import Link from "next/link";
import {
  type MindJournalEntry,
  fetchAllCompanionNotes, fetchHumanJournal, parseNoteTags,
} from "@/lib/halseth";
import { CompanionNotesFeedClient, CompanionNoteFormClient, JournalFormClient } from "./client";

export const dynamic = 'force-dynamic';

// Recent Journals used to read Brain-era /mind/recent (and /mind/health, /mind/patterns),
// none of which Halseth has ever served, so the section was always empty. Principal's journal
// lives in human_journal (GET /journal); the form below writes there via POST /journal.
async function fetchRecentJournals(): Promise<MindJournalEntry[]> {
  const rows = await fetchHumanJournal(6);
  return rows.map((r) => ({
    id: r.id,
    entry: r.entry_text,
    tags: parseNoteTags(r.tags) ?? [],
    created_at: r.created_at,
  }));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Journal Feed ──────────────────────────────────────────────────────────────

function JournalFeed({ journals }: { journals: MindJournalEntry[] }) {
  if (journals.length === 0) return null;
  return (
    <div className="card">
      <div className="home-section-header">
        <span className="card-title">Recent Journals</span>
        {/* Five of however many were fetched, with nowhere to go: the full feed is /journal. */}
        <Link href="/journal" className="home-section-link">see all →</Link>
      </div>
      <div className="delta-feed">
        {journals.slice(0, 5).map((j) => (
          <div key={j.id} className="delta-entry neutral">
            <div className="delta-text">{j.entry}</div>
            <div className="delta-meta">
              <span className="delta-time">{formatTime(j.created_at)}</span>
              {j.tags.map((tag) => (
                <span key={tag} className="companion-note-tag">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MindPage() {
  const [journals, notes] = await Promise.all([fetchRecentJournals(), fetchAllCompanionNotes(20)]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Mind</h1>
        <p className="page-subtitle">companion notes and journals</p>
      </div>
      <CompanionNotesFeedClient initialNotes={notes} />
      <CompanionNoteFormClient />
      <JournalFeed journals={journals} />
      <JournalFormClient />
    </>
  );
}
