import { describe, it, expect, vi } from "vitest";
import { createWriteQueue, type QueueDeps } from "../write-queue";
import {
  createCheckin,
  fieldsFromForm,
  summaryParts,
  todaysCheckin,
  foldedUntilTomorrow,
  foldMarker,
  type Outcome,
  type WordState,
} from "../checkin";

type Call = { url: string; method: string; body: Record<string, unknown> | undefined };

// Real queue, fake network and clock. `hold()` makes the next fetch hang until released.
function harness() {
  let now = 0;
  let nextTimer = 1;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const calls: Call[] = [];
  let holdNext = false;
  let mode: "ok" | "offline" | "404" = "ok";
  const held: Array<(r: "ok" | "offline") => void> = [];
  const answer = (outcome: "ok" | "offline" | "404") => {
    if (outcome === "offline") throw new Error("offline");
    const status = outcome === "404" ? 404 : 200;
    return { ok: status === 200, status, redirected: false, json: async () => ({ ok: true }) } as unknown as Response;
  };
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: String(init?.method),
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
    });
    if (holdNext) {
      holdNext = false;
      const outcome = await new Promise<"ok" | "offline">((r) => held.push(r));
      return answer(outcome);
    }
    return answer(mode);
  });
  const deps: QueueDeps = {
    fetch: fetchMock as unknown as typeof fetch,
    storage: null,
    setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (h) => { timers.delete(h as number); },
  };
  const queue = createWriteQueue(deps);
  const outcomes: Outcome[] = [];
  const words: WordState[] = [];
  const checkin = createCheckin(
    queue,
    { newId: () => `id-${nextId++}-abcdef`, now: () => new Date(Date.UTC(2026, 9, 30, 3, 0, 0) + now) },
    (o) => outcomes.push(o),
    (w) => words.push(w),
  );
  const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  const advance = async (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); }
    await settle();
  };
  return {
    queue, checkin, calls, outcomes, words, advance, settle,
    hold: () => { holdNext = true; },
    release: async (r: "ok" | "offline" = "ok") => { held.shift()!(r); await settle(); },
    setMode: (m: typeof mode) => { mode = m; },
  };
}

