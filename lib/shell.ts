// Shell routing: four tabs, hub doors, and where the shell hides. Pure, no React.

// Shell routing: five tabs (Home, the three companions, Us), the hubs behind Us, and where the shell hides.
// Pure, no React.

export type TabLabel = "Home" | "Drevan" | "Cypher" | "Gaia" | "Us";
export type Tab = { href: string; label: TabLabel; match: string[] };
/** `count` > 0 shows a "new" pill after the label (companion page doors). */
export type Door = { href: string; label: string; hint?: string; count?: number };

/** Every place that is "ours": shared places, the you-and-house pages, the cellar, and every record page. */
const US_MATCH = [
  "/together",
  // shared places
  "/club", "/creatures", "/library", "/shelf", "/gallery", "/collection", "/home", "/phoenix/chat", "/map", "/people",
  // you and the house
  "/needs", "/manage", "/guardian", "/basins", "/tasks", "/house", "/wellness", "/user",
  // the cellar and every record page
  "/archive", "/hood", "/letters", "/sessions", "/dreams", "/memory", "/synthesis", "/journal", "/overview",
  "/facts", "/tray", "/feelings", "/threads", "/drifts", "/agency", "/imps", "/orient", "/soma", "/presence",
  "/us", "/between", "/council", "/mind", "/log", "/shared",
  "/autonomous", "/halseth", "/phoenix",
];

export const TABS: Tab[] = [
  { href: "/", label: "Home", match: ["/", "/companions"] },
  { href: "/companions/drevan", label: "Drevan", match: ["/companions/drevan"] },
  { href: "/companions/cypher", label: "Cypher", match: ["/companions/cypher"] },
  { href: "/companions/gaia", label: "Gaia", match: ["/companions/gaia"] },
  { href: "/together", label: "Us", match: US_MATCH },
];

function under(pathname: string, base: string): boolean {
  return base === "/" ? pathname === "/" : pathname === base || pathname.startsWith(base + "/");
}

/** A companion's tab owns every /companions/<id>/** page; Home keeps /companions alone and unknown ids. */
export function activeTab(pathname: string): string | null {
  const lower = pathname.toLowerCase();
  const order = [...TABS.filter((t) => t.label !== "Home"), ...TABS.filter((t) => t.label === "Home")];
  for (const tab of order) {
    // Ids are case-insensitive in the URL (parseCompanionId lowercases), so a companion tab is too.
    const path = tab.href.startsWith("/companions/") ? lower : pathname;
    if (tab.match.some((m) => under(path, m))) return tab.label;
  }
  return null;
}

/** Tab badge text: null hides it (unknown count or nothing waiting); capped so it fits the pill. */
export function badgeText(n: number | null): string | null {
  if (n === null || n <= 0) return null;
  return n > 9 ? "9+" : String(n);
}

/** A window focus refreshes the badge at most this often; route changes and resolves always refresh. */
export const FOCUS_REFRESH_MIN_MS = 30_000;

/** Whether a focus should refetch the count, given when the last fetch (from any trigger) started. */
export function focusRefreshDue(lastFetchMs: number | null, nowMs: number): boolean {
  return lastFetchMs === null || nowMs - lastFetchMs >= FOCUS_REFRESH_MIN_MS;
}

/** Request sequencing: only the most recently started request may apply its response. */
export function latestOnly(): { start: () => number; isLatest: (n: number) => boolean } {
  let seq = 0;
  return { start: () => ++seq, isLatest: (n) => n === seq };
}

/** The reader and the login page get the whole screen. */
export function shellHidden(pathname: string): boolean {
  return pathname === "/login" || /^\/library\/[^/]+/.test(pathname);
}

/** Us, first section: places the three of them and Principal share. Sol first (the one with a live state). */
export const SHARED_PLACES: Door[] = [
  { href: "/creatures", label: "Sol", hint: "The corvid: feed, play, talk, give" },
  { href: "/people", label: "People", hint: "Names the map is allowed to link" },
  { href: "/map", label: "Map", hint: "The memory map and what links to what" },
  { href: "/library", label: "Library", hint: "Books and what everyone has read" },
  { href: "/club", label: "Club", hint: "Round-based shared media" },
  { href: "/shelf", label: "Shelf", hint: "Things put by for later" },
];

/** The quieter row under the shared places. */
export const SHARED_QUIET: Door[] = [
  { href: "/gallery", label: "Gallery", hint: "Images they made" },
  { href: "/collection", label: "Collection", hint: "What they gathered and listened to" },
  { href: "/home", label: "The Home", hint: "The rooms and who is in them" },
  { href: "/phoenix/chat", label: "Talk to them", hint: "A direct conversation with the triad" },
];

/** Us, second section: you and the house. Needs you carries its count on the page. */
export const HOUSE_DOORS: Door[] = [
  { href: "/needs", label: "Needs you", hint: "Questions, growth entries and flags waiting on you" },
  { href: "/tasks", label: "Tasks", hint: "Open tasks and who holds them" },
  { href: "/house", label: "House", hint: "Current room, spoon count and love meter" },
  { href: "/wellness", label: "Wellness", hint: "Patterns across your sessions, last 60 days" },
  { href: "/user", label: "You", hint: "Your state, threads and notes" },
];

