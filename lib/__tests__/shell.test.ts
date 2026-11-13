import { describe, it, expect } from "vitest";
import { TABS, HUBS, CELLAR_SECTIONS, SHARED_PLACES, SHARED_QUIET, HOUSE_DOORS, activeTab, innerNavFor, shellHidden, badgeText, COMPANION_COLOR, focusRefreshDue, FOCUS_REFRESH_MIN_MS, latestOnly } from "../shell";
import nextConfig from "../../next.config";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PAGE_INDEX } from "../page-index";

/** Frozen copy of every href the retired sidebar Nav carried; each must stay reachable from the new tabs and hubs. */
const NAV_HREFS: readonly string[] = Object.freeze([
  "/",
  "/halseth",
  "/today",
  "/checkin",
  "/soma",
  "/wellness",
  "/us",
  "/log",
  "/between",
  "/phoenix/chat",
  "/presence",
  "/orient",
  "/feelings",
  "/questions",
  "/home",
  "/autonomous",
  "/agency",
  "/drifts",
  "/basins",
  "/guardian",
  "/council",
  "/map",
  "/people",
  "/club",
  "/shelf",
  "/library",
  "/gallery",
  "/creatures",
  "/collection",
  "/imps",
  "/handovers",
  "/sessions",
  "/dreams",
  "/memory",
  "/synthesis",
  "/facts",
  "/tray",
  "/manage",
  "/shared",
  "/tasks",
  "/house",
  "/phoenix",
]);

describe("tabs", () => {
  it("are Home, the three companions, Us, in that order", () => {
    expect(TABS.map((t) => [t.label, t.href])).toEqual([
      ["Home", "/"],
      ["Drevan", "/companions/drevan"],
      ["Cypher", "/companions/cypher"],
      ["Gaia", "/companions/gaia"],
      ["Us", "/together"],
    ]);
  });
});

describe("activeTab", () => {
  it("maps /companions/<id>/** to that companion", () => {
    expect(activeTab("/companions/cypher")).toBe("Cypher");
    expect(activeTab("/companions/drevan/made")).toBe("Drevan");
    expect(activeTab("/companions/gaia/thinking/abc")).toBe("Gaia");
    expect(activeTab("/companions/GAIA/letters")).toBe("Gaia");
  });
  it("keeps /companions alone and Home on Home", () => {
    expect(activeTab("/")).toBe("Home");
    expect(activeTab("/companions")).toBe("Home");
  });
  it("lights Us for shared places, the house pages, the cellar and every record page", () => {
    for (const p of ["/together", "/club", "/club/round-1", "/creatures", "/phoenix/chat", "/needs", "/tasks", "/user", "/archive", "/hood", "/sessions", "/facts", "/letters/abc", "/overview"]) {
      expect(activeTab(p), p).toBe("Us");
    }
  });
  it("returns null for routes owned by no tab", () => {
    expect(activeTab("/login")).toBeNull();
  });
  it("matches on a segment boundary", () => {
    expect(activeTab("/clubhouse")).toBeNull();
    expect(activeTab("/companionsfoo")).toBeNull();
  });
  it("every door in every group lights a tab", () => {
    for (const d of Object.values(HUBS).flat()) expect(activeTab(d.href), d.href).not.toBeNull();
  });
});

describe("shellHidden", () => {
  it("hides only on the reader and login", () => {
    expect(shellHidden("/library/abc")).toBe(true);
    expect(shellHidden("/library")).toBe(false);
    expect(shellHidden("/login")).toBe(true);
    expect(shellHidden("/")).toBe(false);
  });
});

describe("needs hub", () => {
  it("keeps the full-history doors and drops /questions", () => {
    expect(HUBS.needs).toEqual([
      { href: "/manage", label: "Growth journal" },
      { href: "/guardian", label: "Guardian" },
      { href: "/basins", label: "Basins" },
    ]);
  });
});

