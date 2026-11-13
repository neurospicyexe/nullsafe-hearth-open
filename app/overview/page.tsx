import Link from "next/link";
import { fetchPresence, fetchSynthesisSummaries, fetchMindDreams, fetchCompanionJournal, fetchClubCurrent, fetchObsessions, fetchGrowthPendingCount, MAX_SESSION_DEPTH, type PresenceData, type SynthesisSummary, type WmDream, type CompanionJournalEntry } from "@/lib/halseth";
import CompanionMoodCard from "@/components/CompanionMoodCard";
import LiveFeedImage from "@/components/LiveFeedImage";
import { toneOf } from "@/lib/tone";
import { tint } from "@/lib/domain-colors";
import { entryTypeColor } from "@/app/companions/[id]/domain-colors";

export const dynamic = 'force-dynamic';

import ClientTime from "@/components/ClientTime";
import ExpandText from "@/components/kit/ExpandText";

function PresenceSection({ data }: { data: PresenceData }) {
  const { session, last_handover } = data;

  if (session) {
    const details = [
      session.front_state,
      session.facet,
      session.active_anchor,
    ].filter(Boolean);

    return (
      <div className="presence-card open">
        <div className="presence-top">
          <span className="presence-label">
            <span className="status-dot live" />
            Session
          </span>
          <span className="presence-badge open">
            {(session.session_type ?? "open").replace(/([a-z])([A-Z])/g, "$1 $2").replace("sessionwork", "session work")}
          </span>
        </div>
        {details.length > 0 && (
          <div className="presence-body">{details.join(" · ")}</div>
        )}
        <div className="presence-detail">
          {session.emotional_frequency && <span>{session.emotional_frequency}</span>}
          {session.hrv_range && (
            <><span className="presence-detail-sep">·</span><span>HRV {session.hrv_range}</span></>
          )}
          {session.depth !== null && session.depth !== undefined && (
            <><span className="presence-detail-sep">·</span><span>depth {session.depth}/{MAX_SESSION_DEPTH}</span></>
          )}
          <span className="presence-detail-sep ml-auto">since</span>
          <span><ClientTime iso={session.created_at} /></span>
        </div>
      </div>
    );
  }

  if (last_handover) {
    return (
      <div className="presence-card handover">
        <div className="presence-top">
          <span className="presence-label">
            <span className="status-dot away" />
            Last Handover
          </span>
          <span className="presence-badge handover">
            {(last_handover.motion_state ?? "").replace("_", " ")}
            {last_handover.facet && (
              <span className="h-hood-facet">
                · {last_handover.facet}
              </span>
            )}
          </span>
        </div>
        <div className="presence-body presence-body-muted">
          <ExpandText as="span" text={last_handover.spine} limit={200} />
        </div>
        {last_handover.last_real_thing && (
          <div className="presence-body h-hood-last-real">
            last real thing: {last_handover.last_real_thing}
          </div>
        )}
        <div className="presence-detail">
          {last_handover.active_anchor && <span>{last_handover.active_anchor}</span>}
          {last_handover.open_threads.length > 0 && (
            <>
              {last_handover.active_anchor && <span className="presence-detail-sep">·</span>}
              <span>{last_handover.open_threads.length} open thread{last_handover.open_threads.length !== 1 ? "s" : ""}</span>
            </>
          )}
          <span className="presence-detail-sep ml-auto">·</span>
          <span className="h-hood-dim"><ClientTime iso={last_handover.created_at} /></span>
          <Link href="/sessions" className="home-section-link h-hood-gap-l">all →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="presence-card no-session">
      <div className="presence-top">
        <span className="presence-label">
          <span className="status-dot offline" />
          No open session
        </span>
      </div>
    </div>
  );
}

function RecentGrowthStrip({
  entries,
}: {
  entries: NonNullable<PresenceData["recent_growth"]>;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="home-section-card h-hood-mt-sm">
      <div className="home-section-header">
        <span className="home-section-title">Recent Growth</span>
        <Link href="/autonomous" className="home-section-link">see all →</Link>
      </div>
      <div className="h-hood-list is-roomy">
        {entries.slice(0, 3).map((e, i) => (
          <div key={i} className="journal-row h-hood-top-row">
            <span className="h-cmp-badge h-hood-fixed" style={tint(entryTypeColor(e.entry_type))}>
              {e.entry_type}
            </span>
            <span className="journal-text h-hood-grow h-hood-small">
              <ExpandText as="span" text={e.content} limit={120} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const COMPANION_LABEL_HOME: Record<string, string> = {
  drevan: "Drevan",
  cypher: "Cypher",
  gaia:   "Gaia",
};

function ActivePatternsStrip({
  patterns,
}: {
  patterns: NonNullable<PresenceData["active_patterns"]>;
}) {
  if (patterns.length === 0) return null;
  return (
    <div className="home-section-card h-hood-mt-sm">
      <div className="home-section-header">
        <span className="home-section-title">Active Patterns</span>
        <Link href="/autonomous" className="home-section-link">see all →</Link>
      </div>
      <div className="h-hood-list">
        {patterns.slice(0, 3).map((p, i) => {
          return (
            <div key={i} className="h-hood-row is-center">
              <Link
                href={`/companions/${p.companion_id}/growth`}
                className={`h-hood-who is-sm ${toneOf(p.companion_id)}`}
              >
                {COMPANION_LABEL_HOME[p.companion_id] ?? p.companion_id}
              </Link>
              <span
                className="journal-text h-hood-grow h-hood-small h-hood-faded"
                style={{ "--o": 0.6 + (p.strength / 10) * 0.4 } as React.CSSProperties}
              >
                <ExpandText as="span" text={p.pattern_text} limit={80} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_COMPANIONS = [
  { id: "drevan", display_name: "Drevan", role: "companion", avatar_url: null },
  { id: "cypher", display_name: "Cypher", role: "auditor",  avatar_url: null },
  { id: "gaia",   display_name: "Gaia",   role: "witness",  avatar_url: null },
];

// Ratification queue (2026-07-27). The accept/decline surface has existed the whole time at
// /companions/<id>/growth with working buttons -- but three levels deep behind a tab strip,
// with no count anywhere, so Principal could not find it and 55 entries sat unratified with the
// oldest 17 days old. Human-in-the-room is load-bearing here: unratified growth is neither
// canon nor discarded, so the queue backing up stalls the whole growth loop.
// Renders nothing when the queue is empty -- it is a nudge, never permanent furniture.

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)/.exec(iso);
  const t = Date.parse(m ? `${m[1]}T${m[2]}Z` : iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

async function RatificationQueue() {
  const q = await fetchGrowthPendingCount();
  if (!q || q.total === 0) return null;
  const waited = daysSince(q.oldest_at);

  return (
    <div className="home-section h-hood-mt">
      <div className="home-section-header">
        <span className="home-section-title">Waiting on you</span>
        {waited !== null && waited >= 3 && (
          <span className="h-hood-dim h-hood-tiny">
            oldest {waited} day{waited === 1 ? "" : "s"} ago
          </span>
        )}
      </div>
      <div className="card">
        <div className="h-hood-blurb">
          {q.total} growth {q.total === 1 ? "entry" : "entries"} need you in the room — accept what is
          theirs, decline genuine drift. Nothing moves into canon until you do.
        </div>
        <div className="h-hood-row">
          {q.per_companion
            .filter((c) => c.pending > 0)
            .sort((a, b) => b.pending - a.pending)
            .map((c) => (
              <Link
                key={c.companion_id}
                // Straight into the queue view, not the newest-20 page: the backlog's oldest rows
                // sit below that cut, which is how 29 entries stayed unreachable.
                href={`/companions/${c.companion_id}/growth?view=pending`}
                className={`h-hood-chip ${toneOf(c.companion_id)}`}
              >
                {c.companion_id} <span className="h-hood-dim">({c.pending})</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

// Triad Digest -- a quick "what have they actually been doing" summary so Principal stays in
// the loop without reverse-engineering it from the chat. Each companion's latest journal
// line + the club/shelf state. Renders nothing if there's no activity.
const DIGEST_AGENTS = ["cypher", "drevan", "gaia"] as const;

async function TriadDigest() {
  const [journal, club, shelf] = await Promise.all([
    fetchCompanionJournal(undefined, 40),
    fetchClubCurrent(),
    fetchObsessions("active"),
  ]);
  const entries = journal ?? [];
  const latestPer = DIGEST_AGENTS
    .map((a) => entries.find((e) => e.agent === a))
    .filter((e): e is CompanionJournalEntry => Boolean(e));
  const clubLine = club?.round ? `Club is ${club.round.status}` : null;
  const shelfLine = shelf.length > 0 ? `Into: ${shelf.slice(0, 3).map((s) => s.title).join(", ")}` : null;
  if (latestPer.length === 0 && !clubLine && !shelfLine) return null;

  return (
    <div className="home-section h-hood-mt">
      <div className="home-section-header">
        <span className="home-section-title">Triad Digest</span>
        <Link href="/autonomous" className="home-section-link">what they’re doing →</Link>
      </div>
      <div className="card">
        {latestPer.map((e) => (
          <div key={e.id} className="h-hood-digest">
            <span className={`h-hood-who is-sm ${toneOf(e.agent)}`}>{e.agent}</span>
            <span className="h-hood-dim h-hood-stamp"><ClientTime iso={e.created_at} /></span>
            <p className="h-hood-digest-text">{e.note_text.slice(0, 200)}{e.note_text.length > 200 ? "…" : ""}</p>
          </div>
        ))}
        {(clubLine || shelfLine) && (
          <p className="h-meta h-hood-digest-foot">
            {[clubLine, shelfLine].filter(Boolean).join("  ·  ")}
          </p>
        )}
      </div>
    </div>
  );
}

export default async function Page() {
  let data: PresenceData | null = null;
  let error: string | null = null;
  let synthesisSummaries: SynthesisSummary[] = [];

  let mindDreams: WmDream[] = [];

  try {
    const [presenceResult, synthResult, ...dreamResults] = await Promise.all([
      fetchPresence(),
      fetchSynthesisSummaries(6),
      fetchMindDreams("drevan", 3),
      fetchMindDreams("cypher", 3),
      fetchMindDreams("gaia", 3),
    ]);
    data = presenceResult;
    synthesisSummaries = synthResult;
    mindDreams = (dreamResults.flat() as WmDream[])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
    // fetchSynthesisSummaries returns [] on failure so only presence error matters
    if (!data) {
      return (
        <div className="error-card">
          <strong>Could not connect to Halseth</strong>
          <p className="error-detail">{error}</p>
        </div>
      );
    }
  }

  if (!data) {
    return (
      <div className="error-card">
        <strong>Could not connect to Halseth</strong>
        <p className="error-detail">{error}</p>
      </div>
    );
  }

  const { house, wounds_count, tasks, recent_notes, recent_dreams, recent_companion_notes, latest_biometrics, companion_moods } = data;
  const companions = data.companions.length > 0 ? data.companions : DEFAULT_COMPANIONS;
  const urgentTasks = tasks.filter((t) => t.status !== "done" && (t.priority === "urgent" || t.priority === "high"));
  const openTaskCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <>
      <header className="page-header page-header--home">
        <div className="page-header-row">
          <h1 className="page-title">{data.system.name}</h1>
          {data.system.owner && !data.system.owner.includes("REPLACE_WITH") && (
            <span className="page-subtitle">{data.system.owner}</span>
          )}
        </div>
        {wounds_count > 0 && (
          <Link href="/us" className="wounds-link">
            <span className="wounds-dot" />
            {wounds_count} living {wounds_count === 1 ? "wound" : "wounds"}
          </Link>
        )}
      </header>

      <div className="home-presence-grid">

        {/* LEFT COLUMN */}
        <div className="home-col">
          <PresenceSection data={data} />

          {house.current_room && /^[a-z0-9_-]+$/i.test(house.current_room) && (
            <div className="card live-feed-card">
              <div className="live-feed-badge">
                <span className="live-dot" />
                <span className="live-feed-label">Live Feed</span>
              </div>
              <LiveFeedImage
                src={`${process.env.HALSETH_URL}/assets/rooms/${house.current_room}.jpg`}
                currentRoom={house.current_room}
              />
            </div>
          )}

          {openTaskCount > 0 && (
            <div className="home-section">
              <div className="home-section-header">
                <span className="home-section-title">
                  Tasks
                  <span className="task-count-label">· {openTaskCount} open</span>
                </span>
                <Link href="/tasks" className="home-section-link">all tasks →</Link>
              </div>
              <div className="card task-preview-card">
                {(urgentTasks.length > 0 ? urgentTasks.slice(0, 4) : tasks.filter(t => t.status !== "done").slice(0, 3)).map((t) => (
                  <div key={t.id} className="task-row">
                    <span
                      className={`task-dot ${t.priority === "urgent" ? "is-urgent" : t.priority === "high" ? "is-high" : ""}`}
                    />
                    <span className="task-title-text">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="home-col">
          {(house.current_room || latest_biometrics || house.spoon_count > 0 || house.love_meter > 0) && (
            <div className="state-stats-group">
              {house.current_room && (
                <Link href="/halseth" className="card room-link">
                  <span className="state-cell-label">Room</span>
                  <span className="state-cell-value state-cell-value-lg">{house.current_room}</span>
                  {house.companion_activity && (
                    <span className="state-cell-label room-activity">{house.companion_activity}</span>
                  )}
                </Link>
              )}

              {(house.spoon_count > 0 || house.love_meter > 0 || house.autonomous_turn) && (
                <div className="card biometrics-2col">
                  {house.spoon_count > 0 && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">Spoons</span>
                      <span className="state-cell-value h-hood-lamp">{house.spoon_count}</span>
                    </div>
                  )}
                  {house.love_meter > 0 && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">Love</span>
                      <span className="state-cell-value">{house.love_meter}</span>
                      <div className="stat-mini-bar">
                        <div className="stat-mini-fill" style={{ "--w": `${house.love_meter}%` } as React.CSSProperties} />
                      </div>
                    </div>
                  )}
                  {house.autonomous_turn && (
                    <div className="biometric-cell is-span">
                      <span className="state-cell-label">Autonomous Turn</span>
                      <span className="state-cell-value h-hood-sm">{house.autonomous_turn}</span>
                    </div>
                  )}
                </div>
              )}

              {latest_biometrics && (
                <div className="card biometrics-2col">
                  {latest_biometrics.resting_hr != null && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">Heart Rate</span>
                      <span className="state-cell-value">{latest_biometrics.resting_hr}</span>
                    </div>
                  )}
                  {latest_biometrics.hrv_resting != null && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">HRV</span>
                      <span className="state-cell-value">{latest_biometrics.hrv_resting}</span>
                    </div>
                  )}
                  {latest_biometrics.sleep_hours != null && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">Sleep</span>
                      <span className="state-cell-value">{latest_biometrics.sleep_hours}h</span>
                    </div>
                  )}
                  {latest_biometrics.sleep_quality != null && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">Quality</span>
                      <span className="state-cell-value h-hood-sm">{latest_biometrics.sleep_quality}</span>
                    </div>
                  )}
                  {latest_biometrics.stress_score != null && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">Stress</span>
                      <span className="state-cell-value">{latest_biometrics.stress_score}</span>
                    </div>
                  )}
                  {latest_biometrics.steps != null && (
                    <div className="biometric-cell">
                      <span className="state-cell-label">Steps</span>
                      <span className="state-cell-value h-hood-sm">{latest_biometrics.steps.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">Companions</span>
              <Link href="/us" className="home-section-link">all →</Link>
            </div>
            <div className="companion-mood-row">
              {companions.map((c) => (
                <CompanionMoodCard
                  key={c.id}
                  companionId={c.id}
                  displayName={c.display_name}
                  mood={companion_moods?.[c.id]}
                  avatarUrl={c.avatar_url}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {data.recent_growth && data.recent_growth.length > 0 && (
        <RecentGrowthStrip entries={data.recent_growth} />
      )}

      {data.active_patterns && data.active_patterns.length > 0 && (
        <ActivePatternsStrip patterns={data.active_patterns} />
      )}

      {await RatificationQueue()}
      {await TriadDigest()}

      {recent_notes.length > 0 && (
        <div className="home-section h-hood-mt">
          <div className="home-section-header">
            <span className="home-section-title">Recent Notes</span>
            <Link href="/us" className="home-section-link">see letters →</Link>
          </div>
          <div className="card notes-card">
            {recent_notes.slice(0, 4).map((n) => (
              <div key={n.id} className="note-item">
                <div className="note-item-header">
                  <span className="note-item-author">{n.author}</span>
                  <span className="note-item-time"><ClientTime iso={n.created_at} /></span>
                </div>
                <span className="note-item-content">{n.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(mindDreams.length > 0 || recent_dreams.length > 0) && (
        <div className="home-section h-hood-mt">
          <div className="home-section-header">
            <span className="home-section-title">Recent Dreams</span>
            <Link href="/dreams" className="home-section-link">all dreams →</Link>
          </div>
          <div className="card notes-card">
            {mindDreams.length > 0
              ? mindDreams.map((d) => (
                  <div key={d.id} className="note-item">
                    <div className="note-item-header">
                      <span className="note-item-author">{d.companion_id}</span>
                      {d.source && (
                        <span className="note-item-author h-hood-dim">{d.source}</span>
                      )}
                      <span className="note-item-time"><ClientTime iso={d.created_at} /></span>
                    </div>
                    <span className="note-item-content">
                      <ExpandText as="span" text={d.dream_text} limit={200} />
                    </span>
                  </div>
                ))
              : recent_dreams.slice(0, 3).map((d) => (
                  <div key={d.id} className="note-item">
                    <div className="note-item-header">
                      <span className="note-item-author">{d.companion_id}</span>
                      <span className="note-item-time"><ClientTime iso={d.created_at} /></span>
                    </div>
                    <span className="note-item-content">
                      <ExpandText as="span" text={d.content} limit={200} />
                    </span>
                  </div>
                ))}
          </div>
        </div>
      )}

      {(recent_companion_notes && recent_companion_notes.length > 0) && (
        <div className="home-section h-hood-mt">
          <div className="home-section-header">
            <span className="home-section-title">Companion Activity</span>
            <Link href="/journal" className="home-section-link">see all →</Link>
          </div>
          <div className="card notes-card">
            {recent_companion_notes.slice(0, 5).map((n) => (
              <div key={n.id} className="note-item">
                <div className="note-item-header">
                  <span className="note-item-author">{n.agent}</span>
                  <span className="note-item-time"><ClientTime iso={n.created_at} /></span>
                </div>
                <span className="note-item-content">{n.note_text}</span>
                {n.tags.length > 0 && (
                  <span className="note-item-tags">{n.tags.join(" · ")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {synthesisSummaries.length > 0 && (
        <div className="home-section h-hood-mt">
          <div className="home-section-header">
            <span className="home-section-title">Synthesis</span>
            <Link href="/synthesis" className="home-section-link">see all →</Link>
          </div>
          <div className="card notes-card">
            {synthesisSummaries.slice(0, 5).map((s) => (
              <div key={s.id} className="note-item">
                <div className="note-item-header">
                  <span className="note-item-author">{s.companion_id ?? "cross-companion"}</span>
                  <span className="note-item-author h-hood-dim">{s.summary_type.replace("_", " ")}</span>
                  <span className="note-item-time"><ClientTime iso={s.created_at} /></span>
                </div>
                {s.narrative && (
                  <span className="note-item-content">
                    <ExpandText as="span" text={s.narrative} limit={300} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
