import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TABS, HUBS } from "../shell";
import nextConfig from "../../next.config";

const APP = join(__dirname, "..", "..", "app");

/** Every app/**\/page.tsx as a URL pattern: route groups "(x)" stripped, dynamic segments kept as "[x]". */
function pageUrls(dir = APP, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === "page.tsx") out.push(prefix || "/");
      continue;
    }
    if (name === "api") continue;
    const seg = /^\(.*\)$/.test(name) ? "" : "/" + name;
    out.push(...pageUrls(full, prefix + seg));
  }
  return out;
}

/** Pages with no door of their own: each is reached from another page. One word says how. */
const KNOWN_LINKED: Record<string, string> = {
  "/synthesis": "memory",
  "/letters/[id]": "letters",
  "/library/[id]": "library",
  "/login": "auth",
  "/companions/[id]": "home",
  "/companions/[id]/all": "companion",
  "/companions/[id]/audit": "companion",
  "/companions/[id]/autonomy": "companion",
  "/companions/[id]/basins": "companion (Mind door)",
  "/companions/[id]/blocks": "companion",
  "/companions/[id]/deltas": "companion",
  "/companions/[id]/feelings": "companion",
  "/companions/[id]/garden": "companion (Gaia pill; Home link)",
  "/companions/[id]/growth": "companion",
  "/companions/[id]/journal": "companion",
  "/companions/[id]/letters": "companion",
  "/companions/[id]/loops": "companion",
  "/archive": "together (the cellar door)",
  "/companions/[id]/made": "companion",
  "/companions/[id]/mind": "companion",
  "/companions/[id]/notes": "companion",
  "/companions/[id]/projects": "companion",
  "/companions/[id]/relational": "companion",
  "/companions/[id]/sitting": "companion",
  "/companions/[id]/thinking": "companion",
  "/companions/[id]/thinking/[interestId]": "thinking",
  "/companions/[id]/witness": "companion",
  "/companions/[id]/worldview": "companion",
};

describe("page reachability (spec resolution 8)", () => {
  const doors = new Set<string>([
    ...TABS.map((t) => t.href),
    ...Object.values(HUBS).flatMap((h) => h.map((d) => d.href)),
  ]);

  it("every page file is a tab, a door, known-linked, or a redirect source", async () => {
    const redirects = await nextConfig.redirects!();
    const sources = new Set(redirects.map((r) => r.source));
    const orphans = pageUrls().filter((u) => !doors.has(u) && !(u in KNOWN_LINKED) && !sources.has(u));
    expect(orphans).toEqual([]);
  });

  it("KNOWN_LINKED lists only pages that exist", () => {
    const urls = new Set(pageUrls());
    expect(Object.keys(KNOWN_LINKED).filter((u) => !urls.has(u))).toEqual([]);
  });

  it("every redirect destination resolves to a page file", async () => {
    const urls = pageUrls();
    const matches = (dest: string) =>
      urls.some((u) => new RegExp("^" + u.replace(/\[[^/]+\]/g, "[^/]+") + "$").test(dest));
    const redirects = await nextConfig.redirects!();
    const bad = redirects.map((r) => r.destination).filter((d) => !matches(d));
    expect(bad).toEqual([]);
    expect(existsSync(APP)).toBe(true);
  });
});