describe("reachability", () => {
  it("every old nav href is reachable", () => {
    const reachable = new Set<string>([
      ...TABS.map((t) => t.href),
      ...Object.values(HUBS).flatMap((h) => h.map((d) => d.href)),
    ]);
    // /questions is absorbed into /needs (open questions + "Recently answered" live there).
    // /handovers is absorbed into /sessions (redirect below).
    const absorbed = new Set(["/today", "/checkin", "/questions", "/handovers"]);
    // /synthesis is linked from the Memory page, not a door; app/memory/page.test.tsx pins that link.
    const linkedFromPages = new Set(["/synthesis"]);
    const missing = NAV_HREFS.filter((h) => !absorbed.has(h) && !linkedFromPages.has(h) && !reachable.has(h));
    expect(missing).toEqual([]);
  });
  it("companion colors are css vars", () => {
    expect(COMPANION_COLOR.drevan).toBe("var(--h-drevan)");
  });
});

describe("redirects", () => {
  it("forwards /today and /checkin home, temporarily", async () => {
    const redirects = await nextConfig.redirects!();
    for (const source of ["/today", "/checkin"]) {
      const r = redirects.find((x) => x.source === source);
      expect(r, source).toBeDefined();
      expect(r!.destination).toBe("/");
      expect((r as { permanent?: boolean }).permanent).toBe(false);
    }
  });

  it("forwards /questions to /needs, temporarily", async () => {
    const redirects = await nextConfig.redirects!();
    const r = redirects.find((x) => x.source === "/questions");
    expect(r).toBeDefined();
    expect(r!.destination).toBe("/needs");
    expect((r as { permanent?: boolean }).permanent).toBe(false);
  });
});

describe("retired page redirects", () => {
  it.each([
    ["/deltas", "/feelings"],
    ["/phoenix/dreams", "/dreams"],
    ["/uplink", "/"],
  ])("forwards %s to %s, temporarily", async (source, destination) => {
    const redirects = await nextConfig.redirects!();
    const r = redirects.find((x) => x.source === source);
    expect(r, source).toBeDefined();
    expect(r!.destination).toBe(destination);
    expect((r as { permanent?: boolean }).permanent).toBe(false);
  });
});

describe("handovers redirect", () => {
  it("forwards /handovers to /sessions, temporarily", async () => {
    const redirects = await nextConfig.redirects!();
    const r = redirects.find((x) => x.source === "/handovers");
    expect(r).toBeDefined();
    expect(r!.destination).toBe("/sessions");
    expect((r as { permanent?: boolean }).permanent).toBe(false);
  });
});

describe("badgeText", () => {
  it("hides when unknown or zero", () => {
    expect(badgeText(null)).toBeNull();
    expect(badgeText(0)).toBeNull();
  });
  it("shows the count, capped at 9+", () => {
    expect(badgeText(3)).toBe("3");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(10)).toBe("9+");
  });
});

describe("focusRefreshDue", () => {
  it("refreshes when nothing has been fetched yet", () => {
    expect(focusRefreshDue(null, 1_000)).toBe(true);
  });
  it("skips a focus within 30 seconds of the last fetch", () => {
    expect(focusRefreshDue(100_000, 100_000 + 29_999)).toBe(false);
  });
  it("refreshes once 30 seconds have passed", () => {
    expect(focusRefreshDue(100_000, 130_000)).toBe(true);
    expect(FOCUS_REFRESH_MIN_MS).toBe(30_000);
  });
});

describe("latestOnly", () => {
  it("only the most recently started request may apply its response", () => {
    const seq = latestOnly();
    const a = seq.start();
    const b = seq.start();
    expect(seq.isLatest(a)).toBe(false);
    expect(seq.isLatest(b)).toBe(true);
    const c = seq.start();
    expect(seq.isLatest(b)).toBe(false);
    expect(seq.isLatest(c)).toBe(true);
  });
});

describe("Us hub", () => {
  it("has the shared places, then the quieter row", () => {
    expect(SHARED_PLACES.map((d) => d.label)).toEqual(["Sol", "People", "Map", "Library", "Club", "Shelf"]);
    expect(SHARED_QUIET.map((d) => d.label)).toEqual(["Gallery", "Collection", "The Home", "Talk to them"]);
  });
  it("has the you-and-house doors", () => {
    expect(HOUSE_DOORS.map((d) => d.href)).toEqual(["/needs", "/tasks", "/house", "/wellness", "/user"]);
  });
});

