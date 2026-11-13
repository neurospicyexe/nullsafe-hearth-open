export const dynamic = "force-dynamic";

import { fetchSessionsOrNull, fetchHandovers, fetchMindHandoffsOrNull } from "@/lib/halseth";
import { joinSessions } from "@/lib/sessions-model";
import { HALSETH_DOWN } from "@/lib/archive-copy";
import { toneOf } from "@/lib/tone";
import ClientTime from "@/components/ClientTime";
import ExpandText from "@/components/kit/ExpandText";

export const metadata = { title: "Sessions and handovers | Hearth" };

const MOTION_WORD: Record<string, string> = { in_motion: "in motion", at_rest: "at rest", floating: "floating" };

export default async function SessionsPage() {
  const [sessions, handovers, mind] = await Promise.all([
    fetchSessionsOrNull(365, 200),
    fetchHandovers(100),
    fetchMindHandoffsOrNull(30),
  ]);

  const rows = sessions ? joinSessions(sessions, handovers ?? []) : null;

  return (
    <div className="h-reading">
      <h1 className="h-page-title">Sessions and handovers</h1>
      {rows === null ? (
        <p className="h-home-quiet">{HALSETH_DOWN}</p>
      ) : (
        <>
          {handovers === null && <p className="h-home-quiet">Full handovers didn&apos;t load.</p>}
          {rows.length === 0 ? (
            <p className="h-home-quiet">No closed sessions yet.</p>
          ) : (
            <div className="h-sessions">
              {rows.map((s) => {
                const motion = s.motion ? (MOTION_WORD[s.motion] ?? s.motion) : null;
                return (
                  <article key={s.id} className="h-session">
                    <header className="h-session-head">
                      <b className={toneOf(s.companion)}>{s.companion ?? "unattributed"}</b>
                      {s.sessionType && <span className="h-meta">{s.sessionType}</span>}
                      {s.facet && <span className="h-meta">{s.facet}</span>}
                      {motion && <span className="h-meta">{motion}</span>}
                      <span className="h-meta h-session-when">
                        <ClientTime iso={s.at} />
                      </span>
                    </header>
                    {s.spine && <p className="h-session-spine">{s.spine}</p>}
                    {s.lastRealThing && <p className="h-session-last"><ExpandText as="span" text={s.lastRealThing} limit={160} /></p>}
                    {s.body && (
                      <details className="h-session-full">
                        <summary>Full handover</summary>
                        <div className="h-reading">
                          <p className="h-session-spine">{s.body.spine}</p>
                          {s.body.lastRealThing && <p className="h-session-last-full">{s.body.lastRealThing}</p>}
                          {s.body.threads.length > 0 && (
                            <div className="h-chips">
                              {s.body.threads.map((t, i) => (
                                <span key={i} className="h-chip">{t}</span>
                              ))}
                            </div>
                          )}
                          {s.body.anchor && <p className="h-meta">anchor: {s.body.anchor}</p>}
                        </div>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <section className="h-section">
        <h2 className="h-section-title">WebMind handoffs</h2>
        {mind === null ? (
          <p className="h-home-quiet">Couldn&apos;t load the WebMind handoffs.</p>
        ) : mind.length === 0 ? (
          <p className="h-home-quiet">No WebMind handoffs yet.</p>
        ) : (
          <div className="h-sessions">
            {mind.map((h) => (
              <article key={h.id} className="h-session">
                <header className="h-session-head">
                  <b className={toneOf(h.agent_id)}>{h.agent_id}</b>
                  <span className="h-meta h-session-when">
                    <ClientTime iso={h.created_at} />
                  </span>
                </header>
                {h.title && <p className="h-session-spine">{h.title}</p>}
                {h.summary && <p className="h-session-last-full">{h.summary}</p>}
                {h.next_steps && <p className="h-meta">next: {h.next_steps}</p>}
                {h.state_hint && <p className="h-meta">{h.state_hint}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
