// lib/rate-limit.ts
//
// Failed-login throttle for POST /api/auth. Mirrors Halseth's `src/lib/auth-throttle.ts`
// (the /oauth/authorize brake) so both doors behave the same:
//   - only FAILED attempts count; a correct passphrase clears the counter
//   - 5 failures per IP locks the IP out
//   - every failure refreshes the 15-minute TTL, so the lockout runs 15 min from the LAST failure
//   - while locked, even the correct passphrase is refused (otherwise the brake does not slow a guesser)
//
// Storage is behind `LoginThrottleStore`:
//   - durable: Upstash Redis over its REST API, used when a URL + token pair is set (see
//     `resolveRestCredentials`). Vercel's Marketplace Upstash integration injects these as
//     KV_REST_API_URL / KV_REST_API_TOKEN; a directly created Upstash DB uses
//     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Either pair works; nothing else to change.
//   - fallback: an in-memory Map. On Vercel that is per serverless instance (each cold instance
//     starts at zero), so it is a weak brake. It is also what we drop to if the durable store
//     errors: never "no limit", never "lock the owner out because Redis blinked".
//
// Node runtime only (route handlers). Do not import from middleware.ts.

export const LOGIN_FAIL_LIMIT = 5;
export const LOGIN_FAIL_WINDOW_S = 15 * 60;

const keyFor = (ip: string) => `hearth-login-fail:${ip}`;

export interface LoginThrottleStore {
  readonly kind: "memory" | "upstash";
  /** Current failure count for the key (0 when absent or expired). */
  get(key: string): Promise<number>;
  /** Increments the count and (re)sets its TTL to `ttlS` seconds; returns the new count. */
  increment(key: string, ttlS: number): Promise<number>;
  clear(key: string): Promise<void>;
}

// ── memory store ─────────────────────────────────────────────────────────────

export class MemoryThrottleStore implements LoginThrottleStore {
  readonly kind = "memory" as const;
  private entries = new Map<string, { count: number; expiresAt: number }>();

  async get(key: string): Promise<number> {
    const e = this.entries.get(key);
    if (!e) return 0;
    if (Date.now() >= e.expiresAt) {
      this.entries.delete(key);
      return 0;
    }
    return e.count;
  }

  async increment(key: string, ttlS: number): Promise<number> {
    const count = (await this.get(key)) + 1;
    this.entries.set(key, { count, expiresAt: Date.now() + ttlS * 1000 });
    return count;
  }

  async clear(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

// ── Upstash REST store ───────────────────────────────────────────────────────

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const UPSTASH_TIMEOUT_MS = 2000;

export class UpstashThrottleStore implements LoginThrottleStore {
  readonly kind = "upstash" as const;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  /** POSTs a command array to `path` ("" for one command, "/multi-exec" for a transaction). */
  private async call(path: string, body: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`${this.url.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`upstash ${path || "/"} HTTP ${res.status}`);
    return res.json();
  }

  private static resultOf(item: unknown): unknown {
    if (item && typeof item === "object") {
      const o = item as { result?: unknown; error?: unknown };
      if (o.error) throw new Error(`upstash error: ${String(o.error)}`);
      return o.result;
    }
    throw new Error("upstash: malformed response");
  }

  async get(key: string): Promise<number> {
    const raw = UpstashThrottleStore.resultOf(await this.call("", ["GET", key]));
    const n = raw == null ? 0 : parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : 0;
  }

  async increment(key: string, ttlS: number): Promise<number> {
    // MULTI/EXEC so INCR and EXPIRE land together (unlike /pipeline, which is not atomic);
    // INCR is atomic itself, so parallel guesses cannot undercount the way a KV read-modify-write can.
    const out = await this.call("/multi-exec", [
      ["INCR", key],
      ["EXPIRE", key, String(ttlS)],
    ]);
    if (!Array.isArray(out) || out.length < 1) throw new Error("upstash: malformed multi-exec response");
    const n = Number(UpstashThrottleStore.resultOf(out[0]));
    if (out[1] !== undefined) UpstashThrottleStore.resultOf(out[1]);
    if (!Number.isFinite(n)) throw new Error("upstash: INCR returned non-number");
    return n;
  }

  async clear(key: string): Promise<void> {
    UpstashThrottleStore.resultOf(await this.call("", ["DEL", key]));
  }
}

// ── store selection ──────────────────────────────────────────────────────────

type EnvLike = Record<string, string | undefined>;

/** Returns the first complete URL + token pair, or null. Names only; values never logged. */
export function resolveRestCredentials(env: EnvLike): { url: string; token: string } | null {
  const pairs: Array<[string, string]> = [
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ];
  for (const [u, t] of pairs) {
    const url = env[u]?.trim();
    const token = env[t]?.trim();
    if (url && token) return { url, token };
  }
  return null;
}

const memoryFallback = new MemoryThrottleStore();
let storeOverride: LoginThrottleStore | null = null;
let cachedStore: LoginThrottleStore | null = null;

export function getLoginThrottleStore(env: EnvLike = process.env): LoginThrottleStore {
  if (storeOverride) return storeOverride;
  if (cachedStore) return cachedStore;
  const creds = resolveRestCredentials(env);
  cachedStore = creds ? new UpstashThrottleStore(creds.url, creds.token) : memoryFallback;
  return cachedStore;
}

let warned = false;
/** Runs `op` on the primary store; on any error, logs once-ish and runs it on the memory fallback. */
async function withFallback<T>(op: (s: LoginThrottleStore) => Promise<T>): Promise<T> {
  const store = getLoginThrottleStore();
  if (store === memoryFallback) return op(memoryFallback);
  try {
    return await op(store);
  } catch (err) {
    if (!warned) {
      console.error("[rate-limit] durable store failed, using in-memory fallback:", (err as Error).message);
      warned = true;
    }
    return op(memoryFallback);
  }
}

// ── public API (route handler) ───────────────────────────────────────────────

export async function isLoginBlocked(ip: string): Promise<boolean> {
  const n = await withFallback((s) => s.get(keyFor(ip)));
  return n >= LOGIN_FAIL_LIMIT;
}

export async function recordLoginFailure(ip: string): Promise<number> {
  return withFallback((s) => s.increment(keyFor(ip), LOGIN_FAIL_WINDOW_S));
}

export async function clearLoginFailures(ip: string): Promise<void> {
  await withFallback((s) => s.clear(keyFor(ip)));
}

/** Test-only: swap in a store (or null to restore env selection) and wipe the memory fallback. */
export function __setStoreForTests(store: LoginThrottleStore | null): void {
  storeOverride = store;
  cachedStore = null;
  warned = false;
  (memoryFallback as unknown as { entries: Map<string, unknown> }).entries.clear();
}

/**
 * Derives the client IP from request headers (Next 15 removed `request.ip`).
 *
 * Vercel's edge OVERWRITES x-forwarded-for / x-real-ip / x-vercel-forwarded-for with the real
 * connecting IP and does not forward client-supplied values (docs: "Request headers"), so on Vercel
 * all three carry one trustworthy address. x-vercel-forwarded-for is preferred because it survives
 * a proxy placed in front of Vercel. The x-forwarded-for fallback takes the LAST entry: on Vercel
 * the list has one entry (first == last), and anywhere else the first entry is client-supplied
 * (an attacker could prepend values to get a fresh bucket per request) while the last is the one
 * the nearest proxy appended.
 */
export function getClientKey(headers: { get(name: string): string | null }): string {
  return (
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown"
  );
}