describe("checkin", () => {
  it("a tap POSTs the client id and the tap time, after the grace window", async () => {
    const h = harness();
    h.checkin.tap(4);
    await h.advance(5000);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ url: "/api/biometrics", method: "POST" });
    expect(h.calls[0].body).toMatchObject({ id: "id-1-abcdef", spoons: 4, recorded_at: "2026-10-30T03:00:00.000Z" });
    expect(h.outcomes).toEqual(["landed"]);
  });

  it("two taps in grace send one POST with the newer number", async () => {
    const h = harness();
    expect(h.checkin.tap(4)).toBe("new");
    await h.advance(1000);
    expect(h.checkin.tap(7)).toBe("same");
    await h.advance(5000);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toMatchObject({ id: "id-1-abcdef", spoons: 7 });
  });

  it("undo in grace sends nothing", async () => {
    const h = harness();
    h.checkin.tap(4);
    h.checkin.undo();
    await h.advance(10000);
    expect(h.calls).toHaveLength(0);
  });

  it("undo after it landed DELETEs that row id", async () => {
    const h = harness();
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.undo();
    await h.advance(5000);
    expect(h.calls[1]).toMatchObject({ url: "/api/biometrics/id-1-abcdef", method: "DELETE" });
  });

  it("undo while the POST is in flight waits for it, then DELETEs only if it landed", async () => {
    const h = harness();
    h.hold();
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.undo();
    await h.advance(10000);
    expect(h.calls).toHaveLength(1); // no DELETE racing ahead of the POST
    await h.release("ok");
    await h.advance(5000);
    expect(h.calls[1]).toMatchObject({ url: "/api/biometrics/id-1-abcdef", method: "DELETE" });

    const g = harness();
    g.hold();
    g.checkin.tap(4);
    await g.advance(5000);
    g.checkin.undo();
    await g.release("offline");
    await g.advance(10000);
    expect(g.calls).toHaveLength(1);
  });

  it("a tap while the previous POST is in flight starts a new row and DELETEs the superseded one once it lands", async () => {
    const h = harness();
    h.hold();
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.tap(6);
    await h.advance(5000);
    expect(h.calls[1].body).toMatchObject({ id: "id-2-abcdef", spoons: 6 });
    await h.release("ok");
    await h.advance(5000);
    expect(h.calls[2]).toMatchObject({ url: "/api/biometrics/id-1-abcdef", method: "DELETE" });
    expect(h.outcomes).toEqual(["landed"]); // only the current check-in reports
  });

  it("a tap after the previous one landed is a new log and keeps the old row", async () => {
    const h = harness();
    h.checkin.tap(4);
    await h.advance(5000);
    expect(h.checkin.tap(6)).toBe("new");
    await h.advance(5000);
    expect(h.calls.map((c) => c.method)).toEqual(["POST", "POST"]);
    expect(h.calls[1].body).toMatchObject({ id: "id-2-abcdef" });
  });

  it("a word in grace rides the one POST", async () => {
    const h = harness();
    h.checkin.tap(4);
    h.checkin.saveWord({ mood: "foggy" });
    await h.advance(5000);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toMatchObject({ id: "id-1-abcdef", spoons: 4, mood: "foggy" });
  });

  it("a word after it landed PATCHes that row id", async () => {
    const h = harness();
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.saveWord({ mood: "foggy", energy: 3 });
    await h.advance(5000);
    expect(h.calls[1]).toMatchObject({ url: "/api/biometrics/id-1-abcdef", method: "PATCH", body: { mood: "foggy", energy: 3 } });
  });

  it("a word while the POST is in flight PATCHes after it lands", async () => {
    const h = harness();
    h.hold();
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.saveWord({ mood: "foggy" });
    await h.advance(10000);
    expect(h.calls).toHaveLength(1);
    await h.release("ok");
    await h.advance(5000);
    expect(h.calls[1]).toMatchObject({ url: "/api/biometrics/id-1-abcdef", method: "PATCH", body: { mood: "foggy" } });
  });

  it("undo after a failed send forgets the stored POST and DELETEs the client id (the answer may have been lost)", async () => {
    const h = harness();
    h.setMode("offline");
    h.checkin.tap(4);
    await h.advance(5000);
    expect(h.outcomes).toEqual(["failed"]);
    expect(h.queue.failed().map((w) => w.key)).toEqual(["spoons"]);
    h.checkin.undo();
    h.setMode("404"); // the POST never landed: Halseth has no such row
    await h.advance(5000);
    expect(h.calls[1]).toMatchObject({ url: "/api/biometrics/id-1-abcdef", method: "DELETE" });
    expect(h.queue.failed()).toEqual([]); // the stored POST is gone and the 404 DELETE is dropped, not retried
  });

  it("an offline undo of a failed send keeps the DELETE for retry", async () => {
    const h = harness();
    h.setMode("offline");
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.undo();
    await h.advance(5000);
    expect(h.queue.failed().map((w) => w.key)).toEqual(["spoons-undo-id-1-abcdef"]);
  });

  it("a word riding the POST is 'saving' until the POST answers, then 'saved'", async () => {
    const h = harness();
    h.checkin.tap(4);
    h.checkin.saveWord({ mood: "foggy" });
    expect(h.words).toEqual(["saving"]);
    await h.advance(5000);
    expect(h.words).toEqual(["saving", "saved"]);
  });

  it("a PATCHed word is never 'saved' before the PATCH answers ok", async () => {
    const h = harness();
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.saveWord({ mood: "foggy" });
    await h.advance(4000);
    expect(h.words).toEqual(["saving"]);
    await h.advance(1000);
    expect(h.words).toEqual(["saving", "saved"]);
  });

  it("a PATCHed word that fails says so, and the strip owns that failure", async () => {
    const h = harness();
    h.checkin.tap(4);
    await h.advance(5000);
    h.setMode("offline");
    h.checkin.saveWord({ mood: "foggy" });
    await h.advance(5000);
    expect(h.words).toEqual(["saving", "failed"]);
    expect(h.checkin.owned()).toEqual(["spoons-word-id-1-abcdef"]);

    const g = harness();
    g.checkin.tap(4);
    await g.advance(5000);
    g.setMode("404");
    g.checkin.saveWord({ mood: "foggy" });
    await g.advance(5000);
    expect(g.words).toEqual(["saving", "dropped"]);
  });

  it("a word saved while the POST is in flight is 'saving' until its PATCH lands", async () => {
    const h = harness();
    h.hold();
    h.checkin.tap(4);
    await h.advance(5000);
    h.checkin.saveWord({ mood: "foggy" });
    await h.release("ok");
    expect(h.words).toEqual(["saving", "saving"]);
    await h.advance(5000);
    expect(h.words.at(-1)).toBe("saved");
  });

  it("owned() names the strip's failed POST, and nothing once it is undone", async () => {
    const h = harness();
    expect(h.checkin.owned()).toEqual([]);
    h.setMode("offline");
    h.checkin.tap(4);
    await h.advance(5000);
    expect(h.checkin.owned()).toEqual(["spoons"]);
    h.checkin.undo();
    expect(h.checkin.owned()).toEqual([]);
  });

  it("a 4xx reports dropped (nothing will retry it)", async () => {
    const h = harness();
    h.setMode("404");
    h.checkin.tap(4);
    await h.advance(5000);
    expect(h.outcomes).toEqual(["dropped"]);
  });

  it("undo and word writes are keyed per row, so two rows never collide", async () => {
    const h = harness();
    h.checkin.tap(4);
    await h.advance(5000);
    h.setMode("offline");
    h.checkin.undo(); // DELETE id-1 fails and is kept
    await h.advance(5000);
    h.setMode("ok");
    h.checkin.tap(5);
    await h.advance(5000);
    h.setMode("offline");
    h.checkin.saveWord({ mood: "ok" }); // PATCH id-2 fails and is kept
    await h.advance(5000);
    expect(h.queue.failed().map((w) => w.key).sort()).toEqual(["spoons-undo-id-1-abcdef", "spoons-word-id-2-abcdef"]);
  });
});

