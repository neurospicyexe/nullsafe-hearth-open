// The Club page's honesty about Halseth, and Principal's vote shown once.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ClubCurrent, ClubRound } from "@/lib/halseth";

let current: ClubCurrent | null = null;
vi.mock("@/lib/halseth", () => ({
  fetchClubCurrent: async () => current,
  fetchClubRounds: async () => [],
  fetchCommonsPosts: async () => [],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/club" }));
vi.mock("@/components/shell/WriteQueueProvider", () => ({ useWriteQueue: () => ({ submit: vi.fn(), flush: vi.fn() }) }));

import ClubPage from "./page";

const round = (status: ClubRound["status"]): ClubRound => ({
  id: "r1", status, winning_recommendation_id: null, opened_at: "2026-10-30T00:00:00Z",
  activated_at: null, discussing_at: null, closed_at: null,
});
const rec = (id: string, by: string) => ({
  id, round_id: "r1", media_kind: "song", title: `T-${id}`, creator: null, url: null, source_ref: null,
  recommended_by: by, pitch: null, created_at: "2026-10-30T00:00:00Z",
});
const vote = (voter: string, recommendation_id: string, reason: string | null = null) => ({
  round_id: "r1", recommendation_id, voter, reason, created_at: "2026-10-30T00:00:00Z",
});

beforeEach(() => {
  current = null;
});

describe("ClubPage", () => {
  it("Halseth down reads Can't reach Halseth right now., not No round open", async () => {
    const html = renderToStaticMarkup(await ClubPage());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No round open");
  });

  it("a successful read with no round says no round is open", async () => {
    current = { round: null, recommendations: [], votes: [], discussions: [], abstentions: [] };
    const html = renderToStaticMarkup(await ClubPage());
    expect(html).toContain("No round open");
    expect(html).not.toContain("Can&#x27;t reach Halseth");
  });

  it("shows Principal's vote as Your vote, without a duplicate principal tag", async () => {
    current = {
      round: round("gathering"),
      recommendations: [rec("a", "gaia"), rec("b", "drevan")],
      votes: [vote("principal", "a"), vote("cypher", "a", "it hums")],
      discussions: [],
      abstentions: [],
    };
    const html = renderToStaticMarkup(await ClubPage());
    expect(html).toContain("Your vote");
    expect(html).toContain("Remove vote");
    expect(html).toContain("it hums");
    expect(html).not.toContain('<span class="h-club-who is-principal">principal</span>');
  });

  it("after voting closes, Your vote is plain text and the principal tag is not repeated", async () => {
    current = {
      round: round("active"),
      recommendations: [rec("a", "gaia")],
      votes: [vote("principal", "a")],
      discussions: [],
      abstentions: [],
    };
    const html = renderToStaticMarkup(await ClubPage());
    expect(html).toContain("Your vote");
    expect(html).not.toContain("Remove vote");
    expect(html).not.toContain("Vote for this");
    expect(html).not.toContain('<span class="h-club-who is-principal">principal</span>');
  });
});
