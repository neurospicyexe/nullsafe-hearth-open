import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRecentGrowthJournal, GROWTH_JOURNAL_LIMIT } from "./growth-journal";

const env = { url: "https://halseth.example", secret: "s" };
const DAY = 24 * 60 * 60 * 1000;

function page(journal: unknown[], extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ journal, total: journal.length, limit: 10, offset: 0, has_more: false, ...extra }),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchRecentGrowthJournal", () => {
  it("hits GET /mind/growth/journal/:companion_id (the only path Halseth serves) with a limit", async () => {
    const fetchMock = vi.fn(async () => page([]));
    await fetchRecentGrowthJournal(env, ["drevan", "gaia"], 30, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls[0]).toBe(`https://halseth.example/mind/growth/journal/drevan?limit=${GROWTH_JOURNAL_LIMIT}`);
    expect(urls[1]).toBe(`https://halseth.example/mind/growth/journal/gaia?limit=${GROWTH_JOURNAL_LIMIT}`);
    // The old query-string form was a 404 for its whole life.
    for (const u of urls) {
      expect(u).not.toContain("companion_id=");
      expect(u).not.toContain("since=");
    }
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s");
  });

  it("reads `.journal`, uses `content`, and applies the day cutoff client-side", async () => {
    const now = Date.now();
    const fresh = new Date(now - 2 * DAY).toISOString();
    const stale = new Date(now - 40 * DAY).toISOString();
    const fetchMock = vi.fn(async () => page([
      { id: "a", companion_id: "cypher", content: "fresh insight", created_at: fresh },
      { id: "b", companion_id: "cypher", content: "stale insight", created_at: stale },
      { id: "c", companion_id: "cypher", content: "", created_at: fresh },
    ]));
    const out = await fetchRecentGrowthJournal(env, ["cypher"], 30, fetchMock as unknown as typeof fetch);

    expect(out).toBe("(cypher) fresh insight");
    expect(out).not.toContain("stale");
  });

  it("warns instead of silently continuing when Halseth answers non-2xx", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) } as unknown as Response));
    const out = await fetchRecentGrowthJournal(env, ["drevan"], 30, fetchMock as unknown as typeof fetch);

    expect(out).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("drevan");
    expect(String(warn.mock.calls[0][0])).toContain("503");
  });

  it("tolerates a body without `journal` and a thrown fetch", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n += 1;
      if (n === 1) return page([], {}) ;
      throw new Error("boom");
    });
    const outEmpty = await fetchRecentGrowthJournal(env, ["gaia", "cypher"], 30, fetchMock as unknown as typeof fetch);
    expect(outEmpty).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("cypher");
  });
});
