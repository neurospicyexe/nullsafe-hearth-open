import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  fetchDreams: vi.fn(),
  fetchCompanionDreamsOrNull: vi.fn(),
  fetchDreamSeedsOrNull: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);
vi.mock("./SeedForm", () => ({ default: () => <div data-seedform /> }));

import Page from "./page";

const dream = (id: string, extra: object = {}) => ({
  id, companion_id: "drevan", dream_text: "text " + id, source: "autonomous",
  created_at: "2026-10-30 10:00:00", examined_at: null, do_not_auto_examine: 0, ...extra,
});
const seed = (id: string, extra: object = {}) => ({
  id, created_at: "2026-10-30 09:00:00", content: "seed " + id, for_companion: null,
  claimed_at: null, claimed_by: null, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchCompanionDreamsOrNull.mockResolvedValue([]);
  m.fetchDreamSeedsOrNull.mockResolvedValue([]);
});

describe("/dreams", () => {
  it("never calls fetchDreams and renders one block per dream with the count", async () => {
    m.fetchCompanionDreamsOrNull.mockResolvedValue([dream("a"), dream("b", { companion_id: "gaia" }), dream("c")]);
    const html = renderToStaticMarkup(await Page());
    expect(m.fetchDreams).not.toHaveBeenCalled();
    expect(html.match(/class="h-dream"/g)).toHaveLength(3);
    expect(html).toContain('<span class="h-section-count">3</span>');
    expect(html).toContain("h-tone-gaia");
    expect(html).toContain("text a");
    expect(html).not.toContain("Showing the latest 100.");
    expect(html).toContain("data-seedform");
  });
  it("renders per row received, never doubled", async () => {
    m.fetchCompanionDreamsOrNull.mockResolvedValue([dream("a"), dream("a")]);
    const html = renderToStaticMarkup(await Page());
    expect(html.match(/class="h-dream"/g)).toHaveLength(2);
  });
  it("shows source and examined word", async () => {
    m.fetchCompanionDreamsOrNull.mockResolvedValue([dream("a", { examined_at: "2026-10-31 10:00:00", source: "session" })]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("examined");
    expect(html).toContain("session");
  });
  it("says Showing the latest 100. at exactly 100", async () => {
    m.fetchCompanionDreamsOrNull.mockResolvedValue(Array.from({ length: 100 }, (_, i) => dream("d" + i)));
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Showing the latest 100.");
  });
  it("dreams null shows the down line, not the empty line", async () => {
    m.fetchCompanionDreamsOrNull.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No dreams logged yet");
    expect(html).toContain("No seeds yet");
  });
  it("seeds null shows the down line independently", async () => {
    m.fetchCompanionDreamsOrNull.mockResolvedValue([dream("a")]);
    m.fetchDreamSeedsOrNull.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No seeds yet");
    expect(html).toContain("text a");
  });
  it("loaded-empty renders the quiet lines", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("No dreams logged yet");
    expect(html).toContain("No seeds yet");
    expect(html).not.toContain("Can&#x27;t reach");
  });
  it("seeds show target, pending count, claimed status", async () => {
    m.fetchDreamSeedsOrNull.mockResolvedValue([
      seed("1", { for_companion: "cypher" }),
      seed("2", { claimed_at: "2026-10-30 12:00:00", claimed_by: "drevan" }),
    ]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("1 pending");
    expect(html).toContain("cypher");
    expect(html).toContain("any companion");
    expect(html).toContain("claimed by drevan");
    expect(html).toContain("pending");
    expect(html).toContain("is-claimed");
    expect(html).not.toContain("style=");
  });
});
