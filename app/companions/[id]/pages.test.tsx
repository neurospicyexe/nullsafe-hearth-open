// Page-level id handling for /companions/[id]/**: the route param is lowercased once and anything
// that is not drevan/cypher/gaia is a 404 BEFORE any Halseth call (recon trap 4).
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CompanionRundown, Make, Project, SomaData } from "@/lib/halseth";

// Every lib/halseth export that is a function becomes a mock; the overrides below shape the few
// the new pages read. The default ([]) keeps the old overview's `.filter/.slice` paths alive.
const overrides: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
vi.mock("@/lib/halseth", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(real)) {
    out[k] = typeof v === "function" ? vi.fn((...args: unknown[]) => (overrides[k] ? overrides[k](...args) : Promise.resolve([]))) : v;
  }
  return out;
});
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  usePathname: () => "/companions/cypher",
  // The Letters page renders LetterFormClient, which holds a router for refresh after send.
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
// The look is written by a client effect; here it only matters whether the page mounts it.
vi.mock("./LookedMark", () => ({ default: ({ id }: { id: string }) => <i data-looked={id} /> }));
vi.mock("./garden/GardenLookedMark", () => ({ default: () => <i data-garden-looked="gaia" /> }));

import * as halseth from "@/lib/halseth";
import Overview from "./page";
import AllPage from "./all/page";
import LettersPage from "./letters/page";
import MadePage from "./made/page";
import GardenPage from "./garden/page";
import BasinsPage from "./basins/page";
import ProjectsPage from "./projects/page";
import Layout from "./layout";
import JournalPage from "./journal/page";
import NotesPage from "./notes/page";
import SittingPage from "./sitting/page";
import WitnessPage from "./witness/page";
import GrowthPage from "./growth/page";
import WorldviewPage from "./worldview/page";
import LoopsPage from "./loops/page";
import BlocksPage from "./blocks/page";
import AuditPage from "./audit/page";
import FeelingsPage from "./feelings/page";
import RelationalPage from "./relational/page";
import DeltasPage from "./deltas/page";
import AutonomyPage from "./autonomy/page";

const mocks = () =>
  Object.values(halseth as Record<string, unknown>).filter((v): v is Mock => vi.isMockFunction(v));
const allCalls = () => mocks().flatMap((m) => m.mock.calls);
const params = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });

function rundown(over: Partial<CompanionRundown> = {}): CompanionRundown {
  return {
    companion_id: "cypher",
    last_real_thing: { text: "held the line on the cache", at: "2026-10-30T09:00:00Z" },
    last_looked_at: null,
    since_basis: "week",
    since: { journal: 2, letters: 1, book_notes: 0, sol: 0, autonomy: 0 },
    doors: { journal: 2, letters_unread: 1, growth: 0, feelings: 0, upto: 0, made: 3 },
    trace: { soma_float_1: [], soma_float_2: [], soma_float_3: [] },
    ...over,
  };
}

const soma = {
  drevan: null,
  gaia: null,
  cypher: {
    companion_id: "cypher",
    soma_float_1: 0.5, soma_float_2: 0.25, soma_float_3: null,
    float_1_label: "focus", float_2_label: "warmth", float_3_label: null,
    compound_state: null, current_mood: null, surface_emotion: null, surface_intensity: null,
    undercurrent_emotion: null, undercurrent_intensity: null, heat: null, reach: null, weight: null,
    mood_set_at: null, seen_at: new Date(Date.now() - 3 * 3600_000).toISOString(), updated_at: "",
  },
  fetched_at: "",
} as SomaData;

beforeEach(() => {
  for (const k of Object.keys(overrides)) delete overrides[k];
  for (const m of mocks()) m.mockClear();
});

