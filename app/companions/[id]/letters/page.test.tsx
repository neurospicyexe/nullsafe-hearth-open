import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({ fetchInbox: vi.fn(), fetchLettersOut: vi.fn(), fetchNotes: vi.fn() }));
vi.mock("@/lib/halseth", () => m);
vi.mock("../client", () => ({ LetterFormClient: () => null }));

import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchInbox.mockResolvedValue({ items: [], unread_count: 0 });
  m.fetchLettersOut.mockResolvedValue([
    { id: "n1", created_at: "2026-10-31 10:00:00", author: "principal", content: "hello you", note_type: "letter:gaia" },
  ]);
});

describe("companion letters page", () => {
  it("reads the filtered outgoing notes and no hex amber", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "gaia" }) }));
    expect(m.fetchLettersOut).toHaveBeenCalledWith(100, "gaia");
    expect(m.fetchNotes).not.toHaveBeenCalled();
    expect(html).toContain("hello you");
    expect(html).not.toContain("#f59e0b");
  });
  const run = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "gaia" }) }));

  it("both sources null shows the shared down line and no empty state", async () => {
    m.fetchLettersOut.mockResolvedValue(null);
    m.fetchInbox.mockResolvedValue(null);
    const html = await run();
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("No letters yet");
  });
  it("outgoing null alone says the letters you left could not load", async () => {
    m.fetchLettersOut.mockResolvedValue(null);
    m.fetchInbox.mockResolvedValue({ items: [], unread_count: 0 });
    const html = await run();
    expect(html).toContain("Couldn&#x27;t load the letters you left for them.");
    expect(html).not.toContain("Couldn&#x27;t load the letters left for you.");
    expect(html).not.toContain("No letters yet");
  });
  it("inbox null alone says the letters left for you could not load", async () => {
    m.fetchInbox.mockResolvedValue(null);
    const html = await run();
    expect(html).toContain("Couldn&#x27;t load the letters left for you.");
    expect(html).not.toContain("Couldn&#x27;t load the letters you left for them.");
    expect(html).toContain("hello you");
  });
  it("orders a zone-less stamp and an ISO Z stamp by instant, oldest first", async () => {
    m.fetchLettersOut.mockResolvedValue([
      { id: "n2", created_at: "2026-10-31 11:00:00", author: "principal", content: "LATE-OUT", note_type: "letter:gaia" },
      { id: "n1", created_at: "2026-10-31 10:00:00", author: "principal", content: "EARLY-OUT", note_type: "letter:gaia" },
    ]);
    m.fetchInbox.mockResolvedValue({
      items: [{ id: "i1", agent: "gaia", created_at: "2026-10-31T10:30:00Z", preview: "MIDDLE-IN", read: true }],
      unread_count: 0,
    });
    const html = await run();
    const at = (t: string) => html.indexOf(t);
    expect(at("EARLY-OUT")).toBeGreaterThan(-1);
    expect(at("EARLY-OUT")).toBeLessThan(at("MIDDLE-IN"));
    expect(at("MIDDLE-IN")).toBeLessThan(at("LATE-OUT"));
  });
});
