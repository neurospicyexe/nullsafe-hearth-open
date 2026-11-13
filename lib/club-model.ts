// Pure helpers for the Club page and its write controls. No React, no fetch.
import type { ClubCurrent, ClubRound, ClubVote } from "@/lib/halseth";
import type { QueuedWrite } from "@/lib/write-queue";

/** A round takes (and gives back) votes only while gathering or voting. */
export function votable(round: Pick<ClubRound, "status"> | null): boolean {
  return round?.status === "gathering" || round?.status === "voting";
}

/** Principal's vote in this round, or null. */
export function principalVote(c: Pick<ClubCurrent, "votes">): ClubVote | null {
  return c.votes.find((v) => v.voter === "principal") ?? null;
}

/**
 * Principal's vote as a queued write. One key per round, so a newer pick (or a removal) supersedes an
 * older one still sitting in its grace window. `null` withdraws the vote.
 */
export function voteWrite(roundId: string, recommendationId: string | null): QueuedWrite {
  const key = `club-vote-${roundId}`;
  if (recommendationId === null) return { key, url: "/api/club/vote", method: "DELETE", body: {} };
  return { key, url: "/api/club/vote", method: "POST", body: { recommendation_id: recommendationId } };
}

export type ClubPick = {
  title: string;
  media_kind: string;
  creator: string | null;
  url: string | null;
  pitch: string | null;
};

/** Principal's recommendation as a queued write, one key per round. */
export function recommendWrite(roundId: string, pick: ClubPick): QueuedWrite {
  return { key: `club-recommend-${roundId}`, url: "/api/club/recommend", method: "POST", body: pick };
}
