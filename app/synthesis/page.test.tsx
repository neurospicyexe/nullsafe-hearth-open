import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  fetchSynthesisSummaries: vi.fn(),
  fetchSynthesisSummariesOrNull: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);

import Page from "./page";

const sum = (id: string, extra: object = {}) => ({
  id, companion_id: "drevan", summary_type: "daily_digest", subject: "subj " + id,
  narrative: "narr " + id, emotional_register: "warm", open_threads: '["t1"]',
  created_at: "2026-10-30 10:00:00", ...extra,
});
const run = async (companion?: string) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ companion }) }));

beforeEach(() => vi.clearAllMocks());

describe("/synthesis", () => {
  it("a prototype key is not a companion filter", async () => {
    m.fetchSynthesisSummariesOrNull.mockResolvedValue([sum("a")]);
    const html = await run("constructor");
    expect(html).toContain("subj a");
    expect(html).not.toContain("No synthesis for constructor");
  });
  it("null renders the down line, not an empty list", async () => {
    m.fetchSynthesisSummariesOrNull.mockResolvedValue(null);
    const html = await run();
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No synthesis summaries yet");
  });
  it("renders both summaries with all fields, no hex, no inline style", async () => {
    m.fetchSynthesisSummariesOrNull.mockResolvedValue([sum("a"), sum("b", { companion_id: null })]);
    const html = await run();
    expect(m.fetchSynthesisSummariesOrNull).toHaveBeenCalledWith(200);
    expect(html).toContain("subj a");
    expect(html).toContain("subj b");
    expect(html).toContain("narr a");
    expect(html).toContain("warm");
    expect(html).toContain("t1");
    expect(html).toContain("daily digest");
    expect(html).toContain("cross-companion");
    expect(html).toContain("(most recent 200 fetched");
    expect(html).toContain('href="/synthesis?companion=cross"');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toContain("style=");
  });
  it("filters by companion", async () => {
    m.fetchSynthesisSummariesOrNull.mockResolvedValue([sum("a"), sum("b", { companion_id: "gaia" })]);
    const html = await run("gaia");
    expect(html).toContain("subj b");
    expect(html).not.toContain("subj a");
  });
});
