import { describe, it, expect } from "vitest";
import {
  resolveWrite, rowLink, whoLabel, titleText, kindLabel, buttons, doneLine, outcomeLine, canSend, rowState, countLine, listCountLine, recentAnswered,
} from "../needs";
import type { NeedsItem } from "../halseth";

const base = { created_at: "2026-10-30 12:00:00", detail: null, title: "t" };
const q: NeedsItem = { ...base, key: "question:q_1", kind: "question", id: "q_1", companion_id: "drevan" };
const g: NeedsItem = { ...base, key: "growth:abc", kind: "growth", id: "abc", companion_id: "gaia" };
const f: NeedsItem = { ...base, key: "guardian:f1", kind: "guardian", id: "f1", companion_id: null, severity: "notice" };
const b: NeedsItem = { ...base, key: "basin:b1", kind: "basin", id: "b1", companion_id: "cypher", title: null, drift_score: 0.4216 };

describe("resolveWrite", () => {
  it("question answer / dismiss", () => {
    expect(resolveWrite(q, { kind: "question", verb: "answer", answer: "yes" })).toEqual({
      key: "needs:question:q_1", url: "/api/questions", method: "POST", body: { id: "q_1", status: "answered", answer: "yes" },
    });
    expect(resolveWrite(q, { kind: "question", verb: "dismiss" }).body).toEqual({ id: "q_1", status: "dismissed" });
  });
  it("growth accept carries companion_id", () => {
    const w = resolveWrite(g, { kind: "growth", verb: "accept" });
    expect(w).toMatchObject({ url: "/api/mind/growth/journal/abc/accept", method: "PATCH", body: { companion_id: "gaia" } });
  });
  it("guardian", () => {
    expect(resolveWrite(f, { kind: "guardian", verb: "resolve" })).toMatchObject({ url: "/api/guardian/f1", method: "PATCH", body: { status: "resolved" } });
    expect(resolveWrite(f, { kind: "guardian", verb: "acknowledge" }).body).toEqual({ status: "acknowledged" });
  });
  it("basin", () => {
    expect(resolveWrite(b, { kind: "basin", verb: "dismiss" })).toMatchObject({ url: "/api/basins", method: "POST", body: { id: "b1", action: "dismiss" } });
  });
});

describe("labels", () => {
  it("whoLabel", () => {
    expect(whoLabel(f)).toBe("Guardian");
    expect(whoLabel({ ...f, companion_id: "cypher" })).toBe("Guardian");
    expect(whoLabel(q)).toBe("Drevan");
    expect(whoLabel(b)).toBe("Cypher");
  });
  it("titleText", () => {
    expect(titleText(b)).toBe("Pressure drift 0.42");
    expect(titleText({ ...b, title: "bond" })).toBe("bond");
  });
  it("kindLabel, buttons, doneLine", () => {
    expect(kindLabel("question")).toBe("asks");
    expect(kindLabel("growth")).toBe("growth to ratify");
    expect(kindLabel("guardian")).toBe("flag");
    expect(kindLabel("basin")).toBe("basin drift");
    expect(buttons(q)).toEqual([{ verb: "answer", label: "Answer" }, { verb: "dismiss", label: "Dismiss" }]);
    expect(buttons(g)).toEqual([{ verb: "accept", label: "Accept" }, { verb: "decline", label: "Decline" }]);
    expect(buttons(f)).toEqual([{ verb: "acknowledge", label: "Seen it" }, { verb: "resolve", label: "Resolved" }]);
    expect(buttons(b)).toEqual([{ verb: "confirm", label: "It's growth" }, { verb: "dismiss", label: "Noise" }]);
    expect(doneLine({ kind: "question", verb: "answer", answer: "x" })).toBe("Answered.");
    expect(doneLine({ kind: "question", verb: "dismiss" })).toBe("Dismissed.");
    expect(doneLine({ kind: "growth", verb: "accept" })).toBe("Accepted.");
    expect(doneLine({ kind: "growth", verb: "decline" })).toBe("Declined.");
    expect(doneLine({ kind: "guardian", verb: "acknowledge" })).toBe("Marked seen.");
    expect(doneLine({ kind: "guardian", verb: "resolve" })).toBe("Resolved.");
    expect(doneLine({ kind: "basin", verb: "confirm" })).toBe("Marked growth.");
    expect(doneLine({ kind: "basin", verb: "dismiss" })).toBe("Marked noise.");
  });
});

describe("outcomeLine", () => {
  it("maps results", () => {
    expect(outcomeLine({ ok: true, status: 200, json: { already_reviewed: true } })).toBe("already");
    expect(outcomeLine({ ok: false, status: 404, json: {} })).toBe("already");
    expect(outcomeLine({ ok: true, status: 200, json: { ok: true } })).toBe("saved");
    expect(outcomeLine({ ok: false, status: 502, json: {} })).toBe("failed");
    expect(outcomeLine("undone")).toBe("undone");
  });
});

