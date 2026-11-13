export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchCompanionJournal } from "@/lib/halseth";
import { isLetterRow } from "@/lib/journal-model";
import { COMPANION_CONFIG, JournalSection } from "../sections";

export default async function CompanionJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  // Substantive lane only: the overview's Journal door counts it, so the page lists the same set
  // (Discord speech transcripts and clerk rows stay reachable from search).
  const journalEntries = await fetchCompanionJournal(id, 200, { substantive: true }).catch(() => null);

  // Letters live behind their own door and are not in the pill count; dropped letters stay here.
  const listed = journalEntries ? journalEntries.filter((e) => !isLetterRow(e.tags, e.review_state)) : null;

  return (
    <div>
      <h1 className="h-cmp-title">{config.display} · Identity Journal</h1>
      <JournalSection entries={listed ?? []} />
    </div>
  );
}
