// P8 guard: the card silhouette (chamfer + fading top hairline + drawn diagonal) lives on the five
// opaque card classes only; focus rings stay inside the clipped box; edge decoration never sets text color.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function ruleFor(selectorStart: string): string {
  const i = css.lastIndexOf(selectorStart);
  if (i < 0) throw new Error(`no rule ${selectorStart}`);
  const open = css.indexOf("{", i);
  return norm(css.slice(open + 1, css.indexOf("}", open)));
}

const SHAPE = ".card,\n.h-panel:not(.is-answer),\n.h-hood-card,\n.h-home-card,\n.h-door {";

describe("card silhouette", () => {
  const shape = ruleFor(SHAPE);
  it("the five card classes carry the chamfer, hairline and diagonal", () => {
    expect(shape).toContain("clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)");
    expect(shape).toContain("border-color: var(--h-edge)");
    expect(shape).toContain("border-top-right-radius: 0");
    expect(shape).toMatch(/linear-gradient\(to right, var\(--h-edge\), transparent\)/);
    expect(shape).toMatch(/linear-gradient\(to top right,[^;]*var\(--h-edge\)/);
  });
  it("the transparent answer panel and library cards are excluded", () => {
    const sel = css.slice(css.indexOf(SHAPE) - 0, css.indexOf(SHAPE) + SHAPE.length);
    expect(sel).toContain(".h-panel:not(.is-answer)");
    expect(sel).not.toContain("h-library");
    expect(sel).not.toContain("spine");
  });
  it("focus rings on clipped classes are inset", () => {
    const f = ruleFor(".card:focus-visible,");
    expect(f).toBe("outline-offset: -3px;");
    for (const c of [".card", ".h-panel:not(.is-answer)", ".h-hood-card", ".h-home-card", ".h-door"]) {
      expect(css).toContain(`${c}:focus-visible`);
    }
  });
  it("--h-edge defaults to --h-line and tints from --c with a safe fallback", () => {
    expect(css).toMatch(/--h-edge: var\(--h-line\);/);
    expect(ruleFor("[style*=\"--c:\"] { --h-edge")).toBe("--h-edge: color-mix(in srgb, var(--c, var(--h-line)) 35%, var(--h-line));".replace("--h-edge: ", "--h-edge: "));
  });
  it("edge rules set no text color", () => {
    expect(shape).not.toMatch(/(^|[; ])color:/);
    expect(css).not.toMatch(/\[data-companion\] \{ --h-edge[^}]*[^-]color:/);
  });

  it("top border is transparent so the hairline fade shows", () => {
    expect(shape).toContain("border-top-color: transparent");
    expect(shape.indexOf("border-color: var(--h-edge)")).toBeLessThan(shape.indexOf("border-top-color: transparent"));
  });
  it("the --c case: inline custom property renders as style=\"--c:...\" and the selector matches it", () => {
    const html = renderToStaticMarkup(createElement("div", { className: "card h-cmp-card", style: { "--c": "var(--h-cypher)" } as CSSProperties }));
    expect(html).toContain('style="--c:var(--h-cypher)"');
    expect(css).toContain("[data-companion],\n[style*=\"--c:\"] { --h-edge:");
  });
  it(".h-phx-col tints through --h-edge and sets no border-color of its own", () => {
    expect(ruleFor(".h-phx-col {")).not.toContain("border-color");
    const tint = ruleFor(".h-phx-col { --h-edge");
    expect(tint).toContain("--h-edge: color-mix(in srgb, var(--c, var(--h-line)) 25%, var(--h-line))");
  });
  it("focusable descendants of clipped cards get an inset ring", () => {
    const i = css.indexOf(":is(.card, .h-panel:not(.is-answer), .h-hood-card, .h-home-card, .h-door) :focus-visible");
    expect(i).toBeGreaterThan(0);
    expect(ruleFor(":is(.card, .h-panel:not(.is-answer), .h-hood-card, .h-home-card, .h-door) :focus-visible")).toBe("outline-offset: -2px;");
  });
});

describe("card hover keeps the companion edge", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
  it("the P8 .card:hover mixes --h-edge, keeps the faded top hairline, no transform or glow", () => {
    const rules = [...css.matchAll(/\.card:hover\s*\{([^{}]*)\}/g)].map((m) => m[1]);
    const p8 = rules[rules.length - 1];
    expect(p8).toContain("border-color: color-mix(in srgb, var(--h-edge) 70%, var(--h-line-strong))");
    expect(p8).toContain("border-top-color: transparent");
    expect(p8).not.toMatch(/transform|shadow|filter/);
    expect(css.lastIndexOf(".card:hover")).toBeGreaterThan(css.indexOf("P8 card silhouette"));
  });
});
