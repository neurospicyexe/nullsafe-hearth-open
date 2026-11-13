import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// P7 task 5: the heavy Under-the-hood pages carry no color literals, gradients, left-border accents
// or glow. Companion hue = identity (toneOf / COMPANION_COLOR), lamp = Principal or one attention
// state, categorical maps are neutral. Only custom-property inline styles remain.

const m = vi.hoisted(() => ({
  fetchPresence: vi.fn(), fetchSynthesisSummaries: vi.fn(), fetchMindDreams: vi.fn(),
  fetchCompanionJournal: vi.fn(), fetchClubCurrent: vi.fn(), fetchObsessions: vi.fn(),
  fetchGrowthPendingCount: vi.fn(),
  fetchAutonomyRuns: vi.fn(), fetchAutonomyReflections: vi.fn(), fetchAutonomySeeds: vi.fn(),
  fetchGrowthJournal: vi.fn(), fetchGrowthPatterns: vi.fn(),
  fetchDrifts: vi.fn(), fetchSomaShifts: vi.fn(),
}));
vi.mock("@/lib/halseth", () => ({ ...m, MAX_SESSION_DEPTH: 3 }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
vi.mock("@/components/CompanionMoodCard", () => ({ default: () => null }));
vi.mock("@/components/LiveFeedImage", () => ({ default: () => null }));

import OverviewPage from "./overview/page";
import AutonomousPage from "./autonomous/page";
import DriftsPage from "./drifts/page";
import HalsethPage from "./halseth/page";
import HalsethRoom from "@/components/HalsethRoom";
import BasinsClient from "./basins/BasinsClient";
import ManageClient from "./manage/ManageClient";
import HouseClient from "./house/HouseClient";
import SomaClient from "./soma/SomaClient";

const root = join(__dirname, "..");
const FILES = [
  "app/basins/BasinsClient.tsx", "app/autonomous/page.tsx", "app/overview/page.tsx",
  "app/soma/SomaClient.tsx", "app/halseth/page.tsx", "components/HalsethRoom.tsx",
  "app/drifts/page.tsx", "app/manage/ManageClient.tsx", "app/house/HouseClient.tsx",
];

const T = "2026-11-01T00:00:00Z";

function styleAttrs(html: string): string[] {
  return [...html.matchAll(/style="([^"]*)"/g)].map((x) => x[1]);
}
// A style attribute may only set custom properties: a kit token (--c, --companion-color,
// --orb-color) or data geometry (--w, --o, --orb-dur).
function expectKitOnly(html: string) {
  expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  // The soma orb is a data visualisation: one token-built radial is allowed (no hex, no glow).
  const noOrb = html.replace(/radial-gradient\(circle at 38% 38%, color-mix\(in srgb, var\(--orb-color\) 85%, var\(--h-ink\)\), var\(--orb-color\)\)/g, "");
  expect(noOrb).not.toMatch(/border-left|gradient|rgba?\(|hsl\(|box-shadow/);
  for (const s of styleAttrs(html)) {
    for (const decl of s.split(";").filter(Boolean)) {
      const i = decl.indexOf(":");
      const k = decl.slice(0, i);
      const v = decl.slice(i + 1);
      expect(k).toMatch(/^--(c|w|o|orb-color|orb-dur|companion-color)$/);
      if (k === "--c" || k === "--orb-color" || k === "--companion-color") expect(v).toMatch(/^var\(--h-[a-z]+\)$/);
      else expect(v).toMatch(/^[\d.]+(%|s)?$/);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  m.fetchSynthesisSummaries.mockResolvedValue([]);
  m.fetchMindDreams.mockResolvedValue([]);
  m.fetchCompanionJournal.mockResolvedValue([{ id: "n1", agent: "drevan", note_text: "hello", created_at: T }]);
  m.fetchClubCurrent.mockResolvedValue(null);
  m.fetchObsessions.mockResolvedValue([]);
  m.fetchGrowthPendingCount.mockResolvedValue({
    total: 3, oldest_at: "2026-10-01 00:00:00",
    per_companion: [{ companion_id: "drevan", pending: 2 }, { companion_id: "gaia", pending: 1 }],
  });
  m.fetchAutonomyRuns.mockResolvedValue([
    { id: "r1", run_type: "exploration", status: "running", created_at: T, started_at: T, tokens_used: 5, artifacts_created: 1 },
  ]);
  m.fetchAutonomyReflections.mockResolvedValue([{ id: "f1", reflection_text: "thinking", created_at: T }]);
  m.fetchAutonomySeeds.mockResolvedValue([{ id: "s1", seed_type: "reflection_prompt", content: "a seed" }]);
  m.fetchGrowthJournal.mockResolvedValue([{ id: "j1", entry_type: "insight", content: "an insight", created_at: T }]);
  m.fetchGrowthPatterns.mockResolvedValue([{ id: "p1", pattern_text: "a pattern", strength: 7 }]);
  m.fetchDrifts.mockResolvedValue([
    { id: "d1", status: "open", drift_text: "becoming", opened_at: T, origin: "x", resolution_note: null,
      witness_log: [{ by: "principal", note: "seen" }, { by: "gaia", note: "held" }] },
    { id: "d2", status: "crystallized", drift_text: "became", opened_at: T, origin: null, resolution_note: "done", witness_log: [] },
  ]);
  m.fetchSomaShifts.mockResolvedValue([{ drift_id: "d1", delta: 0.1, float_key: "f1", label: null, after_value: 0.5, reason: "why" }]);
  m.fetchPresence.mockResolvedValue({
    house: { current_room: "study", companion_mood: "m", companion_activity: "a" },
  });
});

const overviewData = {
  system: { name: "Halseth", owner: "me" },
  session: null,
  last_handover: { spine: "s", last_real_thing: "r", motion_state: "at_rest", facet: "f", active_anchor: "a", open_threads: [], created_at: T },
  house: { current_room: "study", companion_activity: "a", spoon_count: 5, love_meter: 40, autonomous_turn: "cypher" },
  wounds_count: 0, tasks: [
    { id: "t1", title: "urgent", status: "open", priority: "urgent" },
    { id: "t2", title: "high", status: "open", priority: "high" },
    { id: "t3", title: "norm", status: "open", priority: "normal" },
  ],
  recent_notes: [], recent_dreams: [], recent_companion_notes: [],
  latest_biometrics: { resting_hr: 60, hrv_resting: 40, sleep_hours: 7, sleep_quality: "ok", stress_score: 2, steps: 1000 },
  companion_moods: {}, companions: [],
  recent_growth: [{ entry_type: "question", content: "q" }],
  active_patterns: [{ companion_id: "gaia", pattern_text: "pat", strength: 5 }],
};

describe("Hood heavy pages: source", () => {
  for (const f of FILES) {
    it(`${f} has no hex, gradient, left-border or glow`, () => {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src).not.toMatch(/border-?left|linear-gradient|radial-gradient\([^)]*#|rgba?\(|hsl\(|box-?shadow|boxShadow/i);
      expect(src).not.toMatch(/COMPANION_COLORS\b|RATIFY_COLOR|DIGEST_COLOR|COMPANION_COLOR_HOME/);
    });
  }
  it("categorical maps are gone or neutral", () => {
    for (const f of FILES) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).not.toMatch(/(ENTRY_TYPE|SEED_TYPE|WITNESS|STATUS)_COLOR\s*[:=]/);
    }
    const basins = readFileSync(join(root, "app/basins/BasinsClient.tsx"), "utf8");
    expect(basins).toMatch(/stable: "is-stable"/);
    const soma = readFileSync(join(root, "app/soma/SomaClient.tsx"), "utf8");
    expect(soma).toMatch(/drift: "is-drift"/);
    expect(soma).toMatch(/critical: "is-critical"/);
  });
});

describe("Hood heavy pages: rendered markup", () => {
  it("overview", async () => {
    m.fetchPresence.mockResolvedValue(overviewData);
    const html = renderToStaticMarkup(await OverviewPage());
    expectKitOnly(html);
    expect(html).toContain("h-tone-drevan");
    expect(html).toContain("h-tone-gaia");
    expect(html).toContain("task-dot is-urgent");
  });
  it("autonomous", async () => {
    const html = renderToStaticMarkup(await AutonomousPage());
    expectKitOnly(html);
    expect(html).toContain("h-tone-dot h-tone-");
    expect(html).toContain("--c:var(--h-lamp)"); // running = the one attention state
  });
  it("drifts", async () => {
    const html = renderToStaticMarkup(await DriftsPage());
    expectKitOnly(html);
    expect(html).toContain("h-hood-principal");
    expect(html).toContain("is-done");
  });
  it("halseth rooms are solid cards, no gradient", async () => {
    const html = renderToStaticMarkup(await HalsethPage());
    expectKitOnly(html);
    expect(html).toContain("room-plain");
    expect(html).toContain("Living Room");
    expect(html).toContain("The Truck");
  });
  it("HalsethRoom with an image keeps the image", () => {
    const html = renderToStaticMarkup(
      <HalsethRoom rooms={[{ key: "a", sym: "x", name: "Alpha", desc: "d", imageUrl: "https://x.test/a.jpg" }]} initialRoom="a" />,
    );
    expectKitOnly(html);
    expect(html).toContain("room-image");
  });
  it("basins", () => {
    const row = (id: string, t: string, c = 0) => ({
      id, companion_id: "cypher", drift_type: t, drift_score: 0.4, worst_basin: "b", notes: null,
      recorded_at: new Date().toISOString(), caleth_confirmed: c, dismissed_at: null,
    });
    const html = renderToStaticMarkup(
      <BasinsClient byCompanion={{ drevan: [row("1", "pressure"), row("2", "growth", 1), row("3", "stable")], gaia: [] }} />,
    );
    expectKitOnly(html);
    expect(html).toContain("h-tone-drevan");
    expect(html).toContain("h-basin-pt is-pressure");
    expect(html.match(/h-basin-ring/g)).toHaveLength(1); // only the confirmed point, drawn as its own outline
    expect(html).not.toContain("is-ringed");
  });
  it("manage", () => {
    const bundle = {
      id: "drevan",
      actions: [{ id: "a1", name: "n", action_type: "nothing", status: "on", quiet_hours_allowed: 0, max_per_day: null, prompt: null }],
      seeds: [], journal: [],
    };
    const html = renderToStaticMarkup(
      <ManageClient bundles={[bundle as never, { id: "gaia", actions: [], seeds: [], journal: [] }]} />,
    );
    expectKitOnly(html);
    expect(html).toContain("manage-pill is-on");
    expect(html).toContain("--c:var(--h-drevan)");
    expect(html).toContain("--c:var(--h-gaia)");
  });
  it("house", () => {
    const html = renderToStaticMarkup(
      <HouseClient house={{ current_room: "studio", companion_mood: "m", companion_activity: null, spoon_count: 5, love_meter: 50, updated_at: T, autonomous_turn: "gaia" }} />,
    );
    expectKitOnly(html);
    expect(html).toContain("h-tone-gaia");
  });
  it("soma: companion colors come from the kit, orb has no glow", () => {
    const state = {
      soma_float_1: 0.9, soma_float_2: 0.2, soma_float_3: null, float_1_label: "a", float_2_label: "b", float_3_label: "c",
      current_mood: "m", compound_state: null, updated_at: T, surface_emotion: null, undercurrent_emotion: null,
      surface_intensity: null, undercurrent_intensity: null,
    };
    const html = renderToStaticMarkup(
      <SomaClient
        initialData={{ drevan: state, cypher: null, gaia: state, fetched_at: T } as never}
        tensions={[{ id: "t", companion_id: "gaia", tension_text: "x", charge: 3, first_noted_at: T } as never]}
        basins={[{ id: "b", companion_id: "cypher", drift_type: "critical", drift_score: 0.5, worst_basin: null, notes: null, recorded_at: T } as never]}
      />,
    );
    expectKitOnly(html);
    expect(html).toContain("--orb-color:var(--h-drevan)");
    expect(html).toContain("soma-extra-badge is-critical");
    expect(html).not.toMatch(/--orb-glow|--orb-scale/);
  });
});
