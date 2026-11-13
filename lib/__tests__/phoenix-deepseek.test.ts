// Guards on the shared DeepSeek plumbing for Hearth's three inference paths
// (api/phoenix/chat triad, api/phoenix/chat individual, api/phoenix/ritual).
//
// Context (2026-07-29): all three hardcoded the DELISTED `deepseek-chat`, which still ROUTES -- it
// resolves to deepseek-v4-flash but with REASONING DISABLED, so Hearth's companions ran a different
// variant from the Discord bots' with no error anywhere. Fixing that turned reasoning ON, which makes
// the two invariants below load-bearing rather than theoretical:
//
//   1. On a reasoning model, max_tokens is spent by the THOUGHT first. A ceiling under the burn
//      returns "" with a 200 -- never an error. Hence the floor.
//   2. A 200 with empty content is a FAILURE. All three paths used `content ?? ""` and passed it on:
//      chat rendered a blank companion reply, ritual parsed an empty ritual and wrote a hollow
//      artifact. The guard existed on ONE path first, which is exactly how the same defect survives
//      in its siblings -- so it is shared now, and tested here rather than per-route.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  HEARTH_DEEPSEEK_MODEL,
  HEARTH_MIN_MAX_TOKENS,
  hearthMaxTokens,
  extractDeepSeekContent,
  threadTitles,
  COMPOST_THREAD_LIMIT,
} from "../phoenix-chat";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HEARTH_DEEPSEEK_MODEL", () => {
  it("is a model id the DeepSeek API actually serves, never a delisted alias", () => {
    // GET /v1/models returns exactly these two (verified 2026-07-29).
    expect(["deepseek-v4-flash", "deepseek-v4-pro"]).toContain(HEARTH_DEEPSEEK_MODEL);
  });

  it("is never the delisted alias, which routes but silently disables reasoning", () => {
    expect(HEARTH_DEEPSEEK_MODEL).not.toBe("deepseek-chat");
    expect(HEARTH_DEEPSEEK_MODEL).not.toBe("deepseek-reasoner");
  });
});

describe("hearthMaxTokens", () => {
  it("raises a ceiling that reasoning could eat whole", () => {
    expect(hearthMaxTokens(120)).toBe(HEARTH_MIN_MAX_TOKENS);
    expect(hearthMaxTokens(0)).toBe(HEARTH_MIN_MAX_TOKENS);
  });

  it("leaves a ceiling that already has headroom alone", () => {
    expect(hearthMaxTokens(1200)).toBe(1200);
    expect(hearthMaxTokens(2400)).toBe(2400);
  });

  it("floors above the largest measured reasoning burn (372 tok at mt=2400)", () => {
    expect(HEARTH_MIN_MAX_TOKENS).toBeGreaterThan(372);
  });
});

describe("threadTitles (the compost ritual's thread list)", () => {
  // The bug this replaces: the caller read `active_threads ?? mind_threads`, and orient returns
  // NEITHER -- it returns `top_threads`. Both lookups were undefined, `?? []` swallowed it, and
  // compost was always prompted with zero threads. Pinning the real field shape here is the point;
  // the caller now passes `data.top_threads` and the mapping is tested instead of assumed.
  const real = [
    { title: "the membero bond" },
    { title: "  spiral pantry inventory  " },
    { title: "" },
    { title: null },
  ];

  it("reads title, trims it, and drops blanks and nulls", () => {
    expect(threadTitles(real)).toEqual(["the membero bond", "spiral pantry inventory"]);
  });

  it("returns [] for null/undefined/empty rather than throwing", () => {
    expect(threadTitles(null)).toEqual([]);
    expect(threadTitles(undefined)).toEqual([]);
    expect(threadTitles([])).toEqual([]);
  });

  it("caps at COMPOST_THREAD_LIMIT so a long thread list cannot flood the prompt", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ title: `t${i}` }));
    expect(threadTitles(many)).toHaveLength(COMPOST_THREAD_LIMIT);
    expect(threadTitles(many)[0]).toBe("t0");
  });

  it("does NOT fall back to a description field -- wm_mind_threads has no such column", () => {
    // Carrying the old `t.description` fallback forward would look defensive and be dead code.
    const withDescOnly = [{ description: "not a real column" }] as unknown as Parameters<typeof threadTitles>[0];
    expect(threadTitles(withDescOnly)).toEqual([]);
  });
});

describe("extractDeepSeekContent", () => {
  it("returns content and tokens on a real reply", () => {
    const out = extractDeepSeekContent(
      { choices: [{ message: { content: "the rain says nothing back" } }], usage: { total_tokens: 42 } },
      "test", 1200,
    );
    expect(out).toEqual({ raw: "the rain says nothing back", tokens: 42 });
  });

  it("treats a 200 with empty content as an error, not an empty string", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = extractDeepSeekContent(
      { choices: [{ message: { content: "" }, finish_reason: "length" }] },
      "test", 300,
    );
    expect("error" in out).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it("treats whitespace-only content as empty (it parses to an empty ritual either way)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = extractDeepSeekContent({ choices: [{ message: { content: "\n \t\n" } }] }, "test", 600);
    expect("error" in out).toBe(true);
  });

  it("names the reasoning burn in the error, since that is the usual cause", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = extractDeepSeekContent(
      {
        choices: [{ message: { content: "" }, finish_reason: "length" }],
        usage: { completion_tokens_details: { reasoning_tokens: 298 } },
      },
      "test", 300,
    );
    expect("error" in out && out.error).toContain("reasoning_tokens=298");
    expect("error" in out && out.error).toContain("finish_reason=length");
  });

  it("handles a malformed response without throwing (no choices at all)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => extractDeepSeekContent({}, "test", 600)).not.toThrow();
    expect("error" in extractDeepSeekContent({}, "test", 600)).toBe(true);
  });

  it("logs the max_tokens it was given, so the ceiling is visible when diagnosing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    extractDeepSeekContent({ choices: [{ message: { content: "" } }] }, "phoenix/ritual", 600);
    expect(spy.mock.calls[0][0]).toContain("phoenix/ritual");
    expect(spy.mock.calls[0][1]).toMatchObject({ max_tokens: 600 });
  });
});
