// The make download proxy: validation before any upstream call, and header passthrough.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const HEX = "0123456789abcdef0123456789abcdef";
type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let respond: () => Response;

const ctx = (id: string, which: string) => ({ params: Promise.resolve({ id, which }) });
const req = (qs = "", headers: Record<string, string> = {}) =>
  new NextRequest(`https://hearth.test/api/makes/x/file${qs}`, { headers });

beforeEach(() => {
  calls = [];
  respond = () => new Response("bytes", { status: 200, headers: { "Content-Type": "image/png" } });
  vi.stubEnv("HALSETH_URL", "https://h.test");
  vi.stubEnv("HALSETH_SECRET", "sekrit");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("validation", () => {
  const badIds = ["../etc", "abc", HEX.toUpperCase(), HEX + "0", "img_" + HEX + "/x", "IMG_" + HEX, "img_img_" + HEX, `${HEX}%2f..`];
  for (const id of badIds) {
    it(`404s id ${JSON.stringify(id)} with no upstream call`, async () => {
      const res = await GET(req(), ctx(id, "file"));
      expect(res.status).toBe(404);
      expect(calls).toEqual([]);
    });
  }
  for (const which of ["", "FILE", "files", "../file", "source/x", "constructor"]) {
    it(`404s which ${JSON.stringify(which)} with no upstream call`, async () => {
      const res = await GET(req(), ctx(HEX, which));
      expect(res.status).toBe(404);
      expect(calls).toEqual([]);
    });
  }
  for (const id of [HEX, "img_" + HEX]) {
    for (const which of ["source", "file", "preview"]) {
      it(`accepts ${id.slice(0, 6)}.. / ${which}`, async () => {
        const res = await GET(req(), ctx(id, which));
        expect(res.status).toBe(200);
        expect(calls[0].url).toBe(`https://h.test/mind/makes/file/${id}/${which}`);
      });
    }
  }
});

describe("upstream request", () => {
  it("sends the bearer secret and no-store", async () => {
    await GET(req(), ctx(HEX, "file"));
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sekrit");
    expect(calls[0].init.cache).toBe("no-store");
  });
  it("passes ?inline=1 only when exactly 1", async () => {
    await GET(req("?inline=1"), ctx(HEX, "file"));
    await GET(req("?inline=yes"), ctx(HEX, "file"));
    await GET(req("?inline=1&x=../"), ctx(HEX, "file"));
    expect(calls.map((c) => c.url).filter((u) => !u.endsWith("/reception"))).toEqual([
      `https://h.test/mind/makes/file/${HEX}/file?inline=1`,
      `https://h.test/mind/makes/file/${HEX}/file`,
      `https://h.test/mind/makes/file/${HEX}/file?inline=1`,
    ]);
  });
  it("reports the view to Halseth for file and source, never for the grid preview or a mid-stream seek", async () => {
    const receptions = () => calls.filter((c) => c.url.endsWith("/reception")).length;
    await GET(req(), ctx(HEX, "file"));
    await new Promise((r) => setTimeout(r, 0));
    expect(receptions()).toBe(1);
    expect(calls.find((c) => c.url.endsWith("/reception"))!.url).toBe(`https://h.test/mind/makes/${HEX}/reception`);
    await GET(req(), ctx(HEX, "preview"));
    await GET(req("", { range: "bytes=500000-" }), ctx(HEX, "file"));
    await new Promise((r) => setTimeout(r, 0));
    expect(receptions()).toBe(1);
  });
  it("forwards Range", async () => {
    await GET(req("", { range: "bytes=0-99" }), ctx(HEX, "file"));
    expect((calls[0].init.headers as Record<string, string>).Range).toBe("bytes=0-99");
  });
});

describe("response", () => {
  it("passes Content-Type, Content-Disposition, nosniff and the CSP through unchanged", async () => {
    respond = () =>
      new Response("mp4", {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": 'attachment; filename="moss-v2.mp4"',
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    const res = await GET(req(), ctx(HEX, "file"));
    expect(res.headers.get("Content-Type")).toBe("video/mp4");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="moss-v2.mp4"');
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(await res.text()).toBe("mp4");
  });
  it("adds nosniff even when upstream omitted it", async () => {
    const res = await GET(req(), ctx(HEX, "file"));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("relays a 206 with Content-Range", async () => {
    respond = () => new Response("ab", { status: 206, headers: { "Content-Range": "bytes 0-1/10", "Accept-Ranges": "bytes" } });
    const res = await GET(req("", { range: "bytes=0-1" }), ctx(HEX, "file"));
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1/10");
  });
  it("maps upstream failure to 404, 403 stays 403, a thrown fetch is 502", async () => {
    respond = () => new Response("no", { status: 404 });
    expect((await GET(req(), ctx(HEX, "file"))).status).toBe(404);
    respond = () => new Response("no", { status: 403 });
    expect((await GET(req(), ctx(HEX, "file"))).status).toBe(403);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await GET(req(), ctx(HEX, "file"))).status).toBe(502);
  });
  it("500s without HALSETH_URL, before fetching", async () => {
    vi.stubEnv("HALSETH_URL", "");
    expect((await GET(req(), ctx(HEX, "file"))).status).toBe(500);
    expect(calls).toEqual([]);
  });
});
