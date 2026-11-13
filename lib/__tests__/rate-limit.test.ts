import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isLoginBlocked,
  recordLoginFailure,
  clearLoginFailures,
  getClientKey,
  resolveRestCredentials,
  getLoginThrottleStore,
  MemoryThrottleStore,
  UpstashThrottleStore,
  LOGIN_FAIL_LIMIT,
  LOGIN_FAIL_WINDOW_S,
  __setStoreForTests,
  type LoginThrottleStore,
} from "../rate-limit.js";

beforeEach(() => { __setStoreForTests(new MemoryThrottleStore()); });
afterEach(() => { vi.useRealTimers(); __setStoreForTests(null); });

describe("login throttle semantics (mirrors Halseth auth-throttle)", () => {
  it("limit is 5 failures per 15 minutes", () => {
    expect(LOGIN_FAIL_LIMIT).toBe(5);
    expect(LOGIN_FAIL_WINDOW_S).toBe(900);
  });

  it("a fresh IP is not blocked", async () => {
    expect(await isLoginBlocked("1.2.3.4")).toBe(false);
  });

  it("4 failures do not block; the 5th does", async () => {
    for (let i = 0; i < 4; i++) await recordLoginFailure("ip");
    expect(await isLoginBlocked("ip")).toBe(false);
    await recordLoginFailure("ip");
    expect(await isLoginBlocked("ip")).toBe(true);
  });

  it("only failures count: checking the block many times never blocks", async () => {
    for (let i = 0; i < 50; i++) expect(await isLoginBlocked("checker")).toBe(false);
  });

  it("success clears the counter", async () => {
    for (let i = 0; i < 4; i++) await recordLoginFailure("ip");
    await clearLoginFailures("ip");
    for (let i = 0; i < 4; i++) await recordLoginFailure("ip");
    expect(await isLoginBlocked("ip")).toBe(false);
  });

  it("tracks IPs independently", async () => {
    for (let i = 0; i < 5; i++) await recordLoginFailure("bad");
    expect(await isLoginBlocked("bad")).toBe(true);
    expect(await isLoginBlocked("good")).toBe(false);
  });

  it("each failure refreshes the TTL: lockout lasts 15 min from the LAST failure", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 5; i++) await recordLoginFailure("ip");
    vi.advanceTimersByTime(10 * 60 * 1000);
    await recordLoginFailure("ip"); // refresh
    vi.advanceTimersByTime(10 * 60 * 1000); // 20 min after first, 10 after last
    expect(await isLoginBlocked("ip")).toBe(true);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(await isLoginBlocked("ip")).toBe(false);
  });
});

describe("store selection", () => {
  it("no credentials -> memory", () => {
    __setStoreForTests(null);
    expect(getLoginThrottleStore({}).kind).toBe("memory");
  });

  it("Vercel Marketplace pair -> upstash", () => {
    __setStoreForTests(null);
    expect(getLoginThrottleStore({ KV_REST_API_URL: "https://x.upstash.io", KV_REST_API_TOKEN: "t" }).kind).toBe("upstash");
  });

  it("direct Upstash pair is accepted; a half pair is not", () => {
    expect(resolveRestCredentials({ UPSTASH_REDIS_REST_URL: "https://y", UPSTASH_REDIS_REST_TOKEN: "t" })).toEqual({ url: "https://y", token: "t" });
    expect(resolveRestCredentials({ KV_REST_API_URL: "https://x" })).toBeNull();
    expect(resolveRestCredentials({ KV_REST_API_URL: "  ", KV_REST_API_TOKEN: "t" })).toBeNull();
  });
});

