import { describe, it, expect, vi } from "vitest";
import { createWriteQueue, unsavedLine, unsavedCount, STORAGE_KEY, type QueueDeps, type QueuedWrite } from "../write-queue";

type FakeRes = { status?: number; redirected?: boolean; notJson?: boolean };

function harness(opts: { storage?: "null" | "throws" | Record<string, string>; status?: number; reject?: boolean } = {}) {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const store: Record<string, string> = typeof opts.storage === "object" ? opts.storage : {};
  const respond = (r: FakeRes = {}) => {
    const status = r.status ?? opts.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      redirected: r.redirected ?? false,
      json: async () => {
        if (r.notJson) throw new SyntaxError("Unexpected token <");
        return { ok: true };
      },
    } as unknown as Response;
  };
  const fetchMock = vi.fn(async (_url: unknown, _init?: unknown) => {
    if (opts.reject) throw new Error("offline");
    return respond();
  });
  const storage =
    opts.storage === "null"
      ? null
      : opts.storage === "throws"
        ? ({
            getItem: () => { throw new Error("denied"); },
            setItem: () => { throw new Error("denied"); },
            removeItem: () => { throw new Error("denied"); },
          } as unknown as QueueDeps["storage"])
        : {
            getItem: (k: string) => (k in store ? store[k] : null),
            setItem: (k: string, v: string) => { store[k] = v; },
            removeItem: (k: string) => { delete store[k]; },
          };
  const deps: QueueDeps = {
    fetch: fetchMock as unknown as typeof fetch,
    storage,
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (h) => { timers.delete(h as number); },
  };
  const advance = async (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) { timers.delete(id); t.fn(); }
    }
    await Promise.resolve();
  };
  return { deps, fetchMock, store, advance, respond, queue: createWriteQueue(deps) };
}

const spoons = (n: number): QueuedWrite => ({ key: "spoons", url: "/api/spoons", method: "POST", body: { spoons: n } });

