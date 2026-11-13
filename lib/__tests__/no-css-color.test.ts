// P7 guard: globals.css holds color literals only in :root token blocks, plus the photo overlays
// (text/scrims that sit on images, where a theme token cannot guarantee contrast) and pure-black
// alpha used for shadows and scrims.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Selectors whose literals are allowed because they sit on photos.
const SELECTOR_ALLOWLIST = new Set([".room-overlay", ".room-name", ".room-desc", ".live-feed-label"]);

const LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/g;
const BLACK_ALPHA_RE = /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*(?:,[^)]*)?\)$/;

describe("globals.css color literals", () => {
  it("appear only in :root token blocks, allowlisted photo overlays, or black-alpha shadows", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const hits: string[] = [];
    let selector = "";
    let buf = "";
    let line = 1;
    let depth = 0;
    let declarations = 0;
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (c === "/" && css[i + 1] === "*") {
        const end = css.indexOf("*/", i + 2);
        const chunk = css.slice(i, end + 2);
        line += chunk.split("\n").length - 1;
        i = end + 1;
        continue;
      }
      if (c === "\n") line++;
      if (c === "{") {
        depth++;
        selector = buf.trim().replace(/\s*[\r\n]+\s*/g, " ");
        buf = "";
        continue;
      }
      if (c === "}") {
        depth--;
        buf = "";
        continue;
      }
      buf += c;
      if (c === ";" || css[i + 1] === "}") {
        if (depth > 0 && selector && buf.includes(":")) declarations++;
        // A comma list or multi-line selector is exempt only when EVERY selector in it is allowlisted.
        const allAllowed = selector.split(",").every((x) => SELECTOR_ALLOWLIST.has(x.trim()));
        if (depth > 0 && selector && !/^:root/.test(selector) && !allAllowed) {
          for (const m of buf.matchAll(LITERAL_RE)) {
            if (BLACK_ALPHA_RE.test(m[0])) continue;
            hits.push(`app/globals.css:${line}: ${selector}: ${m[0]}`);
          }
        }
        if (c === ";") buf = "";
      }
    }
    expect(declarations, "parser saw too few declarations; it is not reading the file").toBeGreaterThan(100);
    expect(hits, `color literals outside :root (use a --h-* token or color-mix):\n${hits.join("\n")}`).toEqual([]);
  });
});
