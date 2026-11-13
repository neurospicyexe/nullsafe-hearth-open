"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";

// One round, one vote: which pick shows as Principal's. Every VoteButton in a round reads this, so a
// tap on B takes the mark off A at once, and an undo, a superseded write or a failure puts the
// previous pick back on every button together.
export type PickState = {
  /** The pick that shows as Principal's vote right now (null: no vote). */
  pick: string | null;
  /** A tap asks for `next`; returns a token that only this tap can settle. */
  begin(next: string | null): number;
  /** This tap is over. `landed`: it saved, so keep showing it until fresh page data arrives. Otherwise go back. */
  settle(token: number, landed: boolean): void;
};

type Asked = { value: string | null; token: number; landed: boolean };

export function usePickState(serverPick: string | null): PickState {
  const [asked, setAsked] = useState<Asked | null>(null);
  const [seen, setSeen] = useState(serverPick);
  const tokenRef = useRef(0);

  // Fresh page data is the truth once it arrives; a tap still in flight keeps showing its ask.
  if (seen !== serverPick) {
    setSeen(serverPick);
    if (asked?.landed) setAsked(null);
  }

  return {
    pick: asked ? asked.value : serverPick,
    begin(next) {
      const token = ++tokenRef.current;
      setAsked({ value: next, token, landed: false });
      return token;
    },
    settle(token, landed) {
      setAsked((a) => (a && a.token === token ? (landed ? { ...a, landed: true } : null) : a));
    },
  };
}

const ClubVoteContext = createContext<PickState | null>(null);

export function ClubVoteProvider({ serverPick, children }: { serverPick: string | null; children: ReactNode }) {
  const state = usePickState(serverPick);
  return <ClubVoteContext.Provider value={state}>{children}</ClubVoteContext.Provider>;
}

export function useClubVote(): PickState | null {
  return useContext(ClubVoteContext);
}