describe("write-queue", () => {
  it("sends after grace", async () => {
    const h = harness();
    const p = h.queue.submit(spoons(4));
    await h.advance(4999);
    expect(h.fetchMock).not.toHaveBeenCalled();
    await h.advance(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    const r = await p.done;
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(h.store[STORAGE_KEY]).toBeUndefined();
  });

  it("undo inside window sends nothing", async () => {
    const h = harness();
    const p = h.queue.submit(spoons(4));
    expect(JSON.parse(h.store[STORAGE_KEY])).toHaveLength(1);
    await h.advance(2000);
    p.undo();
    await h.advance(10000);
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(await p.done).toBe("undone");
    expect(h.store[STORAGE_KEY]).toBeUndefined();
  });

  it("replaces pending write with same key", async () => {
    const h = harness();
    const a = h.queue.submit(spoons(4));
    const b = h.queue.submit(spoons(7));
    expect(await a.done).toBe("undone");
    await h.advance(5000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((h.fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ spoons: 7 });
    expect(await b.done).toMatchObject({ ok: true });
  });

  it("flushes on hide with keepalive and does not double-send", async () => {
    const h = harness();
    const p = h.queue.submit(spoons(4));
    await h.advance(1000);
    h.queue.flush();
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect((h.fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true);
    await h.advance(10000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(await p.done).toMatchObject({ ok: true });
  });

  it("undo after send is a no-op", async () => {
    const h = harness();
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    p.undo();
    expect(await p.done).toMatchObject({ ok: true });
  });

  it("restores unsent writes; a 502 stays failed and stored", async () => {
    const w = spoons(5);
    const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify([w]) }, status: 502 });
    await h.queue.restore();
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.queue.failed()).toEqual([w]);
    expect(JSON.parse(h.store[STORAGE_KEY])).toEqual([w]);
  });

  it("restore clears storage on success", async () => {
    const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify([spoons(5)]) } });
    await h.queue.restore();
    expect(h.queue.failed()).toEqual([]);
    expect(h.store[STORAGE_KEY]).toBeUndefined();
  });

  it("network error resolves status 0 and keeps the write for retry", async () => {
    const h = harness({ reject: true });
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    expect(await p.done).toEqual({ ok: false, status: 0, json: null });
    expect(h.queue.failed()).toHaveLength(1);
    expect(h.store[STORAGE_KEY]).toBeDefined();
  });

  it("storage null still works", async () => {
    const h = harness({ storage: "null" });
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    expect(await p.done).toMatchObject({ ok: true });
    await expect(h.queue.restore()).resolves.toBeUndefined();
  });

  it("throwing storage behaves like null", async () => {
    const h = harness({ storage: "throws" });
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    expect(await p.done).toMatchObject({ ok: true });
    await expect(h.queue.restore()).resolves.toBeUndefined();
  });

  it("a failed in-flight send never resurrects over a newer resubmit", async () => {
    const h = harness();
    let rejectFirst!: () => void;
    h.fetchMock.mockImplementationOnce(
      () => new Promise<Response>((_, rej) => { rejectFirst = () => rej(new Error("offline")); }),
    );
    const first = h.queue.submit(spoons(4));
    await h.advance(5000); // first now in flight, fetch pending
    const second = h.queue.submit(spoons(7));
    rejectFirst();
    expect(await first.done).toMatchObject({ ok: false, status: 0 });
    expect(h.queue.failed()).toEqual([]);
    expect(JSON.parse(h.store[STORAGE_KEY])).toEqual([spoons(7)]);
    await h.advance(5000);
    expect(await second.done).toMatchObject({ ok: true });
    expect(h.store[STORAGE_KEY]).toBeUndefined();
  });

  it("restore collapses duplicate keys keeping the last", async () => {
    const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify([spoons(4), spoons(7)]) } });
    await h.queue.restore();
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((h.fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ spoons: 7 });
  });

  it("restore drops stored writes with a bad method or non-relative url", async () => {
    const bad = [
      { key: "a", url: "https://evil.example/x", method: "POST" },
      { key: "b", url: "/api/x", method: "GET" },
      { key: "c", url: "api/x", method: "POST" },
    ];
    const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify([...bad, spoons(1)]) } });
    await h.queue.restore();
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.fetchMock.mock.calls[0][0]).toBe("/api/spoons");
  });

  it("calls fetch and timers unbound (no Illegal invocation)", async () => {
    const h = harness();
    const guard = <A extends unknown[], R>(fn: (...a: A) => R) =>
      function (this: unknown, ...a: A): R {
        if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
        return fn(...a);
      };
    const deps: QueueDeps = {
      fetch: guard(h.deps.fetch) as typeof fetch,
      storage: h.deps.storage,
      setTimeout: guard(h.deps.setTimeout),
      clearTimeout: guard(h.deps.clearTimeout),
    };
    const q = createWriteQueue(deps);
    const p = q.submit(spoons(4));
    await h.advance(5000);
    expect(await p.done).toMatchObject({ ok: true, status: 200 });
    const p2 = q.submit(spoons(5));
    p2.undo();
    expect(await p2.done).toBe("undone");
  });
  it("a 4xx (not 408/429) resolves ok:false once, marked dropped, and is not kept for retry", async () => {
    const h = harness({ status: 404 });
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    expect(await p.done).toMatchObject({ ok: false, status: 404, dropped: true });
    expect(h.queue.failed()).toEqual([]);
    expect(h.store[STORAGE_KEY]).toBeUndefined();
  });

  it("408 and 429 stay retryable", async () => {
    for (const status of [408, 429]) {
      const h = harness({ status });
      const p = h.queue.submit(spoons(4));
      await h.advance(5000);
      const r = await p.done;
      expect(r).toMatchObject({ ok: false, status });
      expect((r as { dropped?: boolean }).dropped).toBeUndefined();
      expect(h.queue.failed()).toHaveLength(1);
    }
  });

  it("a stored 4xx is dropped from storage on restore", async () => {
    const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify([spoons(5)]) }, status: 400 });
    await h.queue.restore();
    expect(h.queue.failed()).toEqual([]);
    expect(h.store[STORAGE_KEY]).toBeUndefined();
  });

  it("a redirected response (expired session -> /login) is a failure, kept for retry", async () => {
    const h = harness();
    h.fetchMock.mockImplementationOnce(async () => h.respond({ status: 200, redirected: true }));
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    expect(await p.done).toMatchObject({ ok: false, status: 200 });
    expect(h.queue.failed()).toHaveLength(1);
  });

  it("a 200 that is not JSON (an HTML page) is a failure, kept for retry", async () => {
    const h = harness();
    h.fetchMock.mockImplementationOnce(async () => h.respond({ status: 200, notJson: true }));
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    expect(await p.done).toMatchObject({ ok: false, status: 200 });
    expect(h.queue.failed()).toHaveLength(1);
  });

  it("restore rejects protocol-relative // urls", async () => {
    const bad = { key: "a", url: "//evil.example/x", method: "POST" };
    const h = harness({ storage: { [STORAGE_KEY]: JSON.stringify([bad, spoons(1)]) } });
    await h.queue.restore();
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.fetchMock.mock.calls[0][0]).toBe("/api/spoons");
  });

  it("discard(key) removes a failed stored write so it is never retried", async () => {
    const h = harness({ reject: true });
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    await p.done;
    expect(h.queue.failed()).toHaveLength(1);
    h.queue.discard("spoons");
    expect(h.queue.failed()).toEqual([]);
    expect(h.store[STORAGE_KEY]).toBeUndefined();
  });

  it("discard(key) cancels a waiting write and stops an in-flight one from recording failure", async () => {
    const h = harness();
    const waiting = h.queue.submit(spoons(4));
    h.queue.discard("spoons");
    expect(await waiting.done).toBe("undone");
    let rejectIt!: () => void;
    h.fetchMock.mockImplementationOnce(() => new Promise<Response>((_, rej) => { rejectIt = () => rej(new Error("offline")); }));
    const flying = h.queue.submit(spoons(5));
    await h.advance(5000);
    h.queue.discard("spoons");
    rejectIt();
    expect(await flying.done).toMatchObject({ ok: false, status: 0 });
    expect(h.queue.failed()).toEqual([]);
    expect(h.store[STORAGE_KEY]).toBeUndefined();
    await h.advance(10000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pending.waiting() is true only inside the grace window", async () => {
    const h = harness();
    const p = h.queue.submit(spoons(4));
    expect(p.waiting()).toBe(true);
    await h.advance(5000);
    expect(p.waiting()).toBe(false);
    const u = h.queue.submit(spoons(6));
    u.undo();
    expect(u.waiting()).toBe(false);
  });

  it("subscribe fires when failed() changes, and unsubscribe stops it", async () => {
    const h = harness({ reject: true, storage: "null" }); // fires without storage too
    const seen: number[] = [];
    const off = h.queue.subscribe(() => seen.push(h.queue.failed().length));
    const p = h.queue.submit(spoons(4));
    await h.advance(5000);
    await p.done;
    expect(seen.at(-1)).toBe(1);
    h.queue.discard("spoons");
    expect(seen.at(-1)).toBe(0);
    off();
    const n = seen.length;
    h.queue.submit(spoons(5));
    expect(seen.length).toBe(n);
  });
});

describe("unsavedLine", () => {
  it("is empty at 0 and counts honestly otherwise", () => {
    expect(unsavedLine(0)).toBe("");
    expect(unsavedLine(1)).toBe("1 thing didn’t save. I’ll retry next time Hearth opens.");
    expect(unsavedLine(3)).toBe("3 things didn’t save. I’ll retry next time Hearth opens.");
  });
});

describe("unsavedCount", () => {
  it("leaves out the failures the strip is already showing", () => {
    expect(unsavedCount(["spoons", "spoons-undo-a", "pin"], ["spoons"])).toBe(2);
    expect(unsavedCount(["spoons-word-b"], ["spoons-word-b"])).toBe(0);
    expect(unsavedCount(["spoons"], [])).toBe(1); // a restored failure from an earlier visit still counts
  });
});
