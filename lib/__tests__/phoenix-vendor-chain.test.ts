// DeepInfra-first vendor chain for Hearth's three inference paths (2026-09-26).
//
// Principal's rule: ALL DeepSeek-model inference goes through DeepInfra (same V4-Flash weights); the
// direct DeepSeek platform is a ~$10 emergency lane, used only when DeepInfra fails, and loudly.
// /api/phoenix/chat (x2) and /api/phoenix/ritual all called api.deepseek.com directly, so at a $0
// balance every Phoenix turn 502'd. They now share phoenixComplete(); these pin its order.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hearthVendors, phoenixComplete, vendorFailover, hearthMaxTokens, FELL_BACK_TAG } from "../phoenix-chat";

const DI = "https://api.deepinfra.com/v1/openai/chat/completions";
const DS = "https://api.deepseek.com/chat/completions";
const both = { DEEPINFRA_API_KEY: "di", DEEPSEEK_API_KEY: "ds" };
const req = {
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 1200,
  sampling: { temperature: 0.7, top_p: 0.9 },
  timeoutMs: 5000,
  label: "test",
};

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { total_tokens: 7 } }), { status: 200 });
const fail = (status: number) => new Response("nope", { status });

let warn: { mock: { calls: unknown[][] } };
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {}) as unknown as typeof warn;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const warnLines = () => warn.mock.calls.map((c) => String(c[0]));
const urlsOf = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls.map((c) => String(c[0]));

describe("hearthVendors", () => {
  it("DeepInfra first, DeepSeek second, per-vendor model ids", () => {
    const v = hearthVendors(both);
    expect(v.map((x) => x.label)).toEqual(["DeepInfra", "DeepSeek"]);
    expect(v[0]!.model).toBe("deepseek-ai/DeepSeek-V4-Flash-0731");
    expect(v[1]!.url).toBe(DS);
  });
  it("either key alone is enough; none is empty", () => {
    expect(hearthVendors({ DEEPSEEK_API_KEY: "ds" }).map((x) => x.label)).toEqual(["DeepSeek"]);
    expect(hearthVendors({ DEEPINFRA_API_KEY: "di" }).map((x) => x.label)).toEqual(["DeepInfra"]);
    expect(hearthVendors({})).toEqual([]);
  });
});

describe("phoenixComplete", () => {
  it("never calls DeepSeek when DeepInfra answers; sends the floored ceiling + sampling", async () => {
    const fn = vi.fn(async () => ok("hello"));
    await expect(phoenixComplete(req, both, fn as unknown as typeof fetch)).resolves.toEqual({ raw: "hello", tokens: 7 });
    expect(urlsOf(fn)).toEqual([DI]);
    const body = JSON.parse(String(((fn.mock.calls[0] as unknown[])[1] as RequestInit).body));
    expect(body).toMatchObject({ model: "deepseek-ai/DeepSeek-V4-Flash-0731", max_tokens: hearthMaxTokens(1200), temperature: 0.7, top_p: 0.9 });
    expect(warnLines().some((l) => l.includes(FELL_BACK_TAG))).toBe(false);
  });

  it("falls back to DeepSeek on a DeepInfra 503 and logs the FELL BACK line", async () => {
    const fn = vi.fn().mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok("rescued"));
    await expect(phoenixComplete(req, both, fn as unknown as typeof fetch)).resolves.toMatchObject({ raw: "rescued" });
    expect(urlsOf(fn)).toEqual([DI, DS]);
    const line = warnLines().find((l) => l.includes(FELL_BACK_TAG));
    expect(line).toContain("HTTP 503");
    expect(line).toContain("caller=test");
  });

  it("falls back on a network error", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(ok("rescued"));
    await expect(phoenixComplete(req, both, fn as unknown as typeof fetch)).resolves.toMatchObject({ raw: "rescued" });
    expect(urlsOf(fn)).toEqual([DI, DS]);
  });

  it("does NOT spend the emergency lane on a 400 or an empty 200", async () => {
    let fn = vi.fn(async () => fail(400));
    await expect(phoenixComplete(req, both, fn as unknown as typeof fetch)).resolves.toMatchObject({ status: 502 });
    expect(urlsOf(fn)).toEqual([DI]);

    fn = vi.fn(async () => ok(""));
    const r = await phoenixComplete(req, both, fn as unknown as typeof fetch);
    expect("error" in r && r.error).toMatch(/no content/);
    expect(urlsOf(fn)).toEqual([DI]);
  });

  it("503 with no key; 502 when every vendor fails", async () => {
    await expect(phoenixComplete(req, {}, vi.fn() as unknown as typeof fetch)).resolves.toMatchObject({ status: 503 });
    await expect(phoenixComplete(req, both, vi.fn(async () => fail(402)) as unknown as typeof fetch)).resolves.toMatchObject({ status: 502 });
  });

  it("vendorFailover: 400 fatal, 401/402/403/429/5xx fail over", () => {
    expect(vendorFailover(400)).toBe(false);
    for (const s of [401, 402, 403, 429, 500, 502]) expect(vendorFailover(s)).toBe(true);
  });
});
