// P7 Task 1: one token set. The legacy color tokens are gone from :root and nothing references them.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RETIRED = [
  "bg-color", "input-bg", "surface-base", "surface-glass", "surface-glass-hover", "surface-raised", "card-bg",
  "text-main", "fg", "text-muted", "muted", "border-subtle", "border", "border-strong",
  "accent", "accent-glow", "accent-hue", "hue-base", "red", "green", "orange",
  "drevan", "cypher", "gaia", "principal", "ease-spring", "shadow-glow",
  // never defined anywhere; every use silently fell back (retired P7 Task 2)
  "bg", "surface", "surface-2", "surface2", "text", "radius", "warn",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next" || n === "__tests__") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const alt = RETIRED.join("|");
const useRe = new RegExp(String.raw`var[(]--(${alt})(?=[,)])`);
const defRe = new RegExp(String.raw`(^|[^a-zA-Z0-9_-])--(${alt})[ ]*:`);
const files = ["app", "components", "lib"].flatMap((d) => walk(join(process.cwd(), d)));

describe("legacy color tokens are retired", () => {
  it("globals.css :root defines none of them", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const roots = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]).join("\n");
    expect(roots).not.toMatch(defRe);
  });
  it("no CSS/TSX file defines or reads one", () => {
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (useRe.test(line) || defRe.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(hits).toEqual([]);
  });
  it("the per-family button/input/message/meta/empty classes are gone (shared h-btn/h-input/h-msg/h-meta/h-empty)", () => {
    const re = /(^|[^a-zA-Z0-9_-])(h-(seed|spoons|needs|club|shelf)-(btn|input|msg)|h-post-(btn|msg)|manage-msg|search-empty|tp-empty|people-empty)(?![a-zA-Z0-9_-])|className="empty"/;
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(hits).toEqual([]);
  });
  it("the kit tokens added for the cleanup exist", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    for (const t of ["--h-warn", "--h-line-strong", "--h-raised"]) expect(css).toContain(`${t}: #`);
  });
});
