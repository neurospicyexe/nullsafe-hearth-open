export const dynamic = 'force-dynamic';

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchLettersOut, fetchInbox } from "@/lib/halseth";
import type { Note, InboxItem } from "@/lib/halseth";
import { COMPANION_CONFIG, fmtTime } from "../sections";
import { LetterFormClient } from "../client";
import { parseCompanionId } from "@/lib/companion-page";
import { HALSETH_DOWN } from "@/lib/archive-copy";
import { ms } from "@/lib/time-order";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

type LetterItem =
  | { kind: "incoming"; note: InboxItem;     at: string }
  | { kind: "outgoing"; note: Note;          at: string };

export default async function CompanionLettersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  // Lowercase + validate once, before any Halseth call; every fetch below gets the parsed id.
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  // Incoming letters are the inbox's own set (tags exactly `letter` or `letter_to_principal`, dropped
  // excluded), scoped to this companion in Halseth, so Discord speech in the journal can never push
  // them out of a window. Each links to /letters/[id], which marks it read (the door's unread count).
  const [notes, inboxRes] = await Promise.allSettled([
    fetchLettersOut(100, id),
    fetchInbox(100, id),
  ]);

  // A rejected or null source is an outage, never "no letters": track each so the page can say which.
  const outRows = notes.status === "fulfilled" ? notes.value : null;
  const inbox   = inboxRes.status === "fulfilled" ? inboxRes.value : null;
  const lettersOut = outRows ?? [];

  // Belt and braces: a Halseth that predates ?agent= ignores it and returns every writer's letters.
  const lettersIn  = (inbox?.items ?? []).filter((n) => n.agent === id);

  const letters: LetterItem[] = [
    ...lettersIn.map((n): LetterItem  => ({ kind: "incoming", note: n, at: n.created_at })),
    ...lettersOut.map((n): LetterItem => ({ kind: "outgoing", note: n, at: n.created_at })),
  ].sort((a, b) => ms(a.at) - ms(b.at));

  return (
    <div data-companion={id}>
      <div className="page-header h-cmp-page-head">
        <h1 className="page-title h-cmp-page-title">Letters</h1>
        <p className="page-subtitle">
          full thread · {letters.length} {letters.length === 1 ? "letter" : "letters"}
        </p>
      </div>

      <div className="h-cmp-stack">
        <LetterFormClient companionId={id} companionName={config.display} />

        {inbox === null && outRows === null && <p className="h-empty">{HALSETH_DOWN}</p>}
        {inbox === null && outRows !== null && <p className="h-empty">Couldn&apos;t load the letters left for you.</p>}
        {inbox !== null && outRows === null && <p className="h-empty">Couldn&apos;t load the letters you left for them.</p>}

        {letters.length === 0 ? (
          inbox === null || outRows === null ? null : (
            <p className="h-empty">
              No letters yet. Write something. {config.display} will find it next session.
            </p>
          )
        ) : (
          <div className="letter-thread">
            {letters.map((item) => {
              if (item.kind === "incoming") {
                return (
                  <Link
                    key={item.note.id}
                    href={`/letters/${item.note.id}`}
                    className={`letter-bubble incoming${item.note.read ? "" : " is-unread"}`}
                  >
                    <div className="letter-body">{item.note.preview}</div>
                    <div className="letter-meta">
                      <span className="h-cmp-who">{config.display}</span>
                      <span>·</span>
                      <span>{fmtTime(item.note.created_at)}</span>
                      <span>·</span>
                      {item.note.read ? (
                        <span>read</span>
                      ) : (
                        <span className="letter-new h-cmp-tint">new</span>
                      )}
                    </div>
                  </Link>
                );
              }
              return (
                <div key={item.note.id} className="letter-bubble outgoing">
                  <div className="letter-body">{item.note.content}</div>
                  <div className="letter-meta">
                    <span className="h-cmp-who is-principal">Principal</span>
                    <span>·</span>
                    <span>{fmtTime(item.note.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
