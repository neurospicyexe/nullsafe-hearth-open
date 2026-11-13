export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchNotes } from "@/lib/halseth";
import { COMPANION_CONFIG, NotesSection } from "../sections";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

export default async function CompanionNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const allNotes = await fetchNotes(200);
  const filteredNotes = allNotes.filter(
    (n) => n.author === id && n.note_type !== `letter:${id}`,
  );

  return (
    <div>
      <h1 className="h-cmp-title">{config.display} · Notes</h1>
      <NotesSection notes={filteredNotes} companionId={id} />
    </div>
  );
}
