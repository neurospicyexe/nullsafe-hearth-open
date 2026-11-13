import { describe, it, expect } from "vitest";
import { votable, principalVote, voteWrite, recommendWrite } from "@/lib/club-model";
import { memberClass } from "@/lib/kit";
import { failureLine } from "@/lib/write-queue";
import type { ClubRound, ClubVote } from "@/lib/halseth";

const round = (status: ClubRound["status"]): ClubRound => ({
  id: "r1", status, winning_recommendation_id: null, opened_at: "2026-10-30T00:00:00Z",
  activated_at: null, discussing_at: null, closed_at: null,
});
const vote = (voter: string, recommendation_id: string): ClubVote => ({
  round_id: "r1", recommendation_id, voter, reason: null, created_at: "2026-10-30T00:00:00Z",
});

describe("votable", () => {
  it("is true while gathering or voting", () => {
    expect(votable(round("gathering"))).toBe(true);
    expect(votable(round("voting"))).toBe(true);
  });
  it("is false once the pick is chosen, and with no round", () => {
    expect(votable(round("active"))).toBe(false);
    expect(votable(round("discussing"))).toBe(false);
    expect(votable(round("closed"))).toBe(false);
    expect(votable(null)).toBe(false);
  });
});

describe("voteWrite", () => {
  it("withdraws with DELETE and an empty body", () => {
    expect(voteWrite("r1", null)).toEqual({ key: "club-vote-r1", url: "/api/club/vote", method: "DELETE", body: {} });
  });
  it("votes with POST on the same key", () => {
    expect(voteWrite("r1", "rec2")).toEqual({
      key: "club-vote-r1", url: "/api/club/vote", method: "POST", body: { recommendation_id: "rec2" },
    });
  });
});

describe("principalVote", () => {
  it("finds Principal's row", () => {
    const mine = vote("principal", "rec2");
    expect(principalVote({ votes: [vote("gaia", "rec1"), mine] })).toBe(mine);
  });
  it("is null when Principal has not voted", () => {
    expect(principalVote({ votes: [vote("gaia", "rec1")] })).toBeNull();
    expect(principalVote({ votes: [] })).toBeNull();
  });
});

describe("recommendWrite", () => {
  it("keys one recommendation per round", () => {
    const pick = { title: "T", media_kind: "book", creator: null, url: null, pitch: null };
    expect(recommendWrite("r1", pick)).toEqual({ key: "club-recommend-r1", url: "/api/club/recommend", method: "POST", body: pick });
  });
});

describe("memberClass", () => {
  it("maps the four members and falls back for anyone else", () => {
    expect(memberClass("drevan")).toBe("is-drevan");
    expect(memberClass("principal")).toBe("is-principal");
    expect(memberClass("someone")).toBe("is-other");
  });
});

describe("failureLine", () => {
  it("says Halseth's own refusal for a dropped 4xx", () => {
    expect(failureLine({ ok: false, status: 400, json: { error: "no voting for your own pick" }, dropped: true })).toBe("no voting for your own pick");
  });
  it("says Didn't save. for network errors, 5xx and a refusal with no words", () => {
    expect(failureLine({ ok: false, status: 0, json: null })).toBe("Didn't save.");
    expect(failureLine({ ok: false, status: 503, json: { error: "upstream" } })).toBe("Didn't save.");
    expect(failureLine({ ok: false, status: 400, json: {}, dropped: true })).toBe("Didn't save.");
  });
});
