// The epub iframe can't read CSS variables, so highlight fills are hex mirrors of the kit tokens
// (Task 7 fix round 1 ruling). Pin the values so a token change is a deliberate edit in both places.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HIGHLIGHT_FILL } from "./highlight";

describe("HIGHLIGHT_FILL", () => {
  it("is the ruled set of four fills", () => {
    expect({ ...HIGHLIGHT_FILL }).toEqual({
      principal: "#e9ad48",
      drevan: "#e47a52",
      gaia: "#86c27f",
      cypher: "#8fa3b8",
    });
  });

  it("mirrors the kit tokens for principal, drevan and gaia", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    const token = (name: string) => css.match(new RegExp(`--h-${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1]?.toLowerCase();
    expect(HIGHLIGHT_FILL.principal).toBe(token("lamp"));
    expect(HIGHLIGHT_FILL.drevan).toBe(token("drevan"));
    expect(HIGHLIGHT_FILL.gaia).toBe(token("gaia"));
  });

  it("is read-only", () => {
    expect(Object.isFrozen(HIGHLIGHT_FILL)).toBe(true);
  });
});
