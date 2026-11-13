import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  fetchAllDeltas: vi.fn(),
  fetchCompanionJournal: vi.fn(),
  fetchDreamsOrNull: vi.fn(),
  fetchHandovers: vi.fn(),
  fetchTasksOrNull: vi.fn(),
  fetchWounds: vi.fn(),
  fetchAllCompanionNotes: vi.fn(),
  fetchMindHandoffsOrNull: vi.fn(),
  fetchInterCompanionNotesOrNull: vi.fn(),
  fetchLettersOut: vi.fn(),
}));
vi.mock("@/lib/halseth", async (orig) => ({ ...(await orig<object>()), ...h }));

import { GET } from "./route";

const run = async (type = "all") => {
  const res = await GET(new NextRequest(`http://x/api/search?q=moss&type=${type}`));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset());
  h.fetchAllDeltas.mockResolvedValue([]);
  h.fetchCompanionJournal.mockResolvedValue([{ id: "j1", agent: "gaia", note_text: "moss", tags: null, created_at: "2026-01-01" }]);
  h.fetchDreamsOrNull.mockResolvedValue([]);
  h.fetchHandovers.mockResolvedValue([]);
  h.fetchTasksOrNull.mockResolvedValue([]);
  h.fetchWounds.mockResolvedValue([]);
  h.fetchAllCompanionNotes.mockResolvedValue([]);
  h.fetchMindHandoffsOrNull.mockResolvedValue([]);
  h.fetchInterCompanionNotesOrNull.mockResolvedValue([]);
  h.fetchLettersOut.mockResolvedValue([]);
});

describe("search route", () => {
  it("notes no longer re-read the journal", async () => {
    const { body } = await run();
    expect(h.fetchAllCompanionNotes).not.toHaveBeenCalled();
    expect(body.journal.map((r: { id: string }) => r.id)).toEqual(["j1"]);
    expect(body.notes).toEqual([]);
  });
  it("each match appears once", async () => {
    const { body } = await run();
    const ids = Object.values(body).flat().map((r) => (r as { id: string }).id);
    expect(ids.filter((i) => i === "j1")).toHaveLength(1);
  });
  it("outgoing letters are searched", async () => {
    h.fetchLettersOut.mockResolvedValue([
      { id: "n1", author: "principal", content: "moss on the sill", note_type: "letter:gaia", created_at: "2026-01-02" },
    ]);
    const { body } = await run();
    expect(h.fetchLettersOut).toHaveBeenCalledWith(100);
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0]).toMatchObject({ id: "n1", agent: "gaia", url: "/letters?with=gaia", text: "moss on the sill" });
  });
  it("letter-tagged journal rows link to the letter", async () => {
    h.fetchCompanionJournal.mockResolvedValue([
      { id: "j2", agent: "gaia", note_text: "moss", tags: '["letter"]', created_at: "2026-01-01" },
      { id: "j3", agent: "gaia", note_text: "moss", tags: '["letter_to_principal"]', created_at: "2026-01-01" },
    ]);
    const { body } = await run("journal");
    expect(body.journal[0].url).toBe("/letters/j2");
    expect(body.journal[1].url).toBe("/letters/j3");
  });
  it("wound results carry the name only", async () => {
    h.fetchWounds.mockResolvedValue([{ id: "w1", name: "moss loss", description: "SECRETGRIEF", created_at: "2026-01-01" }]);
    const { body } = await run("wounds");
    expect(body.wounds).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("SECRETGRIEF");
  });
  it("handovers link to /sessions", async () => {
    h.fetchHandovers.mockResolvedValue([{ id: "h1", spine: "moss", last_real_thing: "", created_at: "2026-01-01" }]);
    h.fetchMindHandoffsOrNull.mockResolvedValue([{ id: "m1", title: "moss", summary: "", next_steps: "", created_at: "2026-01-01", agent_id: "cypher" }]);
    const { body } = await run("handovers");
    expect(body.handovers.map((r: { url: string }) => r.url)).toEqual(["/sessions", "/sessions"]);
  });
  it("one null source still answers 200 with what loaded", async () => {
    h.fetchLettersOut.mockResolvedValue(null);
    h.fetchInterCompanionNotesOrNull.mockResolvedValue([
      { id: "x1", from_id: "gaia", content: "moss between us", created_at: "2026-01-01" },
    ]);
    const { status, body } = await run("notes");
    expect(status).toBe(200);
    expect(body.notes.map((r: { id: string }) => r.id)).toEqual(["x1"]);
  });
  it("every requested source null is a 503, not an empty result", async () => {
    h.fetchLettersOut.mockResolvedValue(null);
    h.fetchInterCompanionNotesOrNull.mockResolvedValue(null);
    const { status, body } = await run("notes");
    expect(status).toBe(503);
    expect(body).toEqual({ error: "Can't reach Halseth right now." });
  });
  it("all types down is a 503", async () => {
    for (const f of Object.values(h)) f.mockResolvedValue(null);
    const { status } = await run();
    expect(status).toBe(503);
  });
  it("a dropped letter-tagged row stays a journal row and links to the companion", async () => {
    h.fetchCompanionJournal.mockResolvedValue([
      { id: "j9", agent: "gaia", note_text: "moss", tags: '["letter"]', review_state: "dropped", created_at: "2026-01-01" },
    ]);
    const { body } = await run("journal");
    expect(body.journal[0].url).toBe("/companions/gaia");
  });
  it("handover text joins title and summary without an em dash", async () => {
    h.fetchMindHandoffsOrNull.mockResolvedValue([{ id: "m1", title: "moss", summary: "sum", next_steps: "", created_at: "2026-01-01", agent_id: "cypher" }]);
    const { body } = await run("handovers");
    expect(body.handovers[0].text).toBe("moss: sum");
  });
});
