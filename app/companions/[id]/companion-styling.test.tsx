import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// P7 task 4: companion pages carry no color literals and no left-border accents. Companion color
// comes from [data-companion] / COMPANION_COLOR; domain colors come from domain-colors.ts as
// `--c: var(--h-*)`. Only data-driven geometry (--w, --x, --s) may sit beside it.

const m = vi.hoisted(() => ({
  fetchGrowthJournalPage: vi.fn(), fetchGrowthPatterns: vi.fn(), fetchGrowthMarkers: vi.fn(),
  fetchGrowthPendingCount: vi.fn(), fetchGrowthJournal: vi.fn(),
  fetchAutonomyRuns: vi.fn(), fetchAutonomySeeds: vi.fn(),
  fetchConclusions: vi.fn(), fetchRelationalHistory: vi.fn(), fetchSittingNotes: vi.fn(),
  fetchSomaFeelings: vi.fn(), fetchLoops: vi.fn(), fetchPersonaBlocks: vi.fn(), fetchHumanBlocks: vi.fn(),
  fetchLettersOut: vi.fn(), fetchInbox: vi.fn(),
}));
vi.mock("@/lib/halseth", () => m);
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound"); },
  redirect: () => { throw new Error("redirect"); },
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
vi.mock("@/components/PinButton", () => ({ default: () => null }));
vi.mock("../client", () => ({ LetterFormClient: () => null }));

import GrowthPage from "./growth/page";
import AutonomyPage from "./autonomy/page";
import WorldviewPage from "./worldview/page";
import RelationalPage from "./relational/page";
import SittingPage from "./sitting/page";
import FeelingsPage from "./feelings/page";
import LoopsPage from "./loops/page";
import BlocksPage from "./blocks/page";
import LettersPage from "./letters/page";
import JournalClient from "./growth/JournalClient";
import { CloseLoopButton } from "./loops/CloseButton";
import { MetabolizeButton } from "./sitting/MetabolizeButton";
import {
  FermentationSection, VoiceLaneSection, SomaFeelingsSection, RelationalStateSection,
  LiveThreadsSection, DriftLogSection, SittingNotesSection, OpenLoopsSection, COMPANION_CONFIG,
} from "./sections";
import * as DC from "./domain-colors";
import { STATE_TYPE_COLOR } from "./domain-colors";

