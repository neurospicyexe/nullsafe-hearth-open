import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  fetchAllCompanionNotes: vi.fn(),
  fetchCompanionJournal: vi.fn(),
  fetchSomaFeelings: vi.fn(),
  fetchTensions: vi.fn(),
  fetchSittingNotes: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);

import Page, { metadata } from "./page";
import MemoryBrowserClient from "./MemoryBrowserClient";

const note = (id: string, agent = "drevan") => ({
  id, agent, note_text: "note " + id, tags: '["a","b"]', created_at: "2026-10-30 10:00:00",
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchCompanionJournal.mockResolvedValue([]);
  m.fetchSomaFeelings.mockResolvedValue([]);
  m.fetchTensions.mockResolvedValue([]);
  m.fetchSittingNotes.mockResolvedValue([]);
});

describe("/memory", () => {
  it("title matches the door label", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain(">Memory and synthesis</h1>");
    expect(metadata.title).toBe("Memory and synthesis | Hearth");
  });
  it("links to /synthesis and reads notes via fetchCompanionJournal", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('href="/synthesis"');
    expect(html).toContain("Synthesis summaries");
    expect(m.fetchCompanionJournal).toHaveBeenCalledWith(undefined, 150);
    expect(m.fetchAllCompanionNotes).not.toHaveBeenCalled();
  });
  it("shows the down line when notes are null, not No entries", async () => {
    m.fetchCompanionJournal.mockResolvedValue(null);
    m.fetchSomaFeelings.mockResolvedValue([
      { id: "f1", companion_id: "gaia", emotion: "calm", sub_emotion: null, intensity: 40, created_at: "2026-10-30 09:00:00" },
    ]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No entries");
    expect(html).toContain("calm");
  });
  it("full outage (notes null, nothing else) skips the browser", async () => {
    m.fetchCompanionJournal.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("0 entries");
    expect(html).not.toContain("No entries");
  });
  it("renders data with no hex string in the markup", async () => {
    m.fetchCompanionJournal.mockResolvedValue([note("a"), note("b", "cypher")]);
    m.fetchTensions.mockResolvedValue([
      { id: "t1", companion_id: "gaia", tension_text: "tense", first_noted_at: "2026-10-29 10:00:00" },
    ]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("note a");
    expect(html).toContain("h-mem-type-tension");
    expect(html).toContain("h-tone-cypher");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toContain("style=");
  });
});

describe("MemoryBrowserClient", () => {
  it("renders real client markup with no hex and no inline color", () => {
    const html = renderToStaticMarkup(
      <MemoryBrowserClient
        entries={[
          { id: "1", type: "companion_note", companion: "drevan", content: "hello", tags: ["x"], created_at: "2026-10-30 10:00:00" },
          { id: "2", type: "sit", companion: "gaia", content: "sat", created_at: "2026-10-30 09:00:00" },
        ]}
      />,
    );
    expect(html).toContain("h-mem-type-companion_note");
    expect(html).toContain("h-mem-type-sit");
    expect(html).toContain("hello");
    expect(html).toContain("2 results");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toContain("style=");
  });
});
