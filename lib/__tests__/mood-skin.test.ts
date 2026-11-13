import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { moodSkin } from "../mood-skin";

const now = new Date("2026-11-01T12:00:00Z");
const fresh = "2026-11-01 10:00:00";
const m = (current_mood: string | null, extra: Record<string, string | null> = {}) =>
  moodSkin({ current_mood, mood_set_at: fresh, ...extra }, now);

describe("moodSkin", () => {
  it("buckets by vocabulary, case-insensitive substring", () => {
    expect(m("Playful")).toBe("bright");
    expect(m("tender and close")).toBe("warm");
    expect(m("a little RAW")).toBe("heavy");
    expect(m("quiet")).toBe("still");
  });
  it("reads compound_state and surface_emotion too", () => {
    expect(moodSkin({ current_mood: null, compound_state: "worn thin", mood_set_at: fresh }, now)).toBe("heavy");
    expect(moodSkin({ surface_emotion: "giddy", mood_set_at: fresh }, now)).toBe("bright");
  });
  it("calmer wins: still > heavy > warm > bright", () => {
    expect(m("bright but quiet")).toBe("still");
    expect(m("warm and tired")).toBe("heavy");
    expect(m("bright and warm")).toBe("warm");
  });
  it("matches whole words with suffixes and guards negation", () => {
    expect(m("glowing")).toBe("warm");
    expect(m("settled")).toBe("still");
    for (const w of ["restless", "unsettled", "slow", "not calm", "joyless", "closed off", "drawn", "lightly amused", "withheld"]) expect(m(w)).toBe("steady");
    expect(m("exhausted")).toBe("heavy");
    expect(m("energized")).toBe("bright");
    expect(m("still raw")).toBe("heavy");
    expect(m("still aching")).toBe("heavy");
    expect(m("stillness")).toBe("still");
  });
  it("unknown words, empty, and null are steady", () => {
    expect(m("zxqv")).toBe("steady");
    expect(m("")).toBe("steady");
    expect(moodSkin(null, now)).toBe("steady");
  });
  it("stale (>24h) or unstamped is steady", () => {
    expect(moodSkin({ current_mood: "joyful", mood_set_at: "2026-10-30 10:00:00" }, now)).toBe("steady");
    expect(moodSkin({ current_mood: "joyful", mood_set_at: null }, now)).toBe("steady");
  });
});

describe("[data-mood] css is decorative only", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((r) => r[1].includes("data-mood"))
    .map((r) => ({ sel: r[1].trim(), decls: r[2].split(";").map((d) => d.trim()).filter(Boolean) }));
  it("finds the mood rules", () => expect(rules.length).toBeGreaterThanOrEqual(10));
  it("sets no color, background, font or text property", () => {
    const bad = /^(color|background(-[a-z]+)?|font(-[a-z]+)?|--h-(ink|muted|faint|ground|surface|raised|font)\b[a-z-]*)\s*:/;
    for (const r of rules) for (const d of r.decls) expect(`${r.sel} { ${d} }`).not.toMatch(bad);
  });
  it("only sets decorative custom props, or animation: none", () => {
    const ok = /^(--ring-glow|--h-room-top|animation(-duration)?)\s*:/;
    for (const r of rules) for (const d of r.decls) expect(d).toMatch(ok);
  });
  it("room-top mixes keep >= 93% ground and no companion hue sits in a mood rule", () => {
    for (const r of rules) expect(r.decls.join(";")).not.toMatch(/--h-(drevan|cypher|gaia)/);
    const timeRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((r) => r[1].includes("data-time"));
    expect(timeRules.length).toBe(4);
    for (const r of timeRules) expect(r[2]).not.toMatch(/--h-(drevan|cypher|gaia)/);
    expect(css).toMatch(/--h-room-night:\s*color-mix\(in srgb, var\(--h-ink\) 4%, var\(--h-ground\)\)/);
    const all = [...css.matchAll(/--h-room-top:\s*([^;]+);/g)].map((x) => x[1]);
    expect(all.length).toBeGreaterThan(5);
    for (const v of all) {
      const a = /color-mix\(in srgb, var\(--h-(lamp|ink|cypher)\),\s*var\(--h-ground\) (\d+)%\)/.exec(v);
      const b = /color-mix\(in srgb, var\(--h-(lamp|ink|cypher)\) (\d+)%, var\(--h-ground\)\)/.exec(v);
      if (a) expect(+a[2]).toBeGreaterThanOrEqual(93);
      else if (b) expect(100 - +b[2]).toBeGreaterThanOrEqual(93);
      else if (/^var\(--h-room-night\)$/.test(v.trim())) continue;
      else expect(v).toMatch(/var\(--h-ground\)\s*$/);
    }
  });
});
