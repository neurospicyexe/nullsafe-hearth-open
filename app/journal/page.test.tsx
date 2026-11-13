import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  fetchCompanionJournal: vi.fn(),
  fetchHumanJournalOrNull: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);

import Page, { metadata } from "./page";

const DOWN = "Can&#x27;t reach Halseth right now.";
const row = (id: string, text: string, tags: string | null) => ({
  id, created_at: "2026-11-01T00:00:00Z", agent: "drevan", note_text: text, tags, session_id: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchCompanionJournal.mockResolvedValue([]);
  m.fetchHumanJournalOrNull.mockResolvedValue([]);
});

describe("/journal", () => {
  it("title matches the door label", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain(">Journals</h1>");
    expect(metadata.title).toBe("Journals | Hearth");
  });
  it("asks for the substantive lane", async () => {
    renderToStaticMarkup(await Page());
    expect(m.fetchCompanionJournal).toHaveBeenCalledWith(undefined, 200, { substantive: true });
  });
  it("drops letter rows and keeps plain ones", async () => {
    m.fetchCompanionJournal.mockResolvedValue([
      row("1", "a letter body", '["letter"]'),
      row("2", "a plain reflection", '["journal"]'),
    ]);
    const html = renderToStaticMarkup(await Page());
    expect(html).not.toContain("a letter body");
    expect(html).toContain("a plain reflection");
    expect(html).toContain('href="/letters"');
    expect(html).toContain("Letters are in their own door");
  });
  it("keeps a dropped letter-tagged row on the journal with its dropped badge", async () => {
    m.fetchCompanionJournal.mockResolvedValue([
      { ...row("1", "dropped letter body", '["letter"]'), review_state: "dropped" },
    ]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("dropped letter body");
    expect(html).toContain("dropped</span>");
  });
  it("says Halseth is down for each null source, not empty", async () => {
    m.fetchCompanionJournal.mockResolvedValue(null);
    m.fetchHumanJournalOrNull.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page());
    expect(html.split(DOWN).length - 1).toBe(2);
    expect(html).not.toContain("No companion entries yet");
    expect(html).not.toContain("No entries yet");
  });
  it("never renders the mood score but keeps the emotion", async () => {
    m.fetchHumanJournalOrNull.mockResolvedValue([
      { id: "h", created_at: "2026-11-01T00:00:00Z", entry_text: "my day", emotion_tag: "tired", sub_emotion: null, mood_score: 62, tags: null },
    ]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("my day");
    expect(html).toContain("tired");
    expect(html).not.toContain("mood");
    expect(html).not.toContain("62");
  });
  it("shows the review state word unless the row is kept", async () => {
    m.fetchCompanionJournal.mockResolvedValue([
      { ...row("1", "drafty text", '["journal"]'), review_state: "draft" },
      { ...row("2", "kept text", '["journal"]'), review_state: "kept" },
    ]);
    const html = renderToStaticMarkup(await Page());
    expect(html.split("draft</span>").length - 1).toBe(1);
    expect(html).not.toContain("kept</span>");
  });
  it("shows the quiet empty line when loaded and empty", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("No companion entries yet");
  });
});
