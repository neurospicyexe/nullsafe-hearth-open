import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  fetchCompanionImages: vi.fn(),
  fetchCollectionOrNull: vi.fn(),
  fetchHomePresence: vi.fn(),
  fetchHomeBasin: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);

import Gallery from "../gallery/page";
import Collection from "../collection/page";
import Home from "../home/page";

const img = (id: string, prompt: string) => ({
  id, companion_id: "cypher", tool: "generate_image", args_summary: `prompt: ${prompt}`,
  status: "success", provider: null, result_ref: "r", result_summary: null, created_at: "2026-10-30T12:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchCompanionImages.mockResolvedValue([]);
  m.fetchCollectionOrNull.mockResolvedValue({ forage: [], listens: [] });
  m.fetchHomePresence.mockResolvedValue(null);
  m.fetchHomeBasin.mockResolvedValue(null);
});

describe("/gallery", () => {
  it("renders captions through imagePrompt", async () => {
    m.fetchCompanionImages.mockImplementation(async (id: string) =>
      id === "cypher" ? [img("a", "a lantern"), img("b", "moss")] : []);
    const html = renderToStaticMarkup(await Gallery());
    expect(html).toContain("<q>a lantern</q>");
    expect(html).toContain("<q>moss</q>");
    expect(html).not.toContain("prompt:");
  });
  it("says Nothing made yet when empty", async () => {
    expect(renderToStaticMarkup(await Gallery())).toContain("Nothing made yet.");
  });
  it("says it cannot reach Halseth when every fetch fails", async () => {
    m.fetchCompanionImages.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Gallery());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("Nothing made yet.");
  });
});

describe("/collection", () => {
  it("renders item titles", async () => {
    m.fetchCollectionOrNull.mockResolvedValue({
      forage: [{ id: "f", title: "Mushroom atlas", domain: "x.org", summary: "", source_url: null, consumed_at: null, gathered_at: "", sparkle: 2 }],
      listens: [{ id: "l", title: "Nocturne", artist: "Chopin", sparkle: 0 }],
    });
    const html = renderToStaticMarkup(await Collection());
    expect(html).toContain("Mushroom atlas");
    expect(html).toContain("Nocturne");
    expect(html).toContain("Chopin");
  });
  it("says it cannot reach Halseth, not nothing collected", async () => {
    m.fetchCollectionOrNull.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Collection());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("Nothing collected yet.");
  });
});

describe("/home (The Home)", () => {
  it("null presence says it cannot reach Halseth, with no zeros", async () => {
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toMatch(/0\.000|no reading/);
  });
  it("renders rooms and a basin reading", async () => {
    m.fetchHomePresence.mockResolvedValue({
      rooms: [{ key: "hearth", name: "Hearth", sym: "H", register: "warm", primary_lane: null }],
      presence: [{ companion_id: "drevan", current_room: "hearth", activity: "sitting", micro_mood: null, basin_distance: 0.1, updated_at: "2026-10-30T12:00:00Z" }],
    });
    m.fetchHomeBasin.mockImplementation(async (id: string) =>
      id === "drevan" ? { drift_score: 0.25, drift_type: "growth", worst_basin: "tender", recorded_at: new Date().toISOString() } : null);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("Hearth");
    expect(html).toContain("0.250");
    expect(html).toContain("↑ tender");
  });
  it("passes room.gradient as --room-wash and drops url() values", async () => {
    m.fetchHomePresence.mockResolvedValue({
      rooms: [
        { key: "a", name: "Alpha", sym: "A", register: "r", primary_lane: null, gradient: "linear-gradient(135deg, #123456, #654321)" },
        { key: "b", name: "Beta", sym: "B", register: "r", primary_lane: null, gradient: "url(https://x.test/p.png)" },
      ],
      presence: [],
    });
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("--room-wash:linear-gradient(135deg, #123456, #654321)");
    expect(html).not.toContain("url(");
    expect(html).toContain("Beta");
  });
  it("marks pressure with a leading !", async () => {
    m.fetchHomePresence.mockResolvedValue({
      rooms: [{ key: "a", name: "Alpha", sym: "A", register: "r", primary_lane: null }],
      presence: [{ companion_id: "gaia", current_room: "a", activity: "x", micro_mood: null, basin_distance: 0, updated_at: "" }],
    });
    m.fetchHomeBasin.mockImplementation(async (id: string) =>
      id === "gaia" ? { drift_score: 0.9, drift_type: "pressure", worst_basin: null, recorded_at: new Date().toISOString() } : null);
    expect(renderToStaticMarkup(await Home())).toContain("! pressure");
  });
});
