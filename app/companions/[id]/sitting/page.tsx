export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchSittingNotes } from "@/lib/halseth";
import { COMPANION_CONFIG } from "../sections";
import { MetabolizeButton } from "./MetabolizeButton";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  message: "message",
  "letter:drevan": "letter",
  "letter:cypher": "letter",
  "letter:gaia": "letter",
};

export default async function CompanionSittingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const notes = await fetchSittingNotes(id).catch(() => []);

  return (
    <div data-companion={id}>
      <div className="page-header">
        <h1 className="page-title">{config.display} · Sitting Notes</h1>
        <p className="page-subtitle">
          notes in active processing · oldest first · metabolize when integrated
        </p>
      </div>

      {notes.length === 0 && (
        <div className="pending-notice">
          <div className="pending-dot" />
          Nothing currently sitting.
        </div>
      )}

      {notes.length > 0 && (
        <div className="card h-cmp-card">
          {notes.map((note) => (
            <div key={note.note_id} className="journal-row h-cmp-col h-cmp-gap">
              <div className="h-cmp-split h-cmp-sit">
                <div className="h-cmp-wrap">
                  <span className="note-type-badge h-cmp-tint h-cmp-edge">
                    {NOTE_TYPE_LABEL[note.note_type] ?? note.note_type}
                  </span>
                  <span className="journal-time">sitting since {fmtTime(note.sat_at)}</span>
                </div>
                <MetabolizeButton noteId={note.note_id} companionId={id} />
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
      )}
    </div>
  );
}
