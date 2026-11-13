import { describe, it, expect } from "vitest";
import { mergeLetters, directionLabel } from "../letters-model";
import type { InboxItem, Note } from "../halseth";

const inc = (id: string, agent: string, at: string, read = false): InboxItem => ({
  id, kind: "letter", agent, created_at: at, preview: `p-${id}`, text: `t-${id}`, read,
});
const out = (id: string, type: string, at: string): Note => ({
  id, created_at: at, author: "principal", content: `c-${id}`, note_type: type,
});

describe("mergeLetters", () => {
  it("interleaves incoming and outgoing newest first", () => {
    const rows = mergeLetters(
      [inc("a", "drevan", "2026-10-30 10:00:00"), inc("c", "cypher", "2026-10-28 10:00:00", true)],
      [out("b", "letter:gaia", "2026-10-29 10:00:00"), out("d", "letter:drevan", "2026-10-31 10:00:00")],
    );
    expect(rows.map((r) => r.key)).toEqual(["out:d", "in:a", "out:b", "in:c"]);
    expect(rows[1]).toMatchObject({ dir: "in", href: "/letters/a", read: false, companion: "drevan", text: "p-a" });
    expect(rows[0]).toMatchObject({ dir: "out", href: null, read: null, companion: "drevan", text: "c-d" });
  });
  it("sorts across space-form and ISO timestamps by real time", () => {
    const rows = mergeLetters(
      [inc("early", "drevan", "2026-10-31 09:00:00"), inc("late", "drevan", "2026-10-31 11:00:00")],
      [out("mid", "letter:gaia", "2026-10-31T10:00:00.000Z")],
    );
    expect(rows.map((r) => r.key)).toEqual(["in:late", "out:mid", "in:early"]);
  });
  it("collapses a duplicated incoming id", () => {
    const rows = mergeLetters([inc("a", "drevan", "2026-10-30 10:00:00"), inc("a", "drevan", "2026-10-30 10:00:00")], []);
    expect(rows).toHaveLength(1);
  });
  it("keeps an unparseable note_type with an empty companion", () => {
    const rows = mergeLetters([], [out("x", "weird", "2026-10-30 10:00:00")]);
    expect(rows[0].companion).toBe("");
  });
});

describe("directionLabel", () => {
  it("names the direction", () => {
    const [a] = mergeLetters([inc("a", "drevan", "2026-10-30 10:00:00")], []);
    const [b] = mergeLetters([], [out("b", "letter:gaia", "2026-10-30 10:00:00")]);
    expect(directionLabel(a, "Drevan")).toBe("from Drevan");
    expect(directionLabel(b, "Gaia")).toBe("to Gaia");
  });
});
