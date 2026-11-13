import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({ fetchInbox: vi.fn(), fetchLettersOut: vi.fn() }));
vi.mock("@/lib/halseth", () => m);

import Page from "./page";

const item = (id: string, agent: string, read: boolean) => ({
  id, kind: "letter", agent, created_at: "2026-10-30 10:00:00", preview: `prev-${id}`, text: "x", read,
});
const note = (id: string, type: string) => ({
  id, created_at: "2026-10-31 10:00:00", author: "principal", content: `line one\nline two ${id}`, note_type: type,
});
const render = async (sp: { with?: string } = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchInbox.mockResolvedValue({ items: [], unread_count: 0 });
  m.fetchLettersOut.mockResolvedValue([]);
});

describe("/letters", () => {
  it("shows title, chips and the down line when both sources fail", async () => {
    m.fetchInbox.mockResolvedValue(null);
    m.fetchLettersOut.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain("Letters");
    expect(html).toContain("h-chip");
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No letters yet");
  });
  it("says so when both load empty", async () => {
    expect(await render()).toContain("No letters yet.");
  });
  it("notes the missing side when one source fails", async () => {
    m.fetchLettersOut.mockResolvedValue(null);
    m.fetchInbox.mockResolvedValue({ items: [item("a", "drevan", false)], unread_count: 1 });
    const html = await render();
    expect(html).toContain("prev-a");
    expect(html).toContain("Couldn&#x27;t load the letters you left for them.");
    m.fetchLettersOut.mockResolvedValue([note("b", "letter:gaia")]);
    m.fetchInbox.mockResolvedValue(null);
    const html2 = await render();
    expect(html2).toContain("to Gaia");
    expect(html2).toContain("Couldn&#x27;t load the letters left for you.");
  });
  it("renders both directions and read state", async () => {
    m.fetchInbox.mockResolvedValue({ items: [item("a", "drevan", false), item("r", "cypher", true)], unread_count: 1 });
    m.fetchLettersOut.mockResolvedValue([note("b", "letter:gaia")]);
    const html = await render();
    expect(html).toContain("from Drevan");
    expect(html).toContain("to Gaia");
    expect(html).toContain("h-letter-out");
    expect(html).toMatch(/class="h-letter-row"[^>]*href="\/letters\/a"|href="\/letters\/a"[^>]*class="h-letter-row"/);
    expect(html).toMatch(/class="h-letter-row is-read"[^>]*href="\/letters\/r"|href="\/letters\/r"[^>]*class="h-letter-row is-read"/);
  });
  it("filters by a known companion", async () => {
    const html = await render({ with: "gaia" });
    expect(m.fetchInbox).toHaveBeenCalledWith(100, "gaia");
    expect(m.fetchLettersOut).toHaveBeenCalledWith(100, "gaia");
    expect(html).toMatch(/href="\/letters\?with=gaia"[^>]*class="h-chip is-on"|class="h-chip is-on"[^>]*href="\/letters\?with=gaia"/);
  });
  it("ignores an unknown companion", async () => {
    await render({ with: "spouse" });
    expect(m.fetchInbox).toHaveBeenCalledWith(100, undefined);
    expect(m.fetchLettersOut).toHaveBeenCalledWith(100, undefined);
  });
});