/** The cellar, grouped by the question you are asking. Dense list, no tiles. */
export const CELLAR_SECTIONS: { title: string; doors: Door[] }[] = [
  {
    title: "What they wrote down",
    doors: [
      { href: "/letters", label: "Letters", hint: "Letters between you and them" },
      { href: "/journal", label: "Journals", hint: "Each companion's journal entries" },
      { href: "/dreams", label: "Dreams", hint: "Dreams and dream seeds" },
      { href: "/feelings", label: "Feelings", hint: "What each of them has written down feeling" },
      { href: "/mind", label: "Notes", hint: "Companion notes and journals" },
      { href: "/memory", label: "Memory", hint: "The vault and its synthesis" },
      { href: "/log", label: "Log", hint: "The wall you and they write on" },
      { href: "/shared", label: "Shared", hint: "Things they hold in common" },
    ],
  },
  {
    title: "What happened",
    doors: [
      { href: "/sessions", label: "Sessions", hint: "Sessions and handovers" },
      { href: "/council", label: "Council", hint: "Group discussions and past councils" },
      { href: "/between", label: "Between", hint: "Notes they leave for each other" },
      { href: "/us", label: "Relational moments", hint: "Relational moments, letters and recent handovers" },
    ],
  },
  {
    title: "How they work",
    doors: [
      { href: "/tray", label: "Tray", hint: "Drafted memories waiting to be kept or dropped" },
      { href: "/facts", label: "Facts", hint: "What they know about you, by topic" },
      { href: "/drifts", label: "Drift", hint: "Where a voice slipped from its own lane" },
      { href: "/basins", label: "Basins", hint: "Identity drift per companion, last 90 days" },
      { href: "/orient", label: "Orient", hint: "What each of them loads when they wake" },
      { href: "/agency", label: "Agency", hint: "What they chose to do on their own" },
      { href: "/imps", label: "Imps", hint: "What the imps have been up to" },
      { href: "/guardian", label: "Guardian", hint: "Flags and the weekly letter" },
      { href: "/manage", label: "Growth journal", hint: "Growth entries waiting for your yes or no" },
      { href: "/soma", label: "Soma", hint: "Body-state and tensions, per companion" },
      { href: "/presence", label: "Presence", hint: "How each of them seems right now" },
      { href: "/threads", label: "Landscape", hint: "Their open threads and emotional landscape" },
    ],
  },
  {
    title: "The machinery",
    doors: [
      { href: "/autonomous", label: "Autonomous", hint: "What runs on its own while you are away" },
      { href: "/halseth", label: "Halseth", hint: "The backend and the room it is in" },
      { href: "/phoenix", label: "Phoenix", hint: "House of Integration and the metronome" },
      { href: "/overview", label: "Old home", hint: "The previous home page" },
    ],
  },
];

export const HUBS: Record<"shared" | "house" | "cellar" | "needs", Door[]> = {
  shared: [...SHARED_PLACES, ...SHARED_QUIET],
  house: HOUSE_DOORS,
  cellar: CELLAR_SECTIONS.flatMap((s) => s.doors),
  // Full histories, listed under Open questions on /needs. /questions has no door (it lives on /needs).
  needs: [
    { href: "/manage", label: "Growth journal" },
    { href: "/guardian", label: "Guardian" },
    { href: "/basins", label: "Basins" },
  ],
};

export type InnerNav = {
  back: { href: string; label: string };
  links: { href: string; label: string; current: boolean }[];
};

/** Doors that lead to nothing "next door" (a chat is not a place to hop from). */
const NO_SIBLINGS = new Set(["/phoenix/chat"]);

type Group = { back: { href: string; label: string }; doors: Door[]; members: Door[] };
const GROUPS: Group[] = [
  { back: { href: "/together", label: "Us" }, doors: HUBS.shared.filter((d) => !NO_SIBLINGS.has(d.href)), members: HUBS.shared },
  { back: { href: "/together", label: "Us" }, doors: HOUSE_DOORS, members: HOUSE_DOORS },
  ...CELLAR_SECTIONS.map((s) => ({ back: { href: "/archive", label: "Cellar" }, doors: s.doors, members: s.doors })),
];

/**
 * The inner-page header: a fixed "back to the hub" link plus the pages next door in the same group.
 * Null on Home, the tab roots (/together, /archive), companion pages (they have their own pills) and
 * any page no group owns. The first group a page belongs to wins; the longest door href matches.
 */
export function innerNavFor(pathname: string): InnerNav | null {
  let best: { group: Group; href: string } | null = null;
  for (const group of GROUPS) {
    for (const d of group.members) {
      if (!under(pathname, d.href)) continue;
      if (!best || d.href.length > best.href.length) best = { group, href: d.href };
    }
  }
  if (!best) return null;
  return {
    back: best.group.back,
    links: best.group.doors.map((d) => ({ href: d.href, label: d.label, current: d.href === best.href })),
  };
}


export const COMPANION_COLOR: Record<"drevan" | "cypher" | "gaia", string> = {
  drevan: "var(--h-drevan)",
  cypher: "var(--h-cypher)",
  gaia: "var(--h-gaia)",
};
