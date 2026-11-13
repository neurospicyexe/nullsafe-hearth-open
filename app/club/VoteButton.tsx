"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failureLine, type Pending } from "@/lib/write-queue";
import { voteWrite } from "@/lib/club-model";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";
import { useClubVote, usePickState } from "./ClubVote";

// Principal's vote control on one pick. Rendered only while the round accepts votes (gathering/voting)
// and only on picks Principal did not recommend. Which pick shows as voted lives in the round's
// ClubVoteProvider, so one tap moves the mark across every button at once. Every button in a round
// also writes the same queue key, so a newer tap supersedes an older one still in its grace window.
export default function VoteButton({ roundId, recommendationId, voted }: {
  roundId: string;
  recommendationId: string;
  voted: boolean;
}) {
  const queue = useWriteQueue();
  const router = useRouter();
  const shared = useClubVote();
  // Outside a provider (a lone button) the same rules run on this button's own state.
  const local = usePickState(voted ? recommendationId : null);
  const picks = shared ?? local;

  const [tapped, setTapped] = useState<"voted" | "removed">("voted");
  const [note, setNote] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [inGrace, setInGrace] = useState(false);
  const pendingRef = useRef<Pending | null>(null);
  const tokenRef = useRef(0);

  // `waiting()` is not reactive: watch it during the grace window so undo leaves once the write sends.
  useEffect(() => {
    if (!inGrace) return;
    const t = window.setInterval(() => {
      const p = pendingRef.current;
      if (!p || !p.waiting()) {
        setInGrace(false);
        window.clearInterval(t);
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [inGrace]);

  function tap(next: "voted" | "removed") {
    const value = next === "voted" ? recommendationId : null;
    const token = picks.begin(value);
    const pending = queue.submit(voteWrite(roundId, value));
    pendingRef.current = pending;
    tokenRef.current = token;
    setTapped(next);
    setNote(null);
    setInGrace(true);
    void pending.done.then((r) => {
      if (pendingRef.current !== pending) return; // undone here
      pendingRef.current = null;
      setInGrace(false);
      if (r === "undone") {
        picks.settle(token, false); // superseded: a no-op when a newer tap owns the pick
        return;
      }
      if (r.ok) {
        picks.settle(token, true);
        router.refresh();
        return;
      }
      picks.settle(token, false);
      if (r.dropped && r.status === 409) setClosed(true);
      else setNote(failureLine(r));
    });
  }

  function undo() {
    const p = pendingRef.current;
    if (!p || !p.waiting()) return;
    pendingRef.current = null;
    p.undo();
    setInGrace(false);
    picks.settle(tokenRef.current, false);
  }

  if (closed) {
    return <span className="h-club-vote" role="status"><span className="h-msg is-warn">Voting has closed.</span></span>;
  }

  // Still this button's ask: a tap on another pick takes the confirmation away at once.
  const mineAsked = tapped === "voted" ? picks.pick === recommendationId : picks.pick === null;
  if (inGrace && mineAsked) {
    return (
      <span className="h-club-vote" role="status">
        <span className="h-msg">{tapped === "voted" ? "Voted" : "Vote removed"}</span>
        <button type="button" className="h-btn" onClick={undo}>undo</button>
      </span>
    );
  }

  return (
    <span className="h-club-vote">
      {picks.pick === recommendationId ? (
        <>
          <span className="h-club-mine">Your vote</span>
          <button type="button" className="h-btn" onClick={() => tap("removed")}>Remove vote</button>
        </>
      ) : (
        <button type="button" className="h-btn is-primary" onClick={() => tap("voted")}>Vote for this</button>
      )}
      {note && <span className="h-msg is-warn" role="status">{note}</span>}
    </span>
  );
}
