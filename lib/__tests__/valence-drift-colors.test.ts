// P7: one meaning per valence key and per basin drift type, on every surface.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VALENCE } from "../domain-colors";

const lines = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").split(/\r?\n/);
const TOKEN = { toward: "ink", tender: "muted", neutral: "faint", repair: "gaia", rupture: "warn" } as const;

/** The declaration body of the one-line rule whose selector is exactly `selector`. */
function body(selector: string): string {
  const line = lines.find((l) => l.startsWith(selector + " {") || l.startsWith(selector + "  {"));
  expect(line, `rule ${selector} missing`).toBeDefined();
  return line!.slice(line!.indexOf("{") + 1, line!.lastIndexOf("}"));
}

/** True when the body sets exactly `prop` (not a longer property name) to var(--h-<tok>). */
const sets = (decls: string, prop: string, tok: string) =>
  decls.split(";").some((d) => {
    const i = d.indexOf(":");
    return i > 0 && d.slice(0, i).trim() === prop && d.slice(i + 1).trim() === `var(--h-${tok})`;
  });

describe("valence colors", () => {
  for (const [key, tok] of Object.entries(TOKEN)) {
    it(`${key} is --h-${tok} in the TS map and all three CSS sets`, () => {
      expect(VALENCE[key]).toBe(`var(--h-${tok})`);
      expect(sets(body(`.valence-fill.${key}`), "background", tok)).toBe(true);
      expect(sets(body(`.valence-badge.${key}`), "color", tok)).toBe(true);
      expect(sets(body(`.delta-valence.${key}`), "color", tok)).toBe(true);
    });
  }
  it("the TS map has exactly the five canon keys", () => {
    expect(Object.keys(VALENCE).sort()).toEqual(Object.keys(TOKEN).sort());
  });
});

describe("basin drift type colors", () => {
  const DRIFT = { stable: "muted", growth: "ink", pressure: "lamp" } as const;
  for (const [type, tok] of Object.entries(DRIFT)) {
    it(`${type} is --h-${tok} on /basins and the home rooms`, () => {
      expect(sets(body(`.h-basin-tint.is-${type}`), "color", tok)).toBe(true);
      expect(sets(body(`.h-basin-pt.is-${type}`), "fill", tok)).toBe(true);
      expect(sets(body(`.h-rooms-drift.is-${type}`), "color", tok)).toBe(true);
    });
  }
});
