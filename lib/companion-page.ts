// Companion page model (/companions/<id>). Pure: no React, no fetching.
import type { CompanionId, CompanionRundown, CompanionSomaState, FloatKey, Project } from "./halseth";
import type { Door } from "./shell";
import { ageLabel } from "./home-model";

export const COMPANION_IDS = ["drevan", "cypher", "gaia"] as const;

// Compile-time guard: COMPANION_IDS and lib/halseth's CompanionId must be the same set, both ways.
type SameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type AssertTrue<T extends true> = T;
export type CompanionIdsMatch = AssertTrue<SameSet<(typeof COMPANION_IDS)[number], CompanionId>>;

export const COMPANION_NAME: Record<CompanionId, string> = {
  drevan: "Drevan",
  cypher: "Cypher",
  gaia: "Gaia",
};

/** Lowercases once; null for anything that is not one of the three (never a prototype key). */
export function parseCompanionId(raw: string): CompanionId | null {
  const id = raw.toLowerCase();
  return (COMPANION_IDS as readonly string[]).includes(id) ? (id as CompanionId) : null;
}

export type DoorKey = "journal" | "letters" | "growth" | "feelings" | "upto" | "made" | "thinking";
export interface DoorGroup {
  key: DoorKey | "all";
  label: string;
  routes: { slug: string; label: string }[];
}

/** Every old sub-route lives in exactly one group; the first route is the group's door. */
export function doorGroups(id: CompanionId): DoorGroup[] {
  const journal = [
    { slug: "journal", label: "Journal" },
    { slug: "notes", label: "Notes" },
    { slug: "sitting", label: "Sitting with" },
  ];
  if (id === "gaia") journal.push({ slug: "witness", label: "Witness" });

  const growth = [
    { slug: "growth", label: "Growth" },
    { slug: "worldview", label: "Worldview" },
    { slug: "loops", label: "Open loops" },
    { slug: "blocks", label: "Blocks" },
  ];
  if (id === "cypher") growth.push({ slug: "audit", label: "Audit" });

  return [
    { key: "journal", label: "Journal", routes: journal },
    { key: "letters", label: "Letters", routes: [{ slug: "letters", label: "Letters" }] },
    { key: "growth", label: "Growth", routes: growth },
    {
      key: "feelings",
      label: "Feelings",
      routes: [
        { slug: "feelings", label: "Feelings" },
        { slug: "relational", label: "Relational" },
        { slug: "deltas", label: "Deltas" },
      ],
    },
    {
      key: "upto",
      label: "What I've been up to",
      routes: [
        { slug: "autonomy", label: "Autonomous runs" },
        { slug: "projects", label: "Projects" },
      ],
    },
    { key: "thinking", label: "Thinking", routes: [{ slug: "thinking", label: "Thinking" }] },
    { key: "made", label: "Made", routes: [{ slug: "made", label: "Made" }] },
    { key: "all", label: "Everything else", routes: [{ slug: "all", label: "Everything else" }] },
  ];
}

const DOOR_COUNT: Partial<Record<DoorKey, keyof CompanionRundown["doors"]>> = {
  journal: "journal",
  letters: "letters_unread",
  growth: "growth",
  feelings: "feelings",
  upto: "upto",
  made: "made",
};

/** The six doors on the overview (not "Everything else"), with counts when the rundown loaded. */
export function companionDoors(id: CompanionId, r: CompanionRundown | null): Door[] {
  const doors: Door[] = [];
  for (const g of doorGroups(id)) {
    if (g.key === "all") continue;
    const door: Door = { href: `/companions/${id}/${g.routes[0].slug}`, label: g.label };
    const countKey = DOOR_COUNT[g.key];
    if (r && countKey) door.count = r.doors[countKey];
    doors.push(door);
  }
  return doors;
}