describe("store failure falls back to memory (never no-limit, never lock-everyone-out)", () => {
  const broken: LoginThrottleStore = {
    kind: "upstash",
    get: async () => { throw new Error("down"); },
    increment: async () => { throw new Error("down"); },
    clear: async () => { throw new Error("down"); },
  };

  it("still blocks after 5 failures while the durable store is down", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    __setStoreForTests(broken);
    expect(await isLoginBlocked("ip")).toBe(false);
    for (let i = 0; i < 5; i++) await recordLoginFailure("ip");
    expect(await isLoginBlocked("ip")).toBe(true);
    await clearLoginFailures("ip");
    expect(await isLoginBlocked("ip")).toBe(false);
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});

describe("UpstashThrottleStore (REST contract, mocked fetch)", () => {
  type Call = { url: string; init: RequestInit };
  function fakeFetch(responder: (url: string, body: unknown) => unknown, status = 200) {
    const calls: Call[] = [];
    const impl = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(responder(url, JSON.parse(String(init.body)))), { status });
    };
    return { calls, impl };
  }

  it("increment sends INCR + EXPIRE as one MULTI/EXEC with bearer auth and no-store", async () => {
    const f = fakeFetch(() => [{ result: 3 }, { result: 1 }]);
    const s = new UpstashThrottleStore("https://db.upstash.io/", "tok", f.impl);
    expect(await s.increment("k", 900)).toBe(3);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe("https://db.upstash.io/multi-exec");
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual([["INCR", "k"], ["EXPIRE", "k", "900"]]);
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(f.calls[0].init.cache).toBe("no-store");
  });

  it("get parses the string result and treats null as 0", async () => {
    const s1 = new UpstashThrottleStore("https://db", "t", fakeFetch(() => ({ result: "4" })).impl);
    expect(await s1.get("k")).toBe(4);
    const s2 = new UpstashThrottleStore("https://db", "t", fakeFetch(() => ({ result: null })).impl);
    expect(await s2.get("k")).toBe(0);
  });

  it("clear sends DEL to the root endpoint", async () => {
    const f = fakeFetch(() => ({ result: 1 }));
    await new UpstashThrottleStore("https://db", "t", f.impl).clear("k");
    expect(f.calls[0].url).toBe("https://db");
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual(["DEL", "k"]);
  });

  it("throws on HTTP errors and on per-command errors (so the caller falls back)", async () => {
    await expect(new UpstashThrottleStore("https://db", "t", fakeFetch(() => ({}), 401).impl).get("k")).rejects.toThrow();
    await expect(new UpstashThrottleStore("https://db", "t", fakeFetch(() => ({ error: "WRONGTYPE" })).impl).get("k")).rejects.toThrow();
    await expect(new UpstashThrottleStore("https://db", "t", fakeFetch(() => [{ error: "ERR" }]).impl).increment("k", 9)).rejects.toThrow();
  });
});

describe("getClientKey", () => {
  const headers = (map: Record<string, string>) => ({
    get: (name: string) => map[name.toLowerCase()] ?? null,
  });

  it("prefers x-vercel-forwarded-for, then x-real-ip", () => {
    expect(getClientKey(headers({ "x-vercel-forwarded-for": "7.7.7.7", "x-real-ip": "1.2.3.4" }))).toBe("7.7.7.7");
    expect(getClientKey(headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
  });

  it("falls back to the last x-forwarded-for entry, not the client-spoofable first one", () => {
    expect(getClientKey(headers({ "x-forwarded-for": "attacker-controlled, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("an attacker prepending arbitrary values cannot get a fresh bucket per request", async () => {
    const realKey = getClientKey(headers({ "x-forwarded-for": "10.0.0.1" }));
    for (let i = 0; i < 5; i++) {
      const spoofed = headers({ "x-forwarded-for": `spoofed-${i}, 10.0.0.1` });
      expect(getClientKey(spoofed)).toBe(realKey);
      await recordLoginFailure(getClientKey(spoofed));
    }
    expect(await isLoginBlocked(realKey)).toBe(true);
  });

  it("returns 'unknown' when no identifying header is present", () => {
    expect(getClientKey(headers({}))).toBe("unknown");
  });
});
