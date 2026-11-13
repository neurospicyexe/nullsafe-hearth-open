import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DoorList from "./DoorList";
import { Bars } from "./Bars";
import WhoIsHome from "../home/WhoIsHome";
import type { HomeRow } from "@/lib/home-model";

// Pull every meter out of rendered markup as the attributes a reader (or screen reader) sees.
function meters(html: string) {
  const out: { label: string | null; now: string | null; width: string | null }[] = [];
  const re = /<span[^>]*role="meter"[^>]*>\s*<span[^>]*style="([^"]*)"/g;
  for (const m of html.matchAll(re)) {
    const tag = m[0];
    out.push({
      label: /aria-label="([^"]*)"/.exec(tag)?.[1] ?? null,
      now: /aria-valuenow="([^"]*)"/.exec(tag)?.[1] ?? null,
      width: /width:\s*([^;"]+)/.exec(m[1])?.[1] ?? null,
    });
  }
  return out;
}

describe("DoorList", () => {
  it("shows a count pill only for count > 0", () => {
    const html = renderToStaticMarkup(
      <DoorList
        doors={[
          { href: "/a", label: "A", count: 3 },
          { href: "/b", label: "B", count: 0 },
          { href: "/c", label: "C", hint: "see" },
        ]}
      />,
    );
    expect(html.match(/h-door-count/g)).toHaveLength(1);
    // Visible number hidden from screen readers; the spoken text is " 3 new" (a role-less span's
    // aria-label is ignored by screen readers, so the pill carries no aria-label).
    expect(html).toMatch(/<span[^>]*class="h-door-count"[^>]*aria-hidden="true"[^>]*>3<\/span>/);
    expect(html).toContain('<span class="sr-only"> 3 new</span>');
    expect(html).not.toContain("aria-label");
    // The pill follows the label.
    expect(html.indexOf(">A<")).toBeLessThan(html.indexOf("h-door-count"));
    expect(html).toContain("see");
  });
});

describe("Bars", () => {
  it("renders a meter per bar and a trace only for 7 points", () => {
    const html = renderToStaticMarkup(
      <Bars
        color="var(--h-cypher)"
        bars={[
          { label: "focus", pct: 40, trace: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.4] },
          { label: "load", pct: 70, trace: [0.1, 0.2] },
          { label: "heat", pct: 10 },
        ]}
      />,
    );
    expect(meters(html)).toEqual([
      { label: "focus", now: "40", width: "40%" },
      { label: "load", now: "70", width: "70%" },
      { label: "heat", now: "10", width: "10%" },
    ]);
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain("h-trace");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toMatch(/<polyline[^>]*stroke="var\(--h-cypher\)"/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});

describe("WhoIsHome meters (Home regression guard)", () => {
  it("keeps count, order, labels, values and widths", () => {
    const rows: HomeRow[] = [
      { id: "drevan", name: "Drevan", colorVar: "var(--h-drevan)", status: "warm", statusStale: false, fresh: true, mood: "steady", statusAge: "", seenLabel: "2h", bars: [{ label: "heat", pct: 62 }, { label: "reach", pct: 30 }, { label: "weight", pct: 0 }] },
      { id: "cypher", name: "Cypher", colorVar: "var(--h-cypher)", status: null, statusStale: false, fresh: true, mood: "steady", statusAge: "", seenLabel: "", bars: [] },
      { id: "gaia", name: "Gaia", colorVar: "var(--h-gaia)", status: null, statusStale: false, fresh: true, mood: "steady", statusAge: "", seenLabel: "", bars: [{ label: "float 1", pct: 100 }] },
    ];
    const html = renderToStaticMarkup(<WhoIsHome rows={rows} />);
    expect(meters(html)).toEqual([
      { label: "Drevan heat", now: "62", width: "62%" },
      { label: "Drevan reach", now: "30", width: "30%" },
      { label: "Drevan weight", now: "0", width: "0%" },
      { label: "Gaia float 1", now: "100", width: "100%" },
    ]);
    expect(html).not.toContain("<svg");
  });
});