/** The group a sub-route belongs to; null for the overview ("") or a slug this companion lacks. */
export function groupForSlug(id: CompanionId, slug: string): DoorGroup | null {
  if (!slug) return null;
  return doorGroups(id).find((g) => g.routes.some((r) => r.slug === slug)) ?? null;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Since you last looked (2h)" or "This week" on a first visit, then one line per non-zero count. */
export function rundownLines(r: CompanionRundown, now: number): { heading: string; lines: string[] } {
  let heading = "This week";
  if (r.since_basis !== "week") {
    const age = ageLabel(r.last_looked_at, new Date(now));
    heading = age ? `Since you last looked (${age})` : "Since you last looked";
  }
  const s = r.since;
  const lines: string[] = [];
  if (s.journal > 0) lines.push(plural(s.journal, "journal entry", "journal entries"));
  if (s.letters > 0) lines.push(plural(s.letters, "letter", "letters"));
  if (s.book_notes > 0) lines.push(plural(s.book_notes, "book note", "book notes"));
  if (s.sol > 0) lines.push(plural(s.sol, "Sol visit", "Sol visits"));
  if (s.autonomy > 0) lines.push(plural(s.autonomy, "autonomous run", "autonomous runs"));
  if (lines.length === 0) lines.push("Nothing new.");
  return { heading, lines };
}

/** A trace is drawable only with all 7 days present. */
export function traceValid(t: (number | null)[]): t is number[] {
  return t.length === 7 && t.every((v) => typeof v === "number" && Number.isFinite(v));
}

export type CompanionBar = { label: string; pct: number; trace?: number[] };

const FLOATS = [
  ["soma_float_1", "float_1_label", "float 1"],
  ["soma_float_2", "float_2_label", "float 2"],
  ["soma_float_3", "float_3_label", "float 3"],
] as const satisfies readonly (readonly [FloatKey, string, string])[];

/**
 * The companion's three meters, mapped as Home's buildWhoIsHome does (null float dropped, label
 * fallback "float N"), each carrying its own float key's 7-day trace when all 7 points exist.
 * Keyed by float, never by position: a dropped float_2 must not hand float_3 float_2's trace.
 */
export function companionBars(soma: CompanionSomaState, r: CompanionRundown | null): CompanionBar[] {
  if (!soma) return [];
  const bars: CompanionBar[] = [];
  for (const [key, labelKey, fallback] of FLOATS) {
    const v = soma[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const bar: CompanionBar = { label: soma[labelKey] ?? fallback, pct: Math.round(Math.min(1, Math.max(0, v)) * 100) };
    const t = r?.trace?.[key];
    if (t && traceValid(t)) bar.trace = t;
    bars.push(bar);
  }
  return bars;
}

export interface SubnavModel {
  back: { href: string; label: string };
  links: { href: string; label: string; current: boolean }[];
}

/**
 * The slim nav over a sub-route: back to the overview plus the sibling routes of the current
 * door group. Null on the overview itself. `/all`, single-route groups and unknown slugs get the
 * back link only. Hrefs use the parsed (lowercase) id whatever case the URL carried.
 */
export function subnavFor(id: CompanionId, pathname: string): SubnavModel | null {
  const slug = (pathname.split("/").filter(Boolean)[2] ?? "").toLowerCase();
  if (!slug) return null;
  const base = `/companions/${id}`;
  const back = { href: base, label: COMPANION_NAME[id] };
  const group = slug === "all" ? null : groupForSlug(id, slug);
  if (!group || group.routes.length < 2) return { back, links: [] };
  return {
    back,
    links: group.routes.map((r) => ({ href: `${base}/${r.slug}`, label: r.label, current: r.slug === slug })),
  };
}

export interface CompanionPill {
  href: string;
  label: string;
  current: boolean;
}

/** The slugs that belong to Mind: every route in a journal, growth, feelings or upto group, plus /all. */
const MIND_SLUGS = new Set(["mind", "all"]);
const PILL_OF_SLUG: Record<string, string> = { letters: "Letters", made: "Made", thinking: "Thinking", garden: "Garden" };

/**
 * The companion tab's pill row: Now . Mind . Letters . Made . Thinking. Exactly one is current for a
 * known route (Now on the overview; Mind for mind, every journal/growth/feelings/upto route, and /all).
 * Ids are lowercased by the caller (parseCompanionId); the slug is lowercased here.
 */
export function companionPills(id: CompanionId, pathname: string): CompanionPill[] {
  const slug = (pathname.split("/").filter(Boolean)[2] ?? "").toLowerCase();
  const base = `/companions/${id}`;
  let active: string | null = null;
  if (!slug) active = "Now";
  else if (PILL_OF_SLUG[slug]) active = PILL_OF_SLUG[slug];
  else if (MIND_SLUGS.has(slug) || groupForSlug(id, slug)) active = "Mind";
  const pill = (label: string, slug: string): CompanionPill => ({
    href: slug ? `${base}/${slug}` : base,
    label,
    current: active === label,
  });
  const pills = [pill("Now", ""), pill("Mind", "mind"), pill("Letters", "letters"), pill("Made", "made")];
  // The garden is Gaia's alone; her tab carries it beside the shelf, never for the other two.
  if (id === "gaia") pills.push(pill("Garden", "garden"));
  pills.push(pill("Thinking", "thinking"));
  return pills;
}

/** The doors on the Mind page: journal, sitting with, feelings, growth, what they've been up to, soma, everything else. */
export function mindDoors(id: CompanionId, r: CompanionRundown | null): Door[] {
  const base = `/companions/${id}`;
  const count = (key: keyof CompanionRundown["doors"]) => (r ? { count: r.doors[key] } : {});
  const groups = doorGroups(id);
  const first = (key: DoorKey) => `${base}/${groups.find((g) => g.key === key)!.routes[0].slug}`;
  return [
    { href: first("journal"), label: "Journal", ...count("journal") },
    { href: `${base}/sitting`, label: "Sitting with" },
    { href: first("feelings"), label: "Feelings", ...count("feelings") },
    { href: first("growth"), label: "Growth", ...count("growth") },
    { href: `${base}/basins`, label: "Basins", hint: "Where each basin sits, and how it has moved" },
    { href: first("upto"), label: "What I've been up to", ...count("upto") },
    { href: "/soma", label: "Soma", hint: "Body-state and tensions, all three of them" },
    { href: `${base}/all`, label: "Everything else" },
  ];
}

/** "<Name>'s records: drift, orient, facts": the cellar pages for this companion. Those pages list all three, so the links are unscoped. */
export function recordsRow(id: CompanionId): { label: string; links: { href: string; label: string }[] } {
  return {
    label: `${COMPANION_NAME[id]}'s records`,
    links: [
      { href: "/drifts", label: "drift" },
      { href: "/orient", label: "orient" },
      { href: "/facts", label: "facts" },
    ],
  };
}

/** Generated-image prompt as /gallery shows it: the stored "prompt: " prefix dropped. */
export function imagePrompt(argsSummary: string): string {
  return argsSummary.replace(/^prompt:\s*/i, "").trim() || "(untitled)";
}

/** Halseth's GET /mind/projects/:id row cap (readProjects default limit; the route passes none). */
export const PROJECTS_CAP = 20;

const PROJECT_GROUPS: { heading: string; statuses: Project["status"][] }[] = [
  { heading: "Open", statuses: ["open"] },
  { heading: "Paused", statuses: ["paused"] },
  { heading: "Done and released", statuses: ["done", "released"] },
];

/** Projects under Open, Paused, Done and released (Halseth's row order kept); empty groups left out. */
export function groupProjects(projects: Project[]): { heading: string; projects: Project[] }[] {
  return PROJECT_GROUPS.map((g) => ({ heading: g.heading, projects: projects.filter((p) => g.statuses.includes(p.status)) })).filter(
    (g) => g.projects.length > 0,
  );
}
