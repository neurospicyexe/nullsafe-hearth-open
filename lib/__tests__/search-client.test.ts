import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSearch, searchErrorMessage } from "../search-client";

afterEach(() => vi.unstubAllGlobals());

describe("fetchSearch", () => {
  it("a 503 rejects and reads as the Halseth-down line, not an empty result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "x" }) }));
    const err = await fetchSearch("moss", "all").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(searchErrorMessage(err)).toBe("Can't reach Halseth right now.");
  });
  it("a 200 resolves with the body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ journal: [] }) }));
    await expect(fetchSearch("moss", "all")).resolves.toEqual({ journal: [] });
  });
  it("other failures read as Search unavailable", () => {
    expect(searchErrorMessage(new TypeError("net"))).toBe("Search unavailable");
  });
});
