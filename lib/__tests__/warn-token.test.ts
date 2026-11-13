// Every warn line shares one token so the visual pass retunes a single value.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("--h-warn token", () => {
  it("is defined in :root and is distinct from the Drevan color", () => {
    const warn = css.match(/--h-warn:\s*(#[0-9a-fA-F]{3,8})/);
    const drevan = css.match(/--h-drevan:\s*(#[0-9a-fA-F]{3,8})/);
    expect(warn).not.toBeNull();
    expect(drevan).not.toBeNull();
    expect(warn![1].toLowerCase()).not.toBe(drevan![1].toLowerCase());
  });
  it("every .is-warn rule reads it", () => {
    const rules = [...css.matchAll(/\.[\w-]+\.is-warn\s*\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThanOrEqual(1);
    for (const r of rules) expect(r[1]).toMatch(/color:\s*var\(--h-warn\)/);
  });
});
