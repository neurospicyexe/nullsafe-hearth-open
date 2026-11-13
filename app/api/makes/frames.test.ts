// The two make-frame routes: validated id, source fetched server-side, route-specific CSP, and the
// global header policy stays strict everywhere else.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as playerGET } from "./player/route";
import { GET as pageGET } from "./page/route";
import nextConfig from "../../../next.config";

const HEX = "0123456789abcdef0123456789abcdef";
let calls: string[] = [];
let body: string | null;

const req = (id: string) => new NextRequest(`https://hearth.test/api/makes/x?id=${encodeURIComponent(id)}`);

beforeEach(() => {
  calls = [];
  body = 's("bd*4")';
  vi.stubEnv("HALSETH_URL", "https://h.test");
  vi.stubEnv("HALSETH_SECRET", "sekrit");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return body === null ? new Response("no", { status: 404 }) : new Response(body, { status: 200 });
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

for (const [name, GET] of [["player", playerGET], ["page", pageGET]] as const) {
  describe(name, () => {
    for (const id of ["", "abc", "img_" + HEX, HEX.toUpperCase(), HEX + "0", "../x"]) {
      it(`404s id ${JSON.stringify(id)} with no upstream call`, async () => {
        expect((await GET(req(id))).status).toBe(404);
        expect(calls).toEqual([]);
      });
    }
    it("404s when Halseth has no source", async () => {
      body = null;
      expect((await GET(req(HEX))).status).toBe(404);
    });
    it("fetches the source by id and serves html with nosniff, SAMEORIGIN framing and a sandboxing CSP", async () => {
      const res = await GET(req(HEX));
      // The view also reports reception (Principal opened it) to Halseth, detached; it is the only other call.
      expect(calls.filter((u) => !u.endsWith("/reception"))).toEqual([`https://h.test/mind/makes/file/${HEX}/source`]);
      await new Promise((r) => setTimeout(r, 0));
      expect(calls).toContain(`https://h.test/mind/makes/${HEX}/reception`);
      expect(res.headers.get("Content-Type")).toContain("text/html");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
      const csp = res.headers.get("Content-Security-Policy")!;
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("sandbox allow-scripts");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).not.toContain("allow-same-origin");
    });
  });
}

describe("CSP per route", () => {
  it("page: inline script and style and data images only, no network", async () => {
    const csp = (await pageGET(req(HEX))).headers.get("Content-Security-Policy")!;
    expect(csp).toContain("script-src 'unsafe-inline';");
    expect(csp).toContain("style-src 'unsafe-inline';");
    expect(csp).toContain("img-src data:");
    expect(csp).not.toContain("connect-src");
    expect(csp).not.toContain("unpkg");
  });
  it("player: unpkg for the script, sample hosts for connect, and a pattern that cannot break out", async () => {
    body = "s('bd')</script><script>alert(1)</script>";
    const res = await playerGET(req(HEX));
    const csp = res.headers.get("Content-Security-Policy")!;
    // Strudel compiles patterns with eval and loads its worklet from data:; without both nothing sounds.
    expect(csp).toContain("script-src 'unsafe-inline' 'unsafe-eval' blob: data: https://unpkg.com");
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).toContain("connect-src https://unpkg.com https://raw.githubusercontent.com https://strudel.b-cdn.net");
    const doc = await res.text();
    expect(doc).toContain("https://unpkg.com/@strudel/web@1.1.0");
    expect(doc).not.toContain("</script><script>alert(1)");
    // evaluate() never rejects, so a broken pattern must surface through onEvalError, not read "playing".
    expect(doc).toContain("onEvalError");
    expect(doc).toContain('samples("github:tidalcycles/dirt-samples")');
  });
});

describe("next.config global headers", () => {
  it("do not apply to the two frame routes, still apply elsewhere, and carry no unpkg", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    const re = new RegExp(`^${rules[0].source}$`);
    expect(re.test("/api/makes/player")).toBe(false);
    expect(re.test("/api/makes/page")).toBe(false);
    for (const p of ["/", `/api/makes/${HEX}/file`, "/api/makes/player/x", "/companions/cypher/made", "/api/makes/pages"]) {
      expect(re.test(p)).toBe(true);
    }
    const csp = rules[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).not.toContain("unpkg");
    expect(csp).toContain("script-src 'self' 'unsafe-inline';");
  });
});
