import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/require-session", () => ({ requireSession: async () => null }));
import { causeLine, orderHistory, paceLine, replacedBy, statusLine } from "../basins";
import type { BasinLine } from "../halseth";

const NOW = new Date("2026-11-06T18:00:00Z");
const line = (o: Partial<BasinLine>): BasinLine => ({
  id: "x", name: "n", status: "live", created_at: "2026-11-01 00:00:00", cause_kind: null, cause_ref: null, revised_by: null,
  witnessed_by: null, witnessed_at: null, supersedes: null, superseded_by: null, superseded_at: null, revision_note: null, ...o,
});

describe("basins shaping", () => {
  it("names the cause in plain words, and nothing for an original basin", () => {
    expect(causeLine({ cause_kind: "refusal", cause_ref: "abcdef0123456789" })).toBe("from a refusal (abcdef01)");
    expect(causeLine({ cause_kind: null, cause_ref: null })).toBe("");
  });
  it("status lines for each state", () => {
    expect(statusLine(line({ status: "awaiting_witness", created_at: "2026-11-05T10:00:00Z" }), NOW)).toContain("waiting for your witness");
    expect(statusLine(line({ status: "declined", created_at: "2026-11-05T10:00:00Z", witnessed_at: "2026-11-06T10:00:00Z" }), NOW)).toContain("declined");
    expect(statusLine(line({ status: "superseded", superseded_at: "2026-11-05T10:00:00Z" }), NOW)).toContain("Held until");
  });
  it("awaiting rows sort first, then newest", () => {
    const h = [line({ id: "a", status: "superseded", created_at: "2026-11-03" }), line({ id: "b", status: "awaiting_witness", created_at: "2026-10-01" }), line({ id: "c", status: "declined", created_at: "2026-11-04" })];
    expect(orderHistory(h).map((b) => b.id)).toEqual(["b", "c", "a"]);
  });
  it("finds the live row an awaiting revision replaces", () => {
    expect(replacedBy(line({ supersedes: "old" }), [line({ id: "old" }), line({ id: "z" })])?.id).toBe("old");
    expect(replacedBy(line({ supersedes: "gone" }), [line({ id: "z" })])).toBeNull();
  });
  it("pace line carries the window date when closed", () => {
    expect(paceLine(30, null, NOW)).toBe("One revision at most every 30 days.");
    expect(paceLine(7, "2026-11-12T00:00:00Z", NOW)).toContain("The next opens Nov");
    expect(paceLine(0, null, NOW)).toBe("");
  });
});

describe("witness proxy route", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const post = async (body: unknown) => {
    const { POST } = await import("../../app/api/basin-witness/route");
    return POST(new Request("http://x/api/basin-witness", { method: "POST", body: JSON.stringify(body) }) as never);
  };
  it("rejects a bad id or decision before any Halseth call", async () => {
    vi.stubEnv("HALSETH_URL", "http://h");
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect((await post({ id: "nope", decision: "witness" })).status).toBe(400);
    expect((await post({ id: "a".repeat(32), decision: "maybe" })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("forwards to the witness endpoint with the admin bearer and no companion fields", async () => {
    vi.stubEnv("HALSETH_URL", "http://h"); vi.stubEnv("HALSETH_SECRET", "sek");
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })); vi.stubGlobal("fetch", f);
    const id = "a".repeat(32);
    const res = await post({ id, decision: "decline", note: "later" });
    expect(res.status).toBe(200);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://h/mind/basins/${id}/witness`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sek");
    expect(JSON.parse(String(init.body))).toEqual({ decision: "decline", note: "later" });
  });
});
