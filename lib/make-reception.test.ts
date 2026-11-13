import { describe, it, expect, vi, afterEach } from "vitest";
import { markMakeSeen, shouldSignalSeen } from "./make-reception";

const ID = "a".repeat(32);

describe("shouldSignalSeen", () => {
  it("fires for the file and the source, never the grid preview", () => {
    expect(shouldSignalSeen("file", null)).toBe(true);
    expect(shouldSignalSeen("source", null)).toBe(true);
    expect(shouldSignalSeen("preview", null)).toBe(false);
  });
  it("fires on the first byte range, not a mid-stream seek", () => {
    expect(shouldSignalSeen("file", "bytes=0-")).toBe(true);
    expect(shouldSignalSeen("file", "bytes=0-1023")).toBe(true);
    expect(shouldSignalSeen("file", "bytes=500000-")).toBe(false);
  });
  it("the player and page routes pass no `which` and always signal", () => {
    expect(shouldSignalSeen(null, null)).toBe(true);
  });
});

describe("markMakeSeen", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("posts the seen signal with the server-side secret", async () => {
    vi.stubEnv("HALSETH_URL", "https://h.example");
    vi.stubEnv("HALSETH_SECRET", "sek");
    const f = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", f);
    await markMakeSeen(ID);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://h.example/mind/makes/${ID}/reception`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sek");
    expect(JSON.parse(init.body as string)).toEqual({ signal: "seen", via: "hearth" });
    expect(init.cache).toBe("no-store");
  });

  it("swallows an unreachable Halseth, and does nothing without config or a valid id", async () => {
    vi.stubEnv("HALSETH_URL", "https://h.example");
    vi.stubEnv("HALSETH_SECRET", "sek");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(markMakeSeen(ID)).resolves.toBeUndefined();
    const f = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", f);
    await markMakeSeen("not-an-id");
    vi.stubEnv("HALSETH_SECRET", "");
    await markMakeSeen(ID);
    expect(f).not.toHaveBeenCalled();
  });
});