describe("save (the check-in card)", () => {
  it("any one field is enough: a pain-only check-in POSTs without spoons", async () => {
    const h = harness();
    h.checkin.save({ pain: 4 });
    await h.advance(5000);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ url: "/api/biometrics", method: "POST" });
    expect(h.calls[0].body).toMatchObject({ id: "id-1-abcdef", pain: 4, source: "hearth-quick" });
    expect("spoons" in h.calls[0].body!).toBe(false);
    expect(h.outcomes).toEqual(["landed"]);
  });

  it("carries every field in the one POST", async () => {
    const h = harness();
    h.checkin.save({ spoons: 5, pain: 4, pain_where: "hips", notes: "slow morning" });
    await h.advance(5000);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toMatchObject({ spoons: 5, pain: 4, pain_where: "hips", notes: "slow morning" });
  });

  it("edit after it landed PATCHes the SAME row, never a second POST", async () => {
    const h = harness();
    h.checkin.save({ spoons: 5, pain: 4 });
    await h.advance(5000);
    h.checkin.save({ pain: 6, notes: "worse" });
    await h.advance(5000);
    expect(h.calls.map((c) => c.method)).toEqual(["POST", "PATCH"]);
    expect(h.calls[1].url).toBe("/api/biometrics/id-1-abcdef");
    expect(h.calls[1].body).toEqual({ pain: 6, notes: "worse" });
    expect(h.words).toContain("saved");
  });

  it("an edit inside the grace window rides the one POST", async () => {
    const h = harness();
    h.checkin.save({ spoons: 5 });
    await h.advance(1000);
    h.checkin.save({ spoons: 6, notes: "ok" });
    await h.advance(5000);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toMatchObject({ spoons: 6, notes: "ok" });
  });

  it("adopt binds the card to today's existing row: the next save PATCHes that id", async () => {
    const h = harness();
    h.checkin.adopt("row-from-today-1");
    h.checkin.save({ spoons: 3 });
    await h.advance(5000);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ url: "/api/biometrics/row-from-today-1", method: "PATCH", body: { spoons: 3 } });
  });

  it("a PATCH Halseth refuses (4xx) is a failed save, not a crash, and says so", async () => {
    const h = harness();
    h.checkin.adopt("row-from-today-1");
    h.setMode("404"); // any 4xx is a refusal the queue drops
    h.checkin.save({ pain: 4 });
    await h.advance(5000);
    expect(h.words).toContain("dropped");
  });

  it("a PATCH that cannot reach the server is kept for retry (failed), and owned by the card", async () => {
    const h = harness();
    h.checkin.adopt("row-from-today-1");
    h.setMode("offline");
    h.checkin.save({ pain: 4 });
    await h.advance(5000);
    expect(h.words).toContain("failed");
    expect(h.checkin.owned()).toEqual(["spoons-word-row-from-today-1"]);
  });

  it("saving nothing does nothing", async () => {
    const h = harness();
    h.checkin.save({});
    await h.advance(5000);
    expect(h.calls).toHaveLength(0);
  });
});

