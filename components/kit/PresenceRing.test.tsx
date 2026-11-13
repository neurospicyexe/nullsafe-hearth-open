import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PresenceRing } from "./PresenceRing";
import WhoIsHome from "../home/WhoIsHome";
import { buildWhoIsHome } from "@/lib/home-model";
import type { SomaData } from "@/lib/halseth";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const NOW = new Date("2026-11-01T12:00:00Z");

function soma(moodSetAt: string): SomaData {
  const base = { current_mood: "warm", mood_set_at: moodSetAt, seen_at: "2026-11-01 11:00:00" };
  return { drevan: base, cypher: base, gaia: base } as unknown as SomaData;
}

describe("PresenceRing", () => {
  it("fresh rings breathe, stale rings do not; both are aria-hidden with the sym", () => {
    const fresh = renderToStaticMarkup(<PresenceRing id="drevan" fresh />);
    const stale = renderToStaticMarkup(<PresenceRing id="drevan" fresh={false} size="lg" />);
    expect(fresh).toContain("is-fresh");
    expect(fresh).toContain('aria-hidden="true"');
    expect(fresh).toContain("◈");
    expect(fresh).toContain("--c:var(--h-drevan)");
    expect(stale).toContain("is-stale");
    expect(stale).not.toContain("is-fresh");
    expect(stale).toContain("h-ring-lg");
  });

  it("uses a new 3.5s breath keyframe that the reduced-motion and Still blocks cover", () => {
    expect(css).toMatch(/@keyframes ringBreath[^\n]*scale\(1\.04\)/);
    expect(css).toMatch(/\.h-ring\.is-fresh\s*\{\s*animation:\s*ringBreath 3\.5s ease-in-out infinite/);
    expect(css).not.toMatch(/\.h-ring\.is-stale\s*\{[^}]*animation/);
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*?animation-duration: 0\.01ms !important/);
    expect(css).toMatch(/html\[data-still\] \*,[\s\S]*?animation-iteration-count: 1 !important/);
  });
});

describe("WhoIsHome with rings", () => {
  it("marks fresh by the status-age rule and keeps every previous text", () => {
    const rows = buildWhoIsHome(soma("2026-11-01 08:00:00"), NOW);
    expect(rows.every((r) => r.fresh)).toBe(true);
    const html = renderToStaticMarkup(<WhoIsHome rows={rows} />);
    expect(html).toContain("Who&#x27;s home");
    expect(html).toContain("Drevan");
    expect(html).toContain("warm");
    expect(html).toContain("h-ring");
    expect(html).not.toContain("h-dot");

    const staleRows = buildWhoIsHome(soma("2026-10-29 08:00:00"), NOW);
    expect(staleRows[0].fresh).toBe(false);
    const staleHtml = renderToStaticMarkup(<WhoIsHome rows={staleRows} />);
    expect(staleHtml).toContain("is-stale");
    expect(staleHtml).toContain("last said: warm, 3d");
  });
});
