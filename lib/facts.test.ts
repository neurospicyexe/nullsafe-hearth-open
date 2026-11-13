import { describe, it, expect } from "vitest";
import type { ArchitectFact } from "./halseth";
import { replacesLine } from "./facts";

const f = (over: Partial<ArchitectFact>): ArchitectFact => ({
  id: "a", fact: "x", category: "people", status: "active", companion_id: null, source: null,
  weight: 1, created_at: "2026-11-11 10:00:00", ...over,
});

describe("replacesLine", () => {
  const old = f({ id: "old1", fact: "They live in Austin." });
  it("is null when the proposal supersedes nothing", () => {
    expect(replacesLine(f({ id: "p", status: "open" }), [old])).toBeNull();
    expect(replacesLine(f({ id: "p", status: "open", supersedes_id: null }), [old])).toBeNull();
  });
  it("names the old fact's text from the same list", () => {
    const p = f({ id: "p", status: "open", fact: "They live in Denver.", supersedes_id: "old1" });
    expect(replacesLine(p, [old, p])).toBe("They live in Austin.");
  });
  it("says so when the target is not in the list", () => {
    const p = f({ id: "p", status: "open", supersedes_id: "0123456789abcdef" });
    expect(replacesLine(p, [p])).toBe("a fact no longer active (01234567)");
  });
});