describe("the cellar", () => {
  it("is grouped by question, in order", () => {
    expect(CELLAR_SECTIONS.map((s) => s.title)).toEqual(["What they wrote down", "What happened", "How they work", "The machinery"]);
  });
  it("calls /us Relational moments, so nothing else is called Us", () => {
    const all = CELLAR_SECTIONS.flatMap((s) => s.doors);
    expect(all.find((d) => d.href === "/us")?.label).toBe("Relational moments");
    expect(all.some((d) => d.label === "Us")).toBe(false);
  });
  it("still links every page the old /archive and /hood linked", () => {
    const old = [
      "/letters", "/journal", "/sessions", "/dreams", "/memory",
      "/facts", "/tray", "/feelings", "/threads", "/drifts", "/agency", "/imps", "/orient", "/soma", "/presence",
      "/us", "/between", "/council", "/mind", "/log", "/shared",
      "/autonomous", "/guardian", "/basins", "/manage", "/tasks", "/map", "/people", "/halseth", "/phoenix",
      "/user", "/house", "/wellness", "/overview",
    ];
    const have = new Set([...HUBS.shared, ...HUBS.house, ...HUBS.cellar].map((d) => d.href));
    expect(old.filter((h) => !have.has(h))).toEqual([]);
  });
  it("care pages sit with Us (you and the house), not in the cellar sections", () => {
    const cellar = HUBS.cellar.map((d) => d.href);
    for (const h of ["/user", "/house", "/wellness"]) expect(cellar).not.toContain(h);
  });
});

describe("no dead links", () => {
  const APP = join(__dirname, "..", "..", "app");
  const hrefs = [...TABS.map((t) => t.href), ...Object.values(HUBS).flat().map((d) => d.href)];
  it("every tab and hub href resolves to a page file", () => {
    const dead = hrefs.filter((h) => !existsSync(join(APP, h === "/" ? "" : h.replace(/^\/companions\/(drevan|cypher|gaia)/, "/companions/[id]"), "page.tsx")));
    expect(dead).toEqual([]);
  });
  it("has no duplicate href inside one group", () => {
    for (const [k, doors] of Object.entries(HUBS)) {
      const h = doors.map((d) => d.href);
      expect(new Set(h).size, k).toBe(h.length);
    }
  });
});

describe("innerNavFor", () => {
  it("shared places get back-to-Us and the places next door", () => {
    const nav = innerNavFor("/creatures");
    expect(nav?.back).toEqual({ href: "/together", label: "Us" });
    expect(nav?.links.map((l) => l.label)).toEqual(["Sol", "People", "Map", "Library", "Club", "Shelf", "Gallery", "Collection", "The Home"]);
    expect(nav?.links.filter((l) => l.current).map((l) => l.label)).toEqual(["Sol"]);
  });
  it("matches sub-paths and marks the right door current", () => {
    expect(innerNavFor("/club/round-1")?.links.find((l) => l.current)?.label).toBe("Club");
  });
  it("the chat has the back link and no next-door row siblings marked current", () => {
    const nav = innerNavFor("/phoenix/chat");
    expect(nav?.back.label).toBe("Us");
    expect(nav?.links.some((l) => l.current)).toBe(false);
  });
  it("house pages stay in their own group", () => {
    expect(innerNavFor("/tasks")?.links.map((l) => l.label)).toEqual(["Needs you", "Tasks", "House", "Wellness", "You"]);
  });
  it("cellar record pages get back-to-Cellar and their section's pages", () => {
    const nav = innerNavFor("/drifts");
    expect(nav?.back).toEqual({ href: "/archive", label: "Cellar" });
    expect(nav?.links.map((l) => l.label)).toContain("Orient");
    expect(nav?.links.map((l) => l.label)).not.toContain("Letters");
  });
  it("/phoenix and /phoenix/chat do not collide (longest href wins)", () => {
    expect(innerNavFor("/phoenix")?.back.label).toBe("Cellar");
    expect(innerNavFor("/phoenix/chat")?.back.label).toBe("Us");
  });
  it("is null on Home, the tab roots, companion pages and login", () => {
    for (const p of ["/", "/together", "/archive", "/hood", "/companions/drevan", "/login"]) expect(innerNavFor(p), p).toBeNull();
  });
});
