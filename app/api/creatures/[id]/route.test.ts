// The tend proxy: Principal tends a creature from Hearth. R28 (B64 final review I4): it is a tend by hand, so the
// body carries via "hand"; without it Halseth reads the tend as autonomous and weights it a fifth.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Handlers now call requireSession first (2026-11-10); these tests exercise the handler logic, not auth
// (auth is covered in lib/require-session.test.ts).
vi.mock("@/lib/require-session", () => ({ requireSession: async () => null }));
import { NextRequest } from "next/server";
import { POST } from "./route";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  vi.stubEnv("HALSETH_URL", "https://h.test");
  vi.stubEnv("HALSETH_SECRET", "s");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ interacted: true }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const req = (body: unknown) =>
  new NextRequest("http://x/api/creatures/sol1", { method: "POST", body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/creatures/[id]", () => {
  it("sends actor principal and via hand to Halseth's interact route", async () => {
    const res = await POST(req({ action: "feed", note: "a walnut" }), ctx("sol1"));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://h.test/mind/creatures/sol1/interact");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ actor: "principal", action: "feed", via: "hand", note: "a walnut" });
  });
  it("a client cannot change the via or the actor", async () => {
    await POST(req({ action: "play", via: "autonomous", actor: "gaia" }), ctx("sol1"));
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ actor: "principal", action: "play", via: "hand" });
  });
  it("a bad action never reaches Halseth", async () => {
    const res = await POST(req({ action: "poke" }), ctx("sol1"));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
