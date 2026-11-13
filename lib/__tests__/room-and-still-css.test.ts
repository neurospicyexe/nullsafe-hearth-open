// P8 guard: the manual Still switch must kill motion exactly like prefers-reduced-motion, and the room
// must stay below the fixed chrome, off the reader, and within the lamp alpha ceiling.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Body of the first block whose opening text matches `open` (brace-balanced). */
function block(open: RegExp): string {
  const m = open.exec(css);
  if (!m) throw new Error(`no block for ${open}`);
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

describe("Still switch css", () => {
  it("html[data-still] applies the same declarations as the reduced-motion block", () => {
    const rmBody = norm(block(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{/));
    const stillBody = norm(block(/html\[data-still\] \*,\s*html\[data-still\] \*::before,\s*html\[data-still\] \*::after \{/));
    expect(rmBody).toContain("animation-duration: 0.01ms !important");
    expect(rmBody).toContain("transition-duration: 0.01ms !important");
    expect(stillBody).toBe(rmBody);
  });
});

describe("room css", () => {
  const room = norm(block(/\nbody::before \{/));
  it("is fixed, behind everything, and never catches taps", () => {
    expect(room).toContain("position: fixed");
    expect(room).toContain("inset: 0");
    expect(room).toContain("z-index: -1");
    expect(room).toContain("pointer-events: none");
  });
  it("crossfades the room tint", () => {
    expect(room).toMatch(/transition: --h-room-top 4\d\dms/);
    expect(css).toMatch(/@property --h-room-top \{[^}]*syntax: "<color>"/);
  });
  it("leaves the shell transparent so the room shows, and hides the room behind the reader", () => {
    expect(norm(block(/\n\.h-shell \{/))).toContain("background: transparent");
    expect(css).toMatch(/body:has\(\.h-reader\)::before \{\s*display: none/);
  });
  it("keeps every time-of-day lamp at or under 12 percent and the dots at 3", () => {
    const pcts = [...css.matchAll(/--h-room-top:\s*color-mix\(in srgb, var\(--h-lamp\) (\d+)%/g)].map((m) => +m[1]);
    expect(pcts.length).toBe(4); // default + morning, afternoon, evening (night is the neutral --h-room-night)
    for (const p of pcts) expect(p).toBeLessThanOrEqual(12);
    expect(room).toContain("var(--h-ink) 3%");
  });
});