const T = "2026-11-01T00:00:00Z";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function styleAttrs(html: string): string[] {
  return [...html.matchAll(/style="([^"]*)"/g)].map((x) => x[1]);
}
// A style attribute may hold: --c: var(--h-*), plus data geometry custom props (--w/--x/--s).
function expectKitOnly(html: string) {
  expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(html).not.toMatch(/border-left|linear-gradient|rgba?\(/);
  for (const s of styleAttrs(html)) {
    for (const decl of s.split(";").filter(Boolean)) {
      const i = decl.indexOf(":");
      const k = decl.slice(0, i);
      const v = decl.slice(i + 1);
      expect(k).toMatch(/^--(c|w|x|s)$/);
      if (k === "--c") expect(v).toMatch(/^var\(--h-[a-z]+\)$/);
      else expect(v).toMatch(/^[\d.]+(%|px)$/);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchGrowthJournalPage.mockResolvedValue({
    entries: [
      { id: "j1", entry_type: "insight", source: "conversation", content: "an insight", tags_json: "[\"a\"]", created_at: T, review_status: "accepted" },
      { id: "j2", entry_type: "question", source: "reflection", content: "a question", tags_json: "[]", created_at: T, review_status: "declined" },
      { id: "j3", entry_type: "learning", source: "autonomous", content: "pending one", tags_json: "[]", created_at: T },
    ],
    total: 3, hasMore: false,
  });
  m.fetchGrowthPatterns.mockResolvedValue([{ id: "p1", pattern_text: "pat", evidence_json: "[1,2]", strength: 6, created_at: T, updated_at: T }]);
  m.fetchGrowthMarkers.mockResolvedValue([{ id: "k1", marker_type: "shift", description: "moved", related_pattern_id: "p1", created_at: T }]);
  m.fetchGrowthPendingCount.mockResolvedValue({ per_companion: [{ companion_id: "gaia", pending: 2 }] });
  m.fetchAutonomyRuns.mockResolvedValue([
    { id: "r1", run_type: "exploration", status: "running", started_at: T, completed_at: null, tokens_used: 1, artifacts_created: 0, error_message: null, created_at: T },
    { id: "r2", run_type: "synthesis", status: "failed", started_at: T, completed_at: T, tokens_used: 1, artifacts_created: 0, error_message: "boom", created_at: T },
  ]);
  m.fetchAutonomySeeds.mockResolvedValue([
    { id: "s1", seed_type: "topic", content: "avail", priority: 1, used_at: null, created_at: T },
    { id: "s2", seed_type: "question", content: "used", priority: 1, used_at: T, created_at: T },
  ]);
  m.fetchConclusions.mockResolvedValue([
    { id: "c1", conclusion_text: "I think", superseded_by: null, created_at: T, edited_at: null, confidence: 0.9, belief_type: "self", subject: "me", provenance: "p", contradiction_flagged: 1 },
  ]);
  m.fetchRelationalHistory.mockResolvedValue([
    { id: "x1", companion_id: "gaia", toward: "principal", state_text: "held", weight: 0.5, state_type: "held", noted_at: T },
    { id: "x2", companion_id: "gaia", toward: "principal", state_text: "older", weight: 0.2, state_type: "witness", noted_at: T },
  ]);
  m.fetchSittingNotes.mockResolvedValue([{ note_id: "n1", content: "sits", note_type: "message", created_at: T, sit_text: "thinking", sat_at: T }]);
  m.fetchSomaFeelings.mockResolvedValue([{ id: "f1", emotion: "calm", sub_emotion: null, source: "x", intensity: 40, created_at: T }]);
  m.fetchLoops.mockResolvedValue([
    { id: "l1", loop_text: "open", weight: 0.5, opened_at: T, closed_at: null },
    { id: "l2", loop_text: "done", weight: 0.5, opened_at: T, closed_at: T },
  ]);
  m.fetchPersonaBlocks.mockResolvedValue([{ id: "b1", content: "blk", block_type: "t", created_at: T }]);
  m.fetchHumanBlocks.mockResolvedValue([]);
  m.fetchLettersOut.mockResolvedValue([{ id: "o1", created_at: "2026-10-31 10:00:00", author: "principal", content: "dear you", note_type: "letter:gaia" }]);
  m.fetchInbox.mockResolvedValue({ items: [{ id: "i1", agent: "gaia", preview: "hi", read: false, created_at: "2026-10-31 11:00:00" }], unread_count: 1 });
});

describe("companion config", () => {
  it("carries no color or gradient, only display/sym/tagline", () => {
    for (const c of Object.values(COMPANION_CONFIG)) {
      expect(Object.keys(c).sort()).toEqual(["display", "sym", "tagline"]);
    }
  });
  it("categorical maps are neutral: no companion hue, no lamp", () => {
    const cats = [DC.ENTRY_TYPE_COLOR, DC.BELIEF_TYPE_COLOR, DC.SEED_TYPE_COLOR, DC.RUN_TYPE_COLOR, DC.MARKER_TYPE_COLOR, DC.SOURCE_COLOR];
    for (const map of cats) {
      for (const v of Object.values(map)) expect(v).toMatch(/^var\(--h-(ink|muted|faint)\)$/);
    }
    // semantic maps: only ok/bad/neutral, lamp only for the single attention state
    expect(DC.STATE_TYPE_COLOR).toEqual({ feeling: "var(--h-ink)", witness: "var(--h-gaia)", held: "var(--h-faint)" });
    expect(DC.RUN_STATUS_COLOR.running).toBe("var(--h-lamp)");
    for (const v of Object.values(DC.RUN_STATUS_COLOR).concat(Object.values(DC.REVIEW_STATUS_COLOR))) {
      expect(v).not.toMatch(/drevan|cypher/);
    }
    expect(DC.seedTypeColor("unknown")).toBe("var(--h-faint)");
  });
  it("state-type map is kit tokens", () => {
    for (const v of Object.values(STATE_TYPE_COLOR)) expect(v).toMatch(/^var\(--h-[a-z]+\)$/);
  });
});

describe("companion pages carry no color literals", () => {
  it("growth", async () => {
    const html = renderToStaticMarkup(await GrowthPage({ ...params("gaia"), searchParams: Promise.resolve({}) }));
    expectKitOnly(html);
    expect(html).toContain('data-companion="gaia"');
    expect(html).toContain("--c:var(--h-muted)"); // insight (neutral)
    expect(html).toContain("--c:var(--h-gaia)"); // accepted
    expect(html).toContain("--c:var(--h-warn)"); // declined
  });
  it("autonomy", async () => {
    const html = renderToStaticMarkup(await AutonomyPage(params("cypher")));
    expectKitOnly(html);
    expect(html).toContain("--c:var(--h-warn)"); // failed run
    expect(html).toContain("--c:var(--h-lamp)"); // running run
    expect(html).toContain("boom");
  });
  it("worldview (flagged item is a badge, not a left border)", async () => {
    const html = renderToStaticMarkup(await WorldviewPage(params("drevan")));
    expectKitOnly(html);
    expect(html).toContain("[?] flagged");
  });
  it("relational", async () => {
    expectKitOnly(renderToStaticMarkup(await RelationalPage(params("gaia"))));
  });
  it("sitting, feelings, loops, blocks", async () => {
    for (const P of [SittingPage, FeelingsPage, LoopsPage, BlocksPage]) {
      expectKitOnly(renderToStaticMarkup(await P(params("gaia"))));
    }
  });
  it("letters: no per-bubble border tint", async () => {
    const html = renderToStaticMarkup(await LettersPage(params("gaia")));
    expectKitOnly(html);
    expect(html).toContain("is-unread");
  });
});

describe("companion components carry no color literals", () => {
  it("JournalClient, buttons", () => {
    const entries = [{ id: "j1", entry_type: "insight", source: "conversation", content: "c", tags_json: "[\"t\"]", created_at: T }] as never;
    expectKitOnly(renderToStaticMarkup(<JournalClient entries={entries} companionId="gaia" />));
    expect(styleAttrs(renderToStaticMarkup(<CloseLoopButton loopId="l" companionId="gaia" />))).toEqual([]);
    expect(styleAttrs(renderToStaticMarkup(<MetabolizeButton noteId="n" companionId="gaia" />))).toEqual([]);
  });
  it("sections", () => {
    const c = "var(--h-gaia)";
    const fer = {
      companion_id: "gaia", compound_state: null, ferment_at: T, recent_events: [],
      floats: [{ label: "heat", value: 0.6, baseline: 0.5, seed: 0.4 }],
      drives: [{ drive_key: "rest_need", level: 0.7, threshold: 0.6, fired: true }],
      provenance: [{ float_key: "soma_float_1", label: "heat", kind: "tick", writer: "w", before_value: 0.5, after_value: 0.6, delta: 0.1, cause_table: null, cause_id: null, cause_label: null, session_id: null, alongside_notes: 0, created_at: T }],
    } as never;
    const voice = {
      n: 2, avg: 0.7, self_catch_rate: 0.5, self_catches: 1, human_catches: 1,
      recent: [{ score: 0.5, caught_by: "self", anti_hits: "[\"x\"]", contamination_hits: "[\"y\"]", created_at: T }],
    } as never;
    const html = [
      renderToStaticMarkup(<FermentationSection data={fer} color={c} />),
      renderToStaticMarkup(<VoiceLaneSection scores={voice} color={c} />),
      renderToStaticMarkup(<SomaFeelingsSection feelings={[{ id: "f", emotion: "e", sub_emotion: null, source: "s", intensity: 20, created_at: T }] as never} color={c} />),
      renderToStaticMarkup(<RelationalStateSection states={[{ id: "1", companion_id: "gaia", toward: "r", state_text: "t", weight: 1, state_type: "held", noted_at: T }]} />),
      renderToStaticMarkup(<LiveThreadsSection threads={[{ id: "1", name: "n", flavor: "f", status: "active", notes: "nn", created_at: T }] as never} />),
      renderToStaticMarkup(<DriftLogSection entries={[{ id: "1", companion_id: "gaia", signal_type: "a_b", context: "c", detected_at: T }]} />),
      renderToStaticMarkup(<SittingNotesSection color={c} notes={[{ note_id: "1", content: "c", note_type: "message", created_at: T, sit_text: "s", sat_at: T }]} />),
      renderToStaticMarkup(<OpenLoopsSection loops={[{ id: "1", loop_text: "t", weight: 0.4, opened_at: T, closed_at: null }] as never} />),
    ].join("");
    expectKitOnly(html);
    expect(html).toContain("--c:var(--h-warn)"); // contamination hit
    expect(html).toContain("is-fired");
  });
});
