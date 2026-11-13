export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInterests, fetchThinking } from "@/lib/halseth";
import { ageLabel } from "@/lib/home-model";
import { COMPANION_NAME, parseCompanionId } from "@/lib/companion-page";
import { bandWord, groupInterests, isPrivate, statusLabel, THINKING_FRAMING, thinkingLines } from "@/lib/thinking";
import { ThinkingLineItem } from "@/components/home/ThinkingStrip";

// Interests (following, resting, put down kept visible) and the full thinking stream. Either
// endpoint missing or empty reads as quiet, never an error.
export default async function CompanionThinkingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();

  const [interests, thinking] = await Promise.all([fetchInterests(id), fetchThinking(60, id)]);
  const now = new Date();
  const groups = groupInterests(interests ?? []);
  const lines = thinkingLines(thinking).filter((l) => l.companion === id);

  return (
    <div className="h-companion">
      <h1 className="h-companion-title">What {COMPANION_NAME[id]} is thinking about</h1>

      <section className="h-companion-section" aria-label="Interests">
        {groups.length === 0 ? (
          <p className="h-companion-quiet">No interests yet.</p>
        ) : (
          groups.map((g) => (
            <div key={g.heading} className="h-companion-section">
              <h2 className="h-companion-h2">{g.heading}</h2>
              <ul className="h-think-interests">
                {g.interests.map((i) => {
                  const band = bandWord(i);
                  const age = ageLabel(i.last_event_at ?? i.created_at, now);
                  return (
                    <li key={i.id}>
                      <Link href={`/companions/${id}/thinking/${encodeURIComponent(i.id)}`} className="h-think-interest">
                        <span className="h-think-interest-name">{i.name}</span>
                        <span className="h-think-interest-meta">
                          {statusLabel(i.status)}
                          {band ? `, ${band}` : ""}
                          {age ? `, ${age}` : ""}
                        </span>
                        {i.why && !isPrivate(i.why_private) && <span className="h-think-interest-why">{i.why}</span>}
                        {i.status === "put_down" && i.put_down_why && <span className="h-think-interest-why">Set down: {i.put_down_why}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="h-companion-section" aria-label="Thinking stream">
        <h2 className="h-companion-h2">In {COMPANION_NAME[id]}&apos;s words</h2>
        <p className="h-think-frame">{THINKING_FRAMING}</p>
        {lines.length === 0 ? (
          <p className="h-companion-quiet">Nothing yet.</p>
        ) : (
          <ul className="h-think-list">
            {lines.map((l) => (
              <ThinkingLineItem key={l.id} line={l} now={now} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
