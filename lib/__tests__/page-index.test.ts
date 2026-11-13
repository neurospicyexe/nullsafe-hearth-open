import { describe, it, expect } from "vitest";
import { matchPages, PAGE_INDEX } from "../page-index";

describe("matchPages", () => {
  it("empty or whitespace query returns nothing", () => {
    expect(matchPages("")).toEqual([]);
    expect(matchPages("   ")).toEqual([]);
  });
  it("finds a Hood page by name and names its hub", () => {
    const r = matchPages("facts");
    expect(r[0]).toMatchObject({ href: "/facts", label: "Facts", hub: "Cellar" });
  });
  it("label prefix outranks a label or hint contains", () => {
    const r = matchPages("g");
    const firstContains = r.findIndex((p) => !p.label.toLowerCase().startsWith("g"));
    const lastPrefix = r.map((p) => p.label.toLowerCase().startsWith("g")).lastIndexOf(true);
    expect(r[0].label.toLowerCase().startsWith("g")).toBe(true);
    if (firstContains >= 0) expect(lastPrefix).toBeLessThan(firstContains);
  });
  it("matches a hint when the label does not", () => {
    const r = matchPages("lane");
    expect(r.map((p) => p.href)).toContain("/drifts");
  });
  it("is case-insensitive and finds the tabs and the hood hub", () => {
    expect(matchPages("NEEDS")[0].href).toBe("/needs");
    expect(matchPages("cellar")[0].href).toBe("/archive");
    expect(matchPages("home").map((p) => p.href)).toContain("/");
  });
  it("de-duplicates by href", () => {
    const hrefs = PAGE_INDEX.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(matchPages("guardian").filter((p) => p.href === "/guardian")).toHaveLength(1);
  });
  it("respects the limit", () => {
    expect(matchPages("a", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("hints survive the dedupe", () => {
  it("finds Guardian and Basins by their cellar hints", () => {
    expect(matchPages("weekly letter").map((p) => p.href)).toContain("/guardian");
    expect(matchPages("identity drift").map((p) => p.href)).toContain("/basins");
  });
  it("names the hub a page lives in", () => {
    expect(PAGE_INDEX.find((p) => p.href === "/guardian")?.hub).toBe("Cellar");
    expect(PAGE_INDEX.find((p) => p.href === "/creatures")?.hub).toBe("Us");
  });
});
