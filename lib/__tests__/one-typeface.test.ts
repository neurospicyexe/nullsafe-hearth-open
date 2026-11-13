// One readable typeface: Atkinson Hyperlegible (--h-font) everywhere. Caveat and Quicksand are gone.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");

describe("one typeface", () => {
  it("no CSS rule references the retired font variables or names", () => {
    expect(css).not.toMatch(/--font-display|--font-body/);
    expect(css).not.toMatch(/Caveat|Quicksand/i);
  });
  it("layout loads only Atkinson Hyperlegible", () => {
    expect(layout).toMatch(/Atkinson_Hyperlegible/);
    expect(layout).not.toMatch(/Caveat|Quicksand|--font-display|--font-body/);
    expect(layout.match(/next\/font\/google/g)).toHaveLength(1);
    expect(layout.match(/variable:\s*"/g)).toHaveLength(1);
  });
  it("legacy titles are heavy and use the kit font", () => {
    for (const sel of [".page-title", ".section-title"]) {
      const start = css.indexOf(`${sel} {`);
      expect(start).toBeGreaterThan(-1);
      const body = css.slice(start, css.indexOf("}", start));
      expect(body).toMatch(/var\(--h-font/);
      expect(body).toMatch(/font-weight:\s*700/);
    }
  });
});
