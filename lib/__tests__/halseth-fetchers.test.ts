// Query strings the companion pages depend on: the Journal page asks for the substantive lane, the
// Letters door asks the inbox for one companion. Other callers keep their old URLs.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCompanionJournal, fetchInbox, fetchLettersOut } from "@/lib/halseth";

let urls: string[] = [];
beforeEach(() => {
  urls = [];
  vi.stubEnv("HALSETH_URL", "https://h.example");
  vi.stubGlobal("fetch", vi.fn(async (u: string) => {
    urls.push(u);
    return new Response(JSON.stringify({ items: [], unread_count: 0 }), { status: 200 });
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const query = (u: string) => Object.fromEntries(new URL(u).searchParams);

describe("fetchCompanionJournal", () => {
  it("adds substantive=1 only when asked", async () => {
    await fetchCompanionJournal("cypher", 200, { substantive: true });
    expect(query(urls[0])).toEqual({ limit: "200", review_state: "all", agent: "cypher", substantive: "1" });
  });
  it("default callers are unchanged", async () => {
    await fetchCompanionJournal("cypher", 6);
    await fetchCompanionJournal(undefined, 40);
    expect(query(urls[0])).toEqual({ limit: "6", review_state: "all", agent: "cypher" });
    expect(query(urls[1])).toEqual({ limit: "40", review_state: "all" });
  });
});

describe("fetchInbox", () => {
  it("scopes to one companion when given", async () => {
    await fetchInbox(100, "gaia");
    expect(new URL(urls[0]).pathname).toBe("/principal/inbox");
    expect(query(urls[0])).toEqual({ limit: "100", agent: "gaia" });
  });
  it("Home's call is unchanged", async () => {
    await fetchInbox(3);
    expect(query(urls[0])).toEqual({ limit: "3" });
  });
});

describe("fetchLettersOut", () => {
  it("asks for the letter prefix, or one companion", async () => {
    await fetchLettersOut();
    await fetchLettersOut(50, "gaia");
    expect(urls[0]).toContain("/notes?");
    expect(urls[0]).toContain("note_type=letter%3A*");
    expect(query(urls[0]).limit).toBe("100");
    expect(urls[1]).toContain("note_type=letter%3Agaia");
    expect(query(urls[1]).limit).toBe("50");
  });
  it("filters client-side and returns newest first", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
      { id: "a", author: "principal", content: "x", note_type: "letter:gaia", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", author: "gaia", content: "x", note_type: "letter:gaia", created_at: "2026-01-05T00:00:00Z" },
      { id: "c", author: "principal", content: "x", note_type: "message", created_at: "2026-01-06T00:00:00Z" },
      { id: "d", author: "principal", content: "x", note_type: "letter:cypher", created_at: "2026-01-03T00:00:00Z" },
    ]), { status: 200 })));
    const rows = await fetchLettersOut();
    expect(rows?.map((r) => r.id)).toEqual(["d", "a"]);
  });
  it("returns null on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect(await fetchLettersOut()).toBeNull();
  });
});
