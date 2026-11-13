import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  fetchSessionsOrNull: vi.fn(),
  fetchHandovers: vi.fn(),
  fetchMindHandoffsOrNull: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);

import Page, { metadata } from "./page";

const long = "L".repeat(200);
const session = (id: string, extra: object = {}) => ({
  id, created_at: "2026-10-30 10:00:00", updated_at: null, companion_id: "drevan", session_type: "work",
  spine: "spine " + id, last_real_thing: long, motion_state: "at_rest", front_state: "front-sentinel", co_con: null,
  emotional_frequency: "ef-sentinel", active_anchor: null, facet: null, hrv_range: "hrv-sentinel-low", depth: null, notes: null, ...extra,
});
const handover = (sid: string) => ({
  id: "h" + sid, session_id: sid, created_at: "2026-10-30 11:00:00", spine: "hspine", active_anchor: "the truck",
  last_real_thing: long, open_threads: '["thread one"]', motion_state: "at_rest", facet: null, returned: null, session_type: null,
  session_front_state: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchSessionsOrNull.mockResolvedValue([]);
  m.fetchHandovers.mockResolvedValue([]);
  m.fetchMindHandoffsOrNull.mockResolvedValue([]);
});

describe("/sessions", () => {
  it("title matches the door label", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain(">Sessions and handovers</h1>");
    expect(metadata.title).toBe("Sessions and handovers | Hearth");
  });
  it("shows the session facet as a quiet meta word, from the session or an orphan handover", async () => {
    m.fetchSessionsOrNull.mockResolvedValue([session("a", { facet: "FACET-SESS" })]);
    m.fetchHandovers.mockResolvedValue([{ ...handover("gone"), facet: "FACET-ORPHAN" }]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('<span class="h-meta">FACET-SESS</span>');
    expect(html).toContain('<span class="h-meta">FACET-ORPHAN</span>');
  });
  it("sessions null renders the down line and no session blocks", async () => {
    m.fetchSessionsOrNull.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("h-session");
  });
  it("a session with a body renders one details with the full last-real-thing", async () => {
    m.fetchSessionsOrNull.mockResolvedValue([session("a")]);
    m.fetchHandovers.mockResolvedValue([handover("a")]);
    const html = renderToStaticMarkup(await Page());
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html).toContain("Full handover");
    expect(html).toContain(long);
    expect(html).toContain("thread one");
    expect(html).toContain("the truck");
  });
  it("a session without a body renders no details", async () => {
    m.fetchSessionsOrNull.mockResolvedValue([session("a")]);
    const html = renderToStaticMarkup(await Page());
    expect(html).not.toContain("<details");
    expect(html).toContain("spine a");
  });
  it("never renders hrv_range values", async () => {
    m.fetchSessionsOrNull.mockResolvedValue([session("a")]);
    const html = renderToStaticMarkup(await Page());
    for (const s of ["hrv-sentinel-low", "ef-sentinel", "front-sentinel"]) expect(html).not.toContain(s);
  });
  it("handovers null keeps sessions and says so", async () => {
    m.fetchSessionsOrNull.mockResolvedValue([session("a")]);
    m.fetchHandovers.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("spine a");
    expect(html).toContain("Full handovers didn&#x27;t load.");
  });
  it("mind handoffs null shows its own line while sessions render", async () => {
    m.fetchSessionsOrNull.mockResolvedValue([session("a")]);
    m.fetchMindHandoffsOrNull.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("spine a");
    expect(html).toContain("WebMind handoffs");
    expect(html).toContain("Couldn&#x27;t load the WebMind handoffs.");
  });
  it("lists mind handoffs", async () => {
    m.fetchMindHandoffsOrNull.mockResolvedValue([
      { id: "1", agent_id: "cypher", title: "T1", summary: "S1", next_steps: "N1", open_loops: null, state_hint: null, created_at: "2026-10-30 09:00:00" },
    ]);
    const html = renderToStaticMarkup(await Page());
    for (const t of ["cypher", "T1", "S1", "N1"]) expect(html).toContain(t);
  });
  it("renders an orphan handover as its own row with details", async () => {
    m.fetchSessionsOrNull.mockResolvedValue([]);
    m.fetchHandovers.mockResolvedValue([{ ...handover("gone"), spine: "orphan spine" }]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("orphan spine");
    expect(html.match(/<details/g)).toHaveLength(1);
  });
  it("shows state_hint on mind handoffs", async () => {
    m.fetchMindHandoffsOrNull.mockResolvedValue([
      { id: "1", agent_id: "cypher", title: "T1", summary: null, next_steps: null, open_loops: null, state_hint: "HINTLINE", created_at: "2026-10-30 09:00:00" },
    ]);
    expect(renderToStaticMarkup(await Page())).toContain("HINTLINE");
  });
});
