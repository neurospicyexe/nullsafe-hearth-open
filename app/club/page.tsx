import { fetchClubCurrent, fetchClubRounds, fetchCommonsPosts } from "@/lib/halseth";
import type { ClubRecommendation, ClubRoundDetail, ClubVote, CommonsPost } from "@/lib/halseth";
import { principalVote, votable } from "@/lib/club-model";
import { memberClass } from "@/lib/kit";
import VoteButton from "./VoteButton";
import { ClubVoteProvider } from "./ClubVote";
import RecommendForm from "./RecommendForm";
import PostBox from "../log/PostBox";

export const dynamic = "force-dynamic";

const PHASE_LABEL: Record<string, string> = {
  gathering: "gathering: recommendations landing, votes open",
  voting: "voting: tally in progress",
  active: "active: experiencing the pick",
  discussing: "discussing: the winner's in; come talk about it",
  closed: "closed",
};

// Human-readable phase guides: what's happening and what Principal can do.
const PHASE_GUIDE: Record<string, { what: string; principal: string }> = {
  gathering: {
    what: "Companions recommend picks over ~2 days, and votes are open as picks land. One vote per member; no voting for your own pick.",
    principal: "Add your own pick below, or vote early. You can change or remove your vote until the tally.",
  },
  voting: {
    what: "The tally is in progress; this phase usually passes in a blink. Majority wins; tie goes to earliest rec.",
    principal: "If you haven't voted yet, the buttons still work, but don't blink.",
  },
  active: {
    what: "The pick is chosen. ~4 days to sit with it. Companions discuss in-voice at the daily tick.",
    principal: "Drop a thought below while you're experiencing it.",
  },
  discussing: {
    what: "Discussion phase. Round closes once the companion tick runs.",
    principal: "Share your reflection below.",
  },
  closed: {
    what: "This round is closed.",
    principal: "",
  },
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Member({ name }: { name: string }) {
  return <span className={`h-club-who ${memberClass(name)}`}>{name}</span>;
}

function PhaseGuide({ status }: { status: string }) {
  const g = PHASE_GUIDE[status];
  if (!g) return null;
  return (
    <div className="h-club-guide">
      <p>{g.what}</p>
      {g.principal && <p className="h-club-guide-you">{g.principal}</p>}
    </div>
  );
}

function WinnerBanner({ round }: { round: ClubRoundDetail }) {
  if (round.status !== "active" && round.status !== "discussing" && round.status !== "closed") return null;
  const winner = round.recommendations.find(r => r.id === round.winning_recommendation_id);
  if (winner) {
    return (
      <p className="h-club-winner">
        ★ the pick:{" "}
        {winner.url
          ? <a href={winner.url} target="_blank" rel="noopener noreferrer"><strong>{winner.title}</strong></a>
          : <strong>{winner.title}</strong>}
        {winner.creator ? `, ${winner.creator}` : ""}{" "}
        <span className="h-meta h-club-meta">(<Member name={winner.recommended_by} />&apos;s rec)</span>
      </p>
    );
  }
  if (round.winner_title) {
    return (
      <p className="h-club-winner">
        ★ the pick: <strong>{round.winner_title}</strong>
      </p>
    );
  }
  if (round.winning_recommendation_id) {
    return <p className="h-meta h-club-meta">★ a pick was chosen (recommendation data not loaded)</p>;
  }
  return null;
}

function Candidates({ roundId, recs, votes, winnerId, canVote, status }: {
  roundId: string;
  recs: ClubRecommendation[];
  votes: ClubVote[];
  winnerId: string | null;
  canVote: boolean;
  status: string;
}) {
  if (recs.length === 0) {
    const past = status === "active" || status === "discussing" || status === "closed";
    return (
      <p className="h-club-quiet">
        {past
          ? "No picks were recorded this round. Companions recommend via Discord during gathering."
          : "No recommendations yet."}
      </p>
    );
  }
  const mine = principalVote({ votes })?.recommendation_id ?? null;
  return (
    <ClubVoteProvider serverPick={mine}>
      <ul className="h-club-list">
        {recs.map((rec) => {
          const isWinner = rec.id === winnerId;
          const showVote = canVote && rec.recommended_by !== "principal";
          // Where "Your vote" (or its control) speaks for Principal, a principal tag would say it twice.
          const ownsMine = showVote || mine === rec.id;
          const recVotes = votes.filter(v => v.recommendation_id === rec.id && !(ownsMine && v.voter === "principal"));
          return (
            <li key={rec.id} className={isWinner ? "h-club-rec is-winner" : "h-club-rec"}>
              <p className="h-club-rec-title">
                {isWinner ? "★ " : ""}
                {rec.url
                  ? <a href={rec.url} target="_blank" rel="noopener noreferrer">{rec.title}</a>
                  : rec.title}
                {rec.creator ? `, ${rec.creator}` : ""}
                <span className="h-club-tag">{rec.media_kind}</span>
              </p>
              <p className="h-club-pitch">
                <Member name={rec.recommended_by} />{rec.pitch ? <>: &ldquo;{rec.pitch}&rdquo;</> : null}
              </p>
              {recVotes.length > 0 && (
                <div className="h-club-votes">
                  {recVotes.map((v) => (
                    <span key={v.voter} className="h-club-tag">
                      <Member name={v.voter} />{v.reason ? <>: {v.reason}</> : null}
                    </span>
                  ))}
                </div>
              )}
              {showVote ? (
                <VoteButton roundId={roundId} recommendationId={rec.id} voted={mine === rec.id} />
              ) : mine === rec.id ? (
                <span className="h-club-vote"><span className="h-club-mine">Your vote</span></span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ClubVoteProvider>
  );
}

function DiscussionThread({ discussions, commons, roundId, postable, status, commonsLoaded = true }: {
  discussions: ClubRoundDetail["discussions"];
  commons: CommonsPost[];
  roundId: string;
  postable: boolean;
  status: string;
  /** False when this round is deep enough in history that its commons were not fetched. */
  commonsLoaded?: boolean;
}) {
  const thread = [...commons].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const hasSomething = discussions.length > 0 || thread.length > 0 || postable || !commonsLoaded;
  if (!hasSomething) return null;
  return (
    <div className="h-club-sub">
      <h3 className="h-club-h3">Discussion</h3>
      {(discussions.length > 0 || thread.length > 0) && (
        <ul className="h-club-list">
          {discussions.map((d) => (
            <li key={d.id} className="h-club-post">
              <p className="h-club-post-who"><Member name={d.companion_id} /></p>
              <p className="h-club-post-body">{d.reflection}</p>
            </li>
          ))}
          {thread.map((p) => (
            <li key={p.id} className={p.reply_to ? "h-club-post is-reply" : "h-club-post"}>
              <p className="h-club-post-who"><Member name={p.author} />{p.reply_to ? " replied" : ""}</p>
              <p className="h-club-post-body">{p.body}</p>
            </li>
          ))}
        </ul>
      )}
      {!commonsLoaded && (
        <p className="h-meta h-club-meta">discussion not loaded for rounds this far back</p>
      )}
      {postable && (
        <div className="h-club-post-box">
          <PostBox
            context={`club:${roundId}`}
            compact
            placeholder={status === "discussing" ? "what was it like? join the discussion…" : "drop a thought while it's playing…"}
          />
        </div>
      )}
    </div>
  );
}

function RoundCard({ round, heading, commons = [], commonsLoaded = true }: {
  round: ClubRoundDetail;
  heading?: string;
  commons?: CommonsPost[];
  commonsLoaded?: boolean;
}) {
  const postable = round.status === "active" || round.status === "discussing";
  const canRecommend = round.status === "gathering";

  return (
    <section className="h-club-round">
      {heading && <h2 className="h-club-h2">{heading}</h2>}
      <p className="h-club-phase">
        {PHASE_LABEL[round.status] ?? round.status}
        {" · opened "}{formatTime(round.opened_at)}
        {round.closed_at ? ` · closed ${formatTime(round.closed_at)}` : ""}
      </p>
      <PhaseGuide status={round.status} />
      <WinnerBanner round={round} />
      <Candidates
        roundId={round.id}
        recs={round.recommendations}
        votes={round.votes}
        winnerId={round.winning_recommendation_id}
        canVote={votable(round)}
        status={round.status}
      />
      {(round.abstentions ?? []).length > 0 && (
        <p className="h-meta h-club-meta">
          abstained:{" "}
          {(round.abstentions ?? []).map((a, i) => (
            <span key={a.voter}>
              {i > 0 ? " · " : ""}
              <Member name={a.voter} />
              {a.reason ? <> ({a.reason})</> : null}
            </span>
          ))}
        </p>
      )}
      {canRecommend && (
        <div className="h-club-sub">
          <h3 className="h-club-h3">Add your pick</h3>
          <RecommendForm roundId={round.id} />
        </div>
      )}
      <DiscussionThread
        discussions={round.discussions}
        commons={commons}
        roundId={round.id}
        postable={postable}
        status={round.status}
        commonsLoaded={commonsLoaded}
      />
    </section>
  );
}

export default async function ClubPage() {
  const [current, rounds] = await Promise.all([
    fetchClubCurrent(),
    fetchClubRounds(10),
  ]);

  const currentId = current?.round?.id ?? null;
  const history = rounds.filter(r => r.id !== currentId);

  // Fetch discussion commons in parallel. The cap used to be 3 while `history.map` below rendered
  // EVERY past round, so round 4 and older displayed an empty discussion thread -- indistinguishable
  // from a round nobody talked in. A fetch bound that renders as absence is a lie about the data;
  // either load it or say it is not loaded. 12 covers the real history depth, and anything past it
  // is marked rather than shown as silent.
  const COMMONS_DEPTH = 12;
  const [currentCommons, ...historyCommons] = await Promise.all([
    currentId ? fetchCommonsPosts(`club:${currentId}`, 30) : Promise.resolve([]),
    ...history.slice(0, COMMONS_DEPTH).map(r => fetchCommonsPosts(`club:${r.id}`, 20)),
  ]);

  return (
    <div className="h-club">
      <h1 className="h-page-title">The Club</h1>
      <p className="h-club-lede">recommend · vote · experience · discuss: the triad&apos;s shared shelf</p>

      {current === null ? (
        <p className="h-club-quiet">Can&apos;t reach Halseth right now.</p>
      ) : current.round ? (
        <RoundCard
          round={{
            ...current.round,
            winner_title: null,
            recommendations: current.recommendations,
            votes: current.votes,
            discussions: current.discussions ?? [],
            abstentions: current.abstentions ?? [],
          }}
          heading="Current round"
          commons={currentCommons}
        />
      ) : (
        <p className="h-club-quiet">No round open. The next one opens at the 6 PM tick.</p>
      )}

      {history.length > 0 && (
        <>
          <h2 className="h-club-h2 is-section">Past rounds</h2>
          {history.map((r, idx) => (
            <RoundCard
              key={r.id}
              round={r}
              commons={historyCommons[idx] ?? []}
              commonsLoaded={idx < COMMONS_DEPTH}
            />
          ))}
        </>
      )}
    </div>
  );
}