describe("unknown companion", () => {
  const pages = { Overview, AllPage, LettersPage, MadePage, ProjectsPage, BasinsPage } as const;
  it("Garden 404s for drevan, cypher and blue with no Halseth call", async () => {
    for (const id of ["drevan", "cypher", "spouse"]) await expect(GardenPage(params(id))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(allCalls()).toEqual([]);
  });
  for (const [name, Page] of Object.entries(pages)) {
    it(`${name} 404s on /companions/blue with no Halseth call`, async () => {
      await expect(Page(params("spouse"))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(allCalls()).toEqual([]);
    });
  }
  // "constructor" is not an own key of COMPANION_CONFIG but IS reachable through Object.prototype;
  // the old `COMPANION_CONFIG[rawId.toLowerCase()]` guard let it through to Halseth.
  const oldPages = {
    JournalPage, NotesPage, SittingPage, WitnessPage, GrowthPage, WorldviewPage, LoopsPage, BlocksPage,
    AuditPage, FeelingsPage, RelationalPage, DeltasPage, AutonomyPage, LettersPage, AllPage,
  } as const;
  for (const [name, Page] of Object.entries(oldPages)) {
    it(`${name} 404s on /companions/constructor with no Halseth call`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pages differ only in searchParams
      await expect((Page as (p: any) => Promise<unknown>)(params("constructor"))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(allCalls()).toEqual([]);
    });
  }
  it("journal passes the lowercased id to its fetch", async () => {
    await JournalPage(params("Cypher"));
    expect(halseth.fetchCompanionJournal).toHaveBeenCalledWith("cypher", 200, { substantive: true });
  });
  it("journal lists no letter rows (the pill count excludes them) but keeps dropped letters", async () => {
    const row = (id: string, tags: string | null, review_state = "kept") => ({ id, note_text: `text-${id}`, tags, review_state });
    overrides.fetchCompanionJournal = async () => [
      row("plain", '["reflection"]'),
      row("letter", '["letter_to_principal"]'),
      row("dropped", '["letter"]', "dropped"),
    ];
    const html = renderToStaticMarkup((await JournalPage(params("cypher"))) as React.ReactElement);
    expect(html).toContain("text-plain");
    expect(html).not.toContain("text-letter");
    expect(html).toContain("text-dropped");
  });
  it("/all reads live: no generateStaticParams, like the overview", async () => {
    const mod = (await import("./all/page")) as Record<string, unknown>;
    const overview = (await import("./page")) as Record<string, unknown>;
    expect(mod.generateStaticParams).toBeUndefined();
    expect(overview.generateStaticParams).toBeUndefined();
    expect(mod.dynamic).toBe("force-dynamic");
  });
  it("the layout 404s too, so no sub-route ever renders with a bad id", async () => {
    await expect(Layout({ children: null, ...params("spouse") })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("mixed-case id is lowercased before every fetch", () => {
  const noRawId = () => {
    for (const args of allCalls()) expect(args).not.toContain("Cypher");
  };

  it("overview", async () => {
    overrides.fetchCompanionRundown = async () => null;
    overrides.fetchSomaStates = async () => null;
    await Overview(params("Cypher"));
    expect(halseth.fetchCompanionRundown).toHaveBeenCalledWith("cypher");
    noRawId();
  });

  it("/all (the old overview, 21 fetches)", async () => {
    await AllPage(params("Cypher"));
    expect(halseth.fetchCompanionJournal).toHaveBeenCalledWith("cypher", 6, { substantive: true });
    expect(halseth.fetchMindState).toHaveBeenCalledWith("cypher");
    expect(halseth.fetchCypherAudit).toHaveBeenCalled();
    expect(allCalls().length).toBeGreaterThanOrEqual(19);
    noRawId();
  });

  it("letters", async () => {
    overrides.fetchInbox = async () => ({ items: [], unread_count: 0 });
    await LettersPage(params("Cypher"));
    expect(halseth.fetchInbox).toHaveBeenCalledWith(100, "cypher");
    noRawId();
  });

  it("made", async () => {
    await MadePage(params("Cypher"));
    expect(halseth.fetchCompanionMakes).toHaveBeenCalledWith("cypher", 40);
    noRawId();
  });

  it("projects", async () => {
    overrides.fetchProjects = async () => [];
    await ProjectsPage(params("Cypher"));
    expect(halseth.fetchProjects).toHaveBeenCalledWith("cypher");
    noRawId();
  });
});

describe("overview", () => {
  it("renders name, seen age, rundown, bars, doors with counts, Everything else, and records the look", async () => {
    overrides.fetchCompanionRundown = async () => rundown();
    overrides.fetchSomaStates = async () => soma;
    const html = renderToStaticMarkup(await Overview(params("cypher")));
    expect(html).toContain("--c:var(--h-cypher)");
    expect(html).toContain("Cypher");
    expect(html).toContain("seen 3h");
    expect(html).toContain("held the line on the cache");
    expect(html).toContain("This week");
    expect(html).toContain("2 journal entries");
    expect(html).toContain('aria-label="Cypher focus"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain('<span class="sr-only"> 3 new</span>');
    expect(html).toContain('href="/companions/cypher/all"');
    expect(html).toContain('data-looked="cypher"');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("header shows a ring and the same status wording as Who's home (fresh, then stale)", async () => {
    const mk = (at: string) =>
      ({ cypher: { current_mood: "steady", mood_set_at: at, seen_at: at } }) as unknown as SomaData;
    overrides.fetchCompanionRundown = async () => rundown();
    overrides.fetchSomaStates = async () => mk(new Date().toISOString().slice(0, 19).replace("T", " "));
    let html = renderToStaticMarkup(await Overview(params("cypher")));
    expect(html).toContain("h-ring h-ring-lg is-fresh");
    expect(html).toContain('<span class="h-companion-status">steady</span>');
    overrides.fetchSomaStates = async () => mk("2020-01-01 00:00:00");
    html = renderToStaticMarkup(await Overview(params("cypher")));
    expect(html).toContain("is-stale");
    expect(html).toMatch(/h-companion-status">last said: steady, \d+d</);
  });

  it("Halseth down: says so, keeps the doors without counts, does not record a look", async () => {
    overrides.fetchCompanionRundown = async () => null;
    overrides.fetchSomaStates = async () => null;
    const html = renderToStaticMarkup(await Overview(params("cypher")));
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).toContain('href="/companions/cypher/journal"');
    expect(html).not.toContain("h-door-count");
    expect(html).not.toContain("data-looked");
  });
});

describe("made", () => {
  it("Halseth down reads Can't reach Halseth right now., not Nothing made yet.", async () => {
    overrides.fetchCompanionMakes = async () => null;
    const html = renderToStaticMarkup(await MadePage(params("gaia")));
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("Nothing made yet.");
  });

  it("empty reads Nothing made yet.", async () => {
    const html = renderToStaticMarkup(await MadePage(params("gaia")));
    expect(html).toContain("Nothing made yet.");
  });

  it("shows an old image through the inline proxy with a Download link", async () => {
    const make: Make = {
      id: "img_" + "a".repeat(32), kind: "image", title: "a moss lantern", why: null, interest_name: null,
      status: "ready", heard_back: null, version: 1, parent_id: null, created_at: "2026-10-29T10:00:00Z",
      files: { file: { mime: "image/png" } },
    };
    overrides.fetchCompanionMakes = async () => [make];
    const html = renderToStaticMarkup(await MadePage(params("gaia")));
    expect(html).toContain(`src="/api/makes/img_${"a".repeat(32)}/file?inline=1"`);
    expect(html).toContain('alt="a moss lantern"');
    expect(html).toContain(`href="/api/makes/img_${"a".repeat(32)}/file" download=""`);
  });
});

describe("projects", () => {
  const p = (id: string, status: Project["status"], over: Partial<Project> = {}): Project => ({
    id, companion_id: "drevan", title: `T-${id}`, intention: `I-${id}`, status,
    horizon_note: null, resolution_note: null, created_at: "2026-10-01T00:00:00Z", last_worked_at: null, closed_at: null,
    ...over,
  });

  it("null reads Can't reach Halseth right now.", async () => {
    overrides.fetchProjects = async () => null;
    const html = renderToStaticMarkup(await ProjectsPage(params("drevan")));
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
  });

  it("says the list is capped only when Halseth returned its cap", async () => {
    overrides.fetchProjects = async () => Array.from({ length: 20 }, (_, i) => p(`p${i}`, "open"));
    expect(renderToStaticMarkup(await ProjectsPage(params("drevan")))).toContain("Showing the first 20.");
    overrides.fetchProjects = async () => Array.from({ length: 19 }, (_, i) => p(`p${i}`, "open"));
    expect(renderToStaticMarkup(await ProjectsPage(params("drevan")))).not.toContain("Showing the first");
  });

  it("empty reads No projects yet.", async () => {
    overrides.fetchProjects = async () => [];
    const html = renderToStaticMarkup(await ProjectsPage(params("drevan")));
    expect(html).toContain("No projects yet.");
  });

  it("groups and shows title, intention, note", async () => {
    overrides.fetchProjects = async () => [
      p("a", "open", { horizon_note: "by winter" }),
      p("b", "released", { resolution_note: "let it go" }),
    ];
    const html = renderToStaticMarkup(await ProjectsPage(params("drevan")));
    expect(html.indexOf("Open")).toBeLessThan(html.indexOf("Done and released"));
    for (const s of ["T-a", "I-a", "by winter", "T-b", "let it go"]) expect(html).toContain(s);
    expect(html).not.toContain("Paused");
  });
});

describe("letters door", () => {
  const letter = (id: string, read: boolean, created_at: string, text: string) => ({
    id, kind: "letter" as const, agent: "cypher", created_at, preview: text, text, read,
  });

  it("incoming letters come from the inbox for this companion, link to the letter page, unread marked", async () => {
    overrides.fetchInbox = async () => ({
      items: [
        letter("j_new", false, "2026-10-29T10:00:00Z", "a drift letter"),
        letter("j_old", true, "2026-10-20 10:00:00", "an old letter"),
        { ...letter("j_steward", false, "2026-10-28T10:00:00Z", "a steward briefing"), agent: "steward" },
      ],
      unread_count: 1,
    });
    overrides.fetchLettersOut = async () => [
      { id: "n1", note_type: "letter:cypher", content: "from Principal", created_at: "2026-10-25T10:00:00Z" },
    ];
    const html = renderToStaticMarkup(await LettersPage(params("cypher")));
    expect(halseth.fetchInbox).toHaveBeenCalledWith(100, "cypher");
    expect(halseth.fetchCompanionNotesByAgent).not.toHaveBeenCalled();
    expect(html).toContain('href="/letters/j_new"');
    expect(html).toContain('href="/letters/j_old"');
    expect(html).toContain("a drift letter");
    expect(html).not.toContain("a steward briefing");
    expect(html).toContain("from Principal");
    // Unread is marked; read is not.
    const bubble = (id: string) => {
      const at = html.indexOf(`href="/letters/${id}"`);
      return html.slice(html.lastIndexOf("<a", at), html.indexOf("</a>", at));
    };
    const newBubble = bubble("j_new");
    const oldBubble = bubble("j_old");
    expect(newBubble).toContain("is-unread");
    expect(newBubble).toContain(">new</span>");
    expect(newBubble).not.toContain("<span>read</span>");
    expect(oldBubble).not.toContain("is-unread");
    expect(oldBubble).toContain("<span>read</span>");
    expect(oldBubble).not.toContain(">new</span>");
    // Oldest first: old incoming, Principal's, then the new one.
    expect(html.indexOf("an old letter")).toBeLessThan(html.indexOf("from Principal"));
    expect(html.indexOf("from Principal")).toBeLessThan(html.indexOf("a drift letter"));
    expect(html).toContain("3 letters");
  });

  it("Halseth down: says so instead of an empty thread", async () => {
    overrides.fetchInbox = async () => null;
    const html = renderToStaticMarkup(await LettersPage(params("cypher")));
    expect(html).toContain("Couldn&#x27;t load the letters left for you.");
    expect(html).not.toContain("No letters yet");
  });
});

describe("garden", () => {
  const render = async (id = "gaia") => renderToStaticMarkup(await GardenPage(params(id)));
  it("degraded: Halseth unreachable reads a short line, no crash", async () => {
    overrides.fetchGaiaGarden = async () => null;
    const h = await render();
    expect(h).toContain("Can&#x27;t reach the garden right now.");
    expect(h).not.toContain("data-garden-looked"); // an outage is not Principal standing on it
  });
  it("a loaded garden records the visit (being seen, light tier)", async () => {
    overrides.fetchGaiaGarden = async () => ({ planted: [], witness: null, resting: 0, awaiting: 0 });
    expect(await render()).toContain('data-garden-looked="gaia"');
  });
  it("empty reads Nothing planted yet., no resting or waiting lines", async () => {
    overrides.fetchGaiaGarden = async () => ({ planted: [], witness: null, resting: 0, awaiting: 0 });
    const h = await render("Gaia");
    expect(h).toContain("Nothing planted yet.");
    expect(h).not.toContain("resting");
    expect(h).not.toContain("waiting");
  });
  it("populated: plantings, witness days, escaped text, counts", async () => {
    overrides.fetchGaiaGarden = async () => ({
      planted: [{ id: "p1", kind: "letter", planted_at: "2026-11-04T15:00:00Z", written_at: "2026-11-02T15:00:00Z",
        text: "stay.\n<b>x</b>", to: "principal", interest_name: null }],
      witness: { planted_at: "2026-11-01T00:00:00Z", days: [
        { day: "2026-11-03", entries: [{ id: "w1", at: "2026-11-03T21:42:00Z", type: "kept", text: "held the line" }] },
      ] },
      resting: 2, awaiting: 1,
    });
    const h = await render();
    expect(h).toContain("to you");
    expect(h).toContain("written Nov 2");
    expect(h).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(h).not.toContain("<b>x</b>");
    expect(h).toContain("held the line");
    expect(h).toContain("3:42 PM");
    expect(h).toContain("2 resting in the ground.");
    expect(h).toContain("1 waiting on a sibling&#x27;s yes.");
    expect(h).not.toContain("Nothing planted yet.");
  });
});

describe("basins", () => {
  const render = async (id = "gaia") => renderToStaticMarkup(await BasinsPage(params(id)));
  const row = (o: Record<string, unknown>) => ({ id: "x", name: "the-line", status: "live", created_at: "2026-03-28 00:00:00", cause_kind: null, cause_ref: null,
    revised_by: null, witnessed_by: null, witnessed_at: null, supersedes: null, superseded_by: null, superseded_at: null, revision_note: null, ...o });
  it("degraded: Halseth unreadable reads a short line", async () => {
    overrides.fetchBasins = async () => null;
    expect(await render()).toContain("reach Gaia&#x27;s basins right now");
  });
  it("a pending revision shows old vs new, the cause, and Witness / Decline; escaped text", async () => {
    overrides.fetchBasins = async () => ({
      companion_id: "gaia", waiting: 1, pace_days: 30, window_opens: null,
      live: [row({ id: "old1", description: "old words <b>x</b>" })],
      history: [row({ id: "new1", status: "awaiting_witness", supersedes: "old1", cause_kind: "refusal", cause_ref: "abcdef0123", description: "new words", created_at: "2026-11-05 10:00:00" })],
    });
    const h = await render();
    expect(h).toContain("old words &lt;b&gt;x&lt;/b&gt;");
    expect(h).toContain("new words");
    expect(h).toContain("from a refusal (abcdef01)");
    expect(h).toContain("Witness");
    expect(h).toContain("Decline");
    expect(h).toContain("One revision at most every 30 days.");
  });
  it("a superseded history row has no buttons", async () => {
    overrides.fetchBasins = async () => ({
      companion_id: "cypher", waiting: 0, pace_days: 14, window_opens: null,
      live: [row({ id: "n", description: "now" })],
      history: [row({ id: "o", status: "superseded", description: "before", superseded_at: "2026-11-04T00:00:00Z" })],
    });
    const h = await render("cypher");
    expect(h).toContain("before");
    expect(h).not.toContain("Decline");
  });
});
