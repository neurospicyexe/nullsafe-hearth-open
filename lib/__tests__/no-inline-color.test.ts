// P7 guard: colors live in globals.css kit tokens. TSX never carries a hex literal, and
// inline style={{}} blocks never set a color property to anything but a kit token.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

// Files that legitimately hold literals (cannot read CSS variables, or are not UI).
const HEX_ALLOWLIST = new Set([
  "app/manifest.ts", // PWA manifest, parsed by the OS
  "app/layout.tsx", // themeColor meta
  "app/library/[id]/highlight.ts", // reader iframe cannot read the page's CSS vars
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next" || n === "__tests__") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const files = ["app", "components"].flatMap((d) => walk(join(ROOT, d)));
const rel = (f: string) => relative(ROOT, f).split(sep).join("/");

// 3/4/6/8-digit hex that is not an HTML entity (&#x27;) or part of a word/URL fragment.
const HEX_RE = /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
const COLOR_KEY_RE = /(?:^|[\s,{])(color|background(?:Color|Image)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|fill|stroke|boxShadow|textShadow)\s*:\s*([^,}]+)/g;

function lineOf(src: string, idx: number): number {
  return src.slice(0, idx).split("\n").length;
}

/** The text of every `style={{ ... }}` object literal, with its starting offset. */
function styleBlocks(src: string): { text: string; at: number }[] {
  const out: { text: string; at: number }[] = [];
  const re = /style=\{\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 2;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    out.push({ text: src.slice(start, i - 2), at: start });
  }
  return out;
}

describe("no inline color in TSX", () => {
  it("scans a real file set", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("has no hex literal outside the allowlist", () => {
    const hits: string[] = [];
    for (const f of files) {
      if (HEX_ALLOWLIST.has(rel(f))) continue;
      readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (HEX_RE.test(line)) hits.push(`${rel(f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(hits, `hex literals (use a --h-* kit token):\n${hits.join("\n")}`).toEqual([]);
  });

  it("style={{}} never sets a color property to anything but a kit token", () => {
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const b of styleBlocks(src)) {
        for (const m of b.text.matchAll(COLOR_KEY_RE)) {
          const value = m[2].trim();
          const literal = HEX_RE.test(value) || /(?:rgba?|hsla?)\(/.test(value);
          if (!literal && /var\(--h-|^["'`]?\s*(?:inherit|transparent|none|currentColor|0)\b/.test(value)) continue;
          hits.push(`${rel(f)}:${lineOf(src, b.at + (m.index ?? 0))}: ${m[1]}: ${value.slice(0, 80)}`);
        }
      }
    }
    expect(hits, `inline color not on a kit token:\n${hits.join("\n")}`).toEqual([]);
  });
});
