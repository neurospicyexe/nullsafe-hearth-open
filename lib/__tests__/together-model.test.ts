import { describe, it, expect } from "vitest";
import type { Book, ClubCurrent, ClubRecommendation, CreatureDetail, ToolCall } from "@/lib/halseth";
import { clubHint, galleryHint, readingHint, solHint, togetherDoors } from "@/lib/together-model";
import { HUBS } from "@/lib/shell";

const now = new Date("2026-10-31T12:00:00Z");
const rec = (id: string, by: string, title = id): ClubRecommendation => ({
  id,
  round_id: "r",
  media_kind: "book",
  title,
  creator: null,
  url: null,
  source_ref: null,
  recommended_by: by,
  pitch: null,
  created_at: "",
});
const club = (status: string, over: Partial<ClubCurrent> = {}, win: string | null = null): ClubCurrent => ({
  round: { id: "r", status, winning_recommendation_id: win, opened_at: "", activated_at: null, discussing_at: null, closed_at: null } as never,
  recommendations: [rec("a", "drevan", "Dune")],
  votes: [],
  discussions: [],
  abstentions: [],
  ...over,
});
const vote = { round_id: "r", voter: "principal", recommendation_id: "a", created_at: "" } as never;

describe("clubHint", () => {
  it("gathering", () => {
    expect(clubHint(club("gathering"))).toBe("Gathering picks. You haven't voted yet.");
    expect(clubHint(club("gathering", { votes: [vote] }))).toBe("Gathering picks. You voted.");
  });
  it("voting", () => {
    expect(clubHint(club("voting"))).toBe("Voting is open. You haven't voted yet.");
    expect(clubHint(club("voting", { votes: [vote] }))).toBe("Voting is open. You voted.");
  });
  it("drops the vote sentence when nothing is votable by Principal", () => {
    expect(clubHint(club("gathering", { recommendations: [rec("a", "principal")] }))).toBe("Gathering picks.");
    expect(clubHint(club("voting", { recommendations: [] }))).toBe("Voting is open.");
  });
  it("active and discussing", () => {
    expect(clubHint(club("active", {}, "a"))).toBe("Now: Dune");
    expect(clubHint(club("discussing", {}, "a"))).toBe("Talking about Dune");
    expect(clubHint(club("active", {}, "zzz"))).toBeNull();
  });
  it("closed, no round, null", () => {
    expect(clubHint(club("closed"))).toBeNull();
    expect(clubHint({ ...club("closed"), round: null })).toBeNull();
    expect(clubHint(null)).toBeNull();
  });
});

const detail = (interactions: CreatureDetail["interactions"]) => ({ creature: {} as never, interactions }) as CreatureDetail;
const ix = (actor: string, action: string, note: string | null) => ({ id: "i", actor, action, note, created_at: "2026-10-31 10:00:00" });

describe("solHint", () => {
  it("uses the newest sol appear with a note", () => {
    expect(
      solHint(detail([ix("principal", "appear", "no"), ix("sol", "tend", "no"), ix("sol", "appear", "  in the\nwindow "), ix("sol", "appear", "old")]), now),
    ).toBe("2h: in the window");
  });
  it("truncates at 80", () => {
    expect(solHint(detail([ix("sol", "appear", "x".repeat(200))]), now)).toBe(`2h: ${"x".repeat(80)}…`);
    expect(solHint(detail([ix("sol", "appear", "y".repeat(80))]), now)).toBe(`2h: ${"y".repeat(80)}`);
  });
  it("drops the age prefix when the date does not parse", () => {
    const bad = { ...ix("sol", "appear", "hello"), created_at: "garbage" };
    expect(solHint(detail([bad]), now)).toBe("hello");
  });
  it("null when none", () => {
    expect(solHint(detail([]), now)).toBeNull();
    expect(solHint(detail([ix("sol", "appear", "  ")]), now)).toBeNull();
    expect(solHint(null, now)).toBeNull();
  });
});

describe("readingHint", () => {
  it("formats title and rounded percent", () => {
    expect(readingHint({ title: "Dune", progress_percent: 41.6 } as Book)).toBe("Dune · 42%");
    expect(readingHint(null)).toBeNull();
  });
});

describe("galleryHint", () => {
  const img = (s: string) => ({ args_summary: s, created_at: "2026-10-31 11:00:00" }) as ToolCall;
  it("age and prompt", () => {
    expect(galleryHint(img("prompt: a fox"), now)).toBe("1h: a fox");
    expect(galleryHint(null, now)).toBeNull();
  });
  it("drops the age prefix when the date does not parse", () => {
    expect(galleryHint({ args_summary: "prompt: a fox", created_at: "garbage" } as ToolCall, now)).toBe("a fox");
  });
  it("null when the prompt is empty", () => {
    expect(galleryHint(img("prompt:   "), now)).toBeNull();
    expect(galleryHint(img(""), now)).toBeNull();
  });
  it("truncates a 2000 character prompt at 60", () => {
    expect(galleryHint(img("prompt: " + "z".repeat(2000)), now)).toBe(`1h: ${"z".repeat(60)}…`);
  });
});

describe("togetherDoors", () => {
  it("attaches hints, leaves the rest identical, keeps order, never mutates", () => {
    const before = JSON.stringify(HUBS.shared);
    const out = togetherDoors(HUBS.shared, { "/club": "Voting is open.", "/library": null });
    expect(out.map((d) => d.href)).toEqual(HUBS.shared.map((d) => d.href));
    expect(out.find((d) => d.href === "/club")!.hint).toBe("Voting is open.");
    for (const d of out.filter((d) => d.href !== "/club")) {
      expect(JSON.stringify(d)).toBe(JSON.stringify(HUBS.shared.find((x) => x.href === d.href)));
    }
    expect(JSON.stringify(HUBS.shared)).toBe(before);
  });
});