describe("fieldsFromForm", () => {
  const empty = { spoons: null, pain: null, painWhere: "", notes: "" };
  it("is null when nothing is filled in", () => {
    expect(fieldsFromForm(empty, null)).toBeNull();
    expect(fieldsFromForm({ ...empty, painWhere: "  ", notes: " \n " }, null)).toBeNull();
  });
  it("keeps spoons 0 and pain 0 (zero is an answer)", () => {
    expect(fieldsFromForm({ ...empty, spoons: 0, pain: 0 }, null)).toEqual({ spoons: 0, pain: 0 });
  });
  it("trims and caps the text fields", () => {
    const f = fieldsFromForm({ ...empty, painWhere: " hips ", notes: "n".repeat(3000) }, null)!;
    expect(f.pain_where).toBe("hips");
    expect(f.notes).toHaveLength(2000);
    expect(fieldsFromForm({ ...empty, painWhere: "w".repeat(200) }, null)!.pain_where).toHaveLength(120);
  });
  it("on an edit, clearing a saved field sends the clear", () => {
    const saved = { id: "r", spoons: 5, pain: 4, pain_where: "hips", notes: "word" };
    expect(fieldsFromForm({ spoons: 5, pain: null, painWhere: "", notes: "" }, saved)).toEqual({ spoons: 5, pain: null, pain_where: "", notes: "" });
  });
  it("on an edit, an untouched empty field is not sent", () => {
    const saved = { id: "r", spoons: 5, pain: null, pain_where: null, notes: null };
    expect(fieldsFromForm({ spoons: 6, pain: null, painWhere: "", notes: "" }, saved)).toEqual({ spoons: 6 });
  });
});

describe("summaryParts", () => {
  it("reads like the design: 5 spoons, 4 pain, where, the word", () => {
    expect(summaryParts({ spoons: 5, pain: 4, pain_where: "hips", notes: "slow" })).toEqual(["5 spoons", "4 pain", "hips", "“slow”"]);
  });
  it("leaves out what was not given, and says 1 spoon", () => {
    expect(summaryParts({ spoons: 1, pain: null, pain_where: null, notes: null })).toEqual(["1 spoon"]);
    expect(summaryParts({ spoons: null, pain: 0, pain_where: null, notes: null })).toEqual(["0 pain"]);
  });
  it("cuts a long note to one short line with an ellipsis", () => {
    const parts = summaryParts({ spoons: null, pain: null, pain_where: null, notes: "a very long sentence about how the whole day has been going so far for me" });
    expect(parts).toHaveLength(1);
    expect(parts[0].endsWith("…”")).toBe(true);
    expect(parts[0].length).toBeLessThan(40);
  });
  it("collapses newlines in a note", () => {
    expect(summaryParts({ spoons: null, pain: null, pain_where: null, notes: "a\n\nb" })).toEqual(["“a b”"]);
  });
});

describe("todaysCheckin", () => {
  const now = new Date(2026, 10, 3, 21, 0, 0); // local Mon evening
  const at = (d: Date) => d.toISOString();
  const row = (over: Record<string, unknown>) => ({ id: "row-1-abcdef", source: "hearth", spoons: null, pain: null, pain_where: null, notes: null, mood: null, recorded_at: at(new Date(2026, 10, 3, 9, 0, 0)), ...over });
  it("finds today's hearth check-in and maps it", () => {
    expect(todaysCheckin([row({ spoons: 5, pain: 4, pain_where: "hips", notes: "slow" })], now)).toEqual({
      id: "row-1-abcdef", spoons: 5, pain: 4, pain_where: "hips", notes: "slow",
    });
  });
  it("uses the old mood word when there are no notes", () => {
    expect(todaysCheckin([row({ spoons: 5, mood: "foggy" })], now)?.notes).toBe("foggy");
  });
  it("ignores yesterday, wearable rows and rows with nothing in them", () => {
    expect(todaysCheckin([row({ spoons: 5, recorded_at: at(new Date(2026, 10, 2, 22, 0, 0)) })], now)).toBeNull();
    expect(todaysCheckin([row({ spoons: 5, source: "oura" })], now)).toBeNull();
    expect(todaysCheckin([row({})], now)).toBeNull();
  });
  it("takes the newest of today's rows (list is newest first)", () => {
    const r = todaysCheckin([row({ id: "new-row-12345", spoons: 3 }), row({ id: "old-row-12345", spoons: 8 })], now);
    expect(r?.id).toBe("new-row-12345");
  });
  it("is null for a non-array (Halseth down)", () => {
    expect(todaysCheckin(null, now)).toBeNull();
    expect(todaysCheckin({ error: "x" }, now)).toBeNull();
  });
});

describe("not now (fold until tomorrow)", () => {
  const mon = new Date(2026, 10, 3, 21, 0, 0);
  it("folds for the rest of the same local day only", () => {
    const marker = foldMarker(mon);
    expect(foldedUntilTomorrow(marker, new Date(2026, 10, 3, 23, 59, 0))).toBe(true);
    expect(foldedUntilTomorrow(marker, new Date(2026, 10, 4, 0, 1, 0))).toBe(false);
  });
  it("an absent or odd marker is not folded", () => {
    expect(foldedUntilTomorrow(null, mon)).toBe(false);
    expect(foldedUntilTomorrow("garbage", mon)).toBe(false);
  });
});
