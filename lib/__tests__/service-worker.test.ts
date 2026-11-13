// public/sw.js (home-screen app, 2026-10-27), run in a fake worker scope. It must: cache ONLY the
// offline page, answer a failed top-level document navigation with it, and never touch any other
// request (API calls, assets, the epub reader's blob: chapter frames, other origins).
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const SRC = readFileSync(join(__dirname, "../../public/sw.js"), "utf8");

function load(fetchImpl: (r: unknown) => Promise<unknown>) {
  const listeners: Record<string, (e: any) => void> = {};
  const stored: string[] = [];
  const offline = { offline: true };
  const cache = { add: vi.fn(async (r: { url: string }) => { stored.push(r.url); }) };
  const self = {
    location: { origin: "https://hearth.example" },
    addEventListener: (t: string, fn: (e: any) => void) => { listeners[t] = fn; },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
  };
  const ctx = {
    self,
    caches: {
      open: vi.fn(async () => cache),
      keys: vi.fn(async () => ["hearth-offline-v1", "old-cache"]),
      delete: vi.fn(async () => true),
      match: vi.fn(async (u: string) => (u === "/offline.html" ? offline : undefined)),
    },
    fetch: vi.fn(fetchImpl),
    Request: class { constructor(public url: string, public init?: unknown) {} },
    Response: { error: () => ({ error: true }) },
    URL,
  };
  vm.runInNewContext(SRC, ctx);
  const fire = (req: Record<string, string>) => {
    let responded: Promise<unknown> | null = null;
    listeners["fetch"]!({ request: req, respondWith: (p: Promise<unknown>) => { responded = p; } });
    return responded as Promise<unknown> | null;
  };
  return { listeners, stored, offline, ctx, fire };
}

const nav = (url: string) => ({ url, mode: "navigate", destination: "document" });

describe("hearth service worker", () => {
  it("install caches exactly one file, the offline page", async () => {
    const w = load(async () => ({}));
    let done: Promise<unknown> = Promise.resolve();
    w.listeners["install"]!({ waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    expect(w.stored).toEqual(["/offline.html"]);
  });

  it("activate drops any other cache", async () => {
    const w = load(async () => ({}));
    let done: Promise<unknown> = Promise.resolve();
    w.listeners["activate"]!({ waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    expect(w.ctx.caches.delete).toHaveBeenCalledWith("old-cache");
    expect(w.ctx.caches.delete).not.toHaveBeenCalledWith("hearth-offline-v1");
  });

  it("online navigation goes to the network and is never cached", async () => {
    const page = { page: true };
    const w = load(async () => page);
    expect(await w.fire(nav("https://hearth.example/today"))).toBe(page);
    expect(w.stored).toEqual([]);
  });

  it("offline navigation gets the offline page", async () => {
    const w = load(async () => { throw new TypeError("Failed to fetch"); });
    expect(await w.fire(nav("https://hearth.example/today"))).toBe(w.offline);
  });

  it("leaves everything that is not a same-origin document navigation alone", () => {
    const w = load(async () => { throw new Error("should not be called"); });
    expect(w.fire({ url: "https://hearth.example/api/tasks", mode: "cors", destination: "" })).toBeNull();
    expect(w.fire({ url: "https://hearth.example/_next/static/x.js", mode: "no-cors", destination: "script" })).toBeNull();
    // the epub reader's chapter frame: a navigation, but not a top-level document
    expect(w.fire({ url: "blob:https://hearth.example/abc", mode: "navigate", destination: "iframe" })).toBeNull();
    expect(w.fire(nav("https://elsewhere.example/"))).toBeNull();
  });
});
