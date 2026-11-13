import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// P7 task 3: the Phoenix pages carry no color literals in rendered style= attributes; companion
// colour arrives only as the --c custom property set to a kit token.

vi.mock("next/navigation", () => ({ usePathname: () => "/phoenix" }));
vi.mock("next/link", () => ({
  default: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
vi.mock("@/lib/halseth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const soma = { heat: "warm", reach: null, weight: null, current_mood: "steady", compound_state: "held",
    float_1_label: null, float_2_label: null, float_3_label: null };
  return {
    ...actual,
    fetchSomaStates: async () => ({ drevan: soma, cypher: null, gaia: null }),
    fetchWmOrient: async () => ({
      open_thread_count: 1,
      top_threads: [{ thread_key: "t1", title: "A thread", status: "open" }],
      latest_handoff: { title: "Handoff", next_steps: "go", created_at: "2026-11-01T00:00:00Z" },
    }),
    fetchAutonomyRuns: async () => [{ run_type: "explore", status: "failed", completed_at: "2026-11-01T00:00:00Z", artifacts_created: 2 }],
    fetchAutonomySeeds: async () => [{ id: "s1", content: "seed", priority: 1, claim_source: "x" }],
    fetchAutonomyThreads: async () => [{ id: "g1", title: "grow", status: "open", last_position: 2, last_entry_snippet: "snip" }],
    fetchSynthesisSummaries: async () => [{ companion_id: "drevan", subject: "S", narrative: "N", emotional_register: "calm", created_at: "2026-11-01T00:00:00Z" }],
    fetchInterCompanionNotes: async () => [{ id: "n1", from_id: "drevan", to_id: "gaia", content: "hi", read_at: null, created_at: "2026-11-01T00:00:00Z" }],
    fetchMetronomeActions: async (c: string) => [{ id: `a-${c}`, companion_id: c, name: "beat", action_type: "post_heartbeat", status: "on",
      prompt: null, silence_min_hours: 1, silence_max_hours: null, max_per_day: 2, cooldown_hours: null, requires_signal: null,
      signal_lookback_hours: null, last_fired_at: null }],
  };
});

import PhoenixPage from "./page";
import PhoenixTabs from "./PhoenixTabs";
import PhoenixChatPage from "./chat/page";
import { MetronomeSection } from "./MetronomeSection";

function styleAttrs(html: string): string[] {
  return [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
}
function expectTokensOnly(html: string) {
  expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  for (const s of styleAttrs(html)) expect(s).toMatch(/^--c:var\(--h-[a-z]+\);?$/);
}

describe("phoenix styling", () => {
  it("overview page: no hex, only --c tokens, phx classes in place", async () => {
    const html = renderToStaticMarkup(await PhoenixPage());
    expectTokensOnly(html);
    expect(html).toContain("h-phx-grid");
    expect(html).toContain("--c:var(--h-drevan)");
    expect(html).toContain("--c:var(--h-warn)"); // failed run
    expect(html).toContain("h-tone-drevan");
    expect(html).toContain("Inter-Companion Notes");
  });

  it("tabs: active tab by class, no inline style", () => {
    const html = renderToStaticMarkup(<PhoenixTabs />);
    expect(styleAttrs(html)).toEqual([]);
    expect(html).toMatch(/class="h-phx-tab is-on"[^>]*>|href="\/phoenix"[^>]*class="h-phx-tab is-on"/);
  });

  it("metronome: no hex, only --c tokens", () => {
    const a = (c: string) => ({ id: `a-${c}`, companion_id: c, name: "beat", action_type: "post_heartbeat", status: "off",
      prompt: null, silence_min_hours: null, silence_max_hours: 3, max_per_day: null, cooldown_hours: 1,
      requires_signal: "x", signal_lookback_hours: 2, last_fired_at: null });
    const html = renderToStaticMarkup(
      <MetronomeSection actionsMap={{ drevan: [a("drevan")], cypher: [], gaia: [] } as never} />,
    );
    expectTokensOnly(html);
    expect(html).toContain("Metronome Palette");
    expect(html).toContain("--c:var(--h-gaia)");
  });

  it("chat page: no hex, only --c tokens, no left-border accent", () => {
    const html = renderToStaticMarkup(<PhoenixChatPage />);
    expectTokensOnly(html);
    expect(html).toContain("Message ");
    expect(html).not.toMatch(/border-left/);
  });
});
