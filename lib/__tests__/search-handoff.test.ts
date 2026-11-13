import { describe, it, expect } from "vitest";
import { SEARCH_EVENT, openSearch, searchDetail } from "../search-handoff";

describe("search handoff", () => {
  it("openSearch dispatches one hearth:search event carrying the query", () => {
    const target = new EventTarget();
    const seen: string[] = [];
    target.addEventListener(SEARCH_EVENT, (e) => seen.push(searchDetail(e)));
    openSearch("moss", target);
    expect(SEARCH_EVENT).toBe("hearth:search");
    expect(seen).toEqual(["moss"]);
  });
  it("returns empty string for a malformed event", () => {
    expect(searchDetail(new Event("hearth:search"))).toBe("");
    expect(searchDetail(new CustomEvent("hearth:search", { detail: { q: 5 } }))).toBe("");
    expect(searchDetail(new CustomEvent("hearth:search", { detail: null }))).toBe("");
  });
  it("trims whitespace", () => {
    expect(searchDetail(new CustomEvent("hearth:search", { detail: { q: "  moss \n" } }))).toBe("moss");
  });
});
