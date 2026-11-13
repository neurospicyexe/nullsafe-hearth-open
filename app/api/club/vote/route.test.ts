// The vote proxy: POST casts Principal's vote, DELETE withdraws it. The voter is always Principal here,
// whatever the client sends.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Handlers now call requireSession first (2026-11-10); these tests exercise the handler logic, not auth
// (auth is covered in lib/require-session.test.ts).
vi.mock("@/lib/require-session", () => ({ requireSession: async () => null }));
import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";

type Call = { url: string; init: RequestInit & { cache?: string } };
let calls: Call[] = [];
let respond: () => Response | Promise<Response>;

beforeEach(() => {
  calls = [];
  respond = () => new Response(JSON.stringify({ withdrawn: true, round_id: "r1" }), { status: 200 });
  vi.stubEnv("HALSETH_URL", "https://h.test");
  vi.stubEnv("HALSETH_SECRET", "s");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: Call["init"]) => {
      calls.push({ url, init });
      return respond();
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const req = (method: string, body?: unknown) =>
  new NextRequest("http://x/api/club/vote", {
    method,
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });

describe("DELETE /api/club/vote", () => {
  it("always withdraws Principal's vote, ignoring a client-sent voter", async () => {
    const res = await DELETE(req("DELETE", { voter: "gaia" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ withdrawn: true, round_id: "r1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://h.test/mind/club/vote");
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.cache).toBe("no-store");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ voter: "principal" });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer s");
  });

  it("works with no body at all", async () => {
    const res = await DELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ voter: "principal" });
  });

  it("passes Halseth's 409 status and error text through", async () => {
    respond = () => new Response(JSON.stringify({ error: "no round is accepting votes" }), { status: 409 });
    const res = await DELETE(req("DELETE", {}));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no round is accepting votes" });
  });

  it("answers 502 when Halseth cannot be reached", async () => {
    respond = () => { throw new Error("down"); };
    const res = await DELETE(req("DELETE", {}));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Halseth unreachable" });
  });

  it("answers 500 when HALSETH_URL is not set", async () => {
    vi.stubEnv("HALSETH_URL", "");
    const res = await DELETE(req("DELETE", {}));
    expect(res.status).toBe(500);
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/club/vote", () => {
  it("casts Principal's vote for the pick", async () => {
    respond = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    const res = await POST(req("POST", { recommendation_id: "rec2", voter: "gaia" }));
    expect(res.status).toBe(200);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ recommendation_id: "rec2", voter: "principal", reason: null });
  });

  it("refuses a missing pick without calling Halseth", async () => {
    const res = await POST(req("POST", {}));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
