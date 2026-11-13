import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "./page";
import { CELLAR_SECTIONS } from "@/lib/shell";

describe("/archive (the cellar)", () => {
  const html = renderToStaticMarkup(<Page />);
  it("renders every section title and door, linked", () => {
    for (const s of CELLAR_SECTIONS) {
      expect(html).toContain(s.title);
      for (const d of s.doors) expect(html).toMatch(new RegExp(`href="${d.href}"[^>]*>${d.label}<`));
    }
  });
  it("is a dense list with no tiles and no hints", () => {
    expect(html).not.toContain("h-door");
    expect(html).toContain("h-cellar-list");
  });
  it("has a search form with an input named q and the honest sentence", () => {
    expect(html).toContain("<form");
    expect(html).toMatch(/<input[^>]*name="q"/);
    expect(html).toContain("Searches recent items: the newest 50 of each kind.");
  });
  it("puts the search form before the sections", () => {
    expect(html.indexOf("<form")).toBeGreaterThan(-1);
    expect(html.indexOf("<form")).toBeLessThan(html.indexOf("h-cellar-section"));
  });
  it("labels /us Relational moments", () => {
    expect(html).toMatch(/href="\/us"[^>]*>Relational moments</);
  });
});