describe("canSend", () => {
  it("needs non-space text", () => {
    expect(canSend("")).toBe(false);
    expect(canSend("   ")).toBe(false);
    expect(canSend(" ok ")).toBe(true);
  });
});

describe("rowState", () => {
  it("transitions", () => {
    expect(rowState("idle", "open-answer")).toBe("answering");
    expect(rowState("answering", "cancel")).toBe("idle");
    expect(rowState("idle", "submit")).toBe("pending");
    expect(rowState("pending", "undo")).toBe("idle");
    expect(rowState("pending", "result", "saved")).toBe("saved");
    expect(rowState("pending", "result", "already")).toBe("already");
    expect(rowState("pending", "result", "failed")).toBe("failed");
  });
});

describe("countLine", () => {
  it("says how many are waiting, nothing at zero", () => {
    expect(countLine(0)).toBe("");
    expect(countLine(1)).toBe("1 thing is waiting.");
    expect(countLine(3)).toBe("3 things are waiting.");
  });
  it("says so when the list shows fewer than are waiting", () => {
    expect(countLine({ total: 73 }, 50)).toBe("73 things are waiting. Showing the newest 50.");
    expect(countLine({ total: 50 }, 50)).toBe("50 things are waiting.");
    expect(countLine({ total: 3 }, 3)).toBe("3 things are waiting.");
    expect(countLine({ total: 0 }, 0)).toBe("");
  });
  it("takes a plain number with shown too", () => {
    expect(countLine(52, 50)).toBe("52 things are waiting. Showing the newest 50.");
    expect(countLine(50, 50)).toBe("50 things are waiting.");
  });
});

describe("listCountLine (NeedsList: settled rows dim and stay)", () => {
  it("keeps the cap suffix while rows are still hidden after some settle", () => {
    // 52 waiting, the list holds 50, two of those settle: 50 still waiting, 48 of them on screen.
    expect(listCountLine(52, 50, 2)).toBe("50 things are waiting. Showing the newest 48.");
  });
  it("no suffix when the list holds everything", () => {
    expect(listCountLine(3, 3, 1)).toBe("2 things are waiting.");
    expect(listCountLine(3, 3, 3)).toBe("");
  });
  it("total unknown falls back to the list length", () => {
    expect(listCountLine(undefined, 4, 1)).toBe("3 things are waiting.");
  });
});

describe("rowState undo of an answer", () => {
  it("returns to answering so the text is still there", () => {
    expect(rowState("pending", "undo", undefined, { wasAnswer: true })).toBe("answering");
    expect(rowState("pending", "undo", undefined, { wasAnswer: false })).toBe("idle");
    expect(rowState("pending", "result", "undone", { wasAnswer: true })).toBe("answering");
    expect(rowState("saved", "undo", undefined, { wasAnswer: true })).toBe("saved");
  });
});

describe("recentAnswered", () => {
  const qa = (id: string, created_at: string, answered_at: string | null) =>
    ({ id, companion_id: "cypher", question: "q", context: null, status: "answered", answer: "a", answered_at, created_at }) as never;
  it("sorts by answered_at, falling back to created_at, newest first, and caps", () => {
    const out = recentAnswered([
      qa("new_asked_old_answer", "2026-10-20 10:00:00", "2026-10-21 10:00:00"),
      qa("old_asked_answered_today", "2026-08-01 10:00:00", "2026-10-30 09:00:00"),
      qa("legacy", "2026-10-25 10:00:00", null),
    ], 2);
    expect(out.map((q: { id: string }) => q.id)).toEqual(["old_asked_answered_today", "legacy"]);
  });
  it("does not mutate its input", () => {
    const input = [qa("a", "2026-10-01 00:00:00", "2026-10-02 00:00:00"), qa("b", "2026-10-01 00:00:00", "2026-10-03 00:00:00")];
    recentAnswered(input);
    expect(input.map((q: { id: string }) => q.id)).toEqual(["a", "b"]);
  });
});

describe("basin_move (a revision awaiting Principal's witness)", () => {
  const m: NeedsItem = { ...base, key: "basin_move:m1", kind: "basin_move", id: "m1", companion_id: "gaia", title: "the-line", detail: "refusal" };
  it("says what waits, has no write buttons, and links to the basins page", () => {
    expect(kindLabel("basin_move")).toBe("basin revision");
    expect(titleText(m)).toBe("the-line: a revision is waiting for your witness");
    expect(whoLabel(m)).toBe("Gaia");
    expect(buttons(m)).toEqual([]);
    expect(rowLink(m)).toEqual({ href: "/companions/gaia/basins", label: "Read and decide" });
    expect(rowLink(q)).toBeNull();
    expect(() => resolveWrite(m, { kind: "basin", verb: "dismiss" })).toThrow();
  });
});
