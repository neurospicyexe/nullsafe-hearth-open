// Safety net for the library proxies (Hearth P4 Task 2). Pins what each route does today so a
// later restyle of the books pages cannot silently break them.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Handlers now call requireSession first (2026-11-10); these tests exercise the handler logic, not auth
// (auth is covered in lib/require-session.test.ts).
vi.mock("@/lib/require-session", () => ({ requireSession: async () => null }));
import { NextRequest } from "next/server";
import { POST as ticketPOST } from "./upload-ticket/route";
import { PUT as progressPUT } from "./[id]/progress/route";
import { POST as annPOST, DELETE as annDELETE } from "./[id]/annotations/route";
import { GET as coverGET } from "./[id]/cover/route";
import { GET as fileGET } from "./[id]/file/route";

type Call = { url: string; init: RequestInit & { cache?: string } };
let calls: Call[] = [];
let respond: () => Response | Promise<Response>;

beforeEach(() => {
  calls = [];
  respond = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
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

const ctx = (id = "book1") => ({ params: Promise.resolve({ id }) });
const req = (path: string, method: string, body?: unknown) =>
  new NextRequest(`http://x/api/library/${path}`, {
    method,
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
const auth = (c: Call) => (c.init.headers as Record<string, string>).Authorization;

type Case = { name: string; call: () => Promise<Response>; url: string; method: string };
const cases: Case[] = [
  { name: "upload-ticket POST", call: () => ticketPOST(), url: "https://h.test/mind/books/upload-ticket", method: "POST" },
  {
    name: "progress PUT",
    call: () => progressPUT(req("book1/progress", "PUT", { finished: true }), ctx()),
    url: "https://h.test/mind/books/book1/progress",
    method: "PUT",
  },
  {
    name: "annotations POST",
    call: () => annPOST(req("book1/annotations", "POST", { comment: "hi" }), ctx()),
    url: "https://h.test/mind/books/book1/annotations",
    method: "POST",
  },
  {
    name: "annotations DELETE",
    call: () => annDELETE(req("book1/annotations?ann_id=a1", "DELETE"), ctx()),
    url: "https://h.test/mind/books/book1/annotations/a1",
    method: "DELETE",
  },
  { name: "cover GET", call: () => coverGET(req("book1/cover", "GET"), ctx()), url: "https://h.test/mind/books/book1/cover", method: "GET" },
  { name: "file GET", call: () => fileGET(req("book1/file", "GET"), ctx()), url: "https://h.test/mind/books/book1/file", method: "GET" },
];

describe.each(cases)("$name", ({ call, url, method }) => {
  it("hits the Halseth URL with no-store and the bearer secret", async () => {
    await call();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(url);
    expect(calls[0].init.method ?? "GET").toBe(method);
    expect(calls[0].init.cache).toBe("no-store");
    expect(auth(calls[0])).toBe("Bearer s");
  });

  it("502 when fetch throws", async () => {
    respond = () => {
      throw new Error("boom");
    };
    const res = await call();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Halseth unreachable" });
  });

  it("500 when HALSETH_URL is unset, without calling upstream", async () => {
    vi.stubEnv("HALSETH_URL", "");
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "HALSETH_URL not set" });
    expect(calls).toHaveLength(0);
  });
});

describe("progress PUT", () => {
  it("forwards only the four known fields", async () => {
    const res = await progressPUT(
      req("book1/progress", "PUT", {
        current_cfi: "epubcfi(/6/2)",
        current_chapter: "Ch 3",
        progress_percent: 42.5,
        finished: false,
        author: "x",
        extra: 1,
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      current_cfi: "epubcfi(/6/2)",
      current_chapter: "Ch 3",
      progress_percent: 42.5,
      finished: false,
    });
  });

  it("drops non-boolean and non-string values", async () => {
    await progressPUT(req("book1/progress", "PUT", { progress_percent: 10, finished: "yes", current_cfi: 5 }), ctx());
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ progress_percent: 10 });
  });

  it("400 when only a non-numeric progress_percent is sent", async () => {
    const res = await progressPUT(req("book1/progress", "PUT", { progress_percent: "x" }), ctx());
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("400 on a bad id", async () => {
    const res = await progressPUT(req("a%2Fb/progress", "PUT", { finished: true }), ctx("a/b"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid id" });
    expect(calls).toHaveLength(0);
  });

  it("passes the upstream status and JSON through", async () => {
    respond = () => new Response(JSON.stringify({ error: "nope" }), { status: 404 });
    const res = await progressPUT(req("book1/progress", "PUT", { finished: true }), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "nope" });
  });
});

describe("annotations", () => {
  it("POST forces author principal and trims the comment", async () => {
    await annPOST(req("book1/annotations", "POST", { comment: "  note  ", color: "yellow", author: "drevan" }), ctx());
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ author: "principal", comment: "note", color: "yellow" });
  });

  it("POST caps selected_text at 2000 and comment at 3000", async () => {
    await annPOST(
      req("book1/annotations", "POST", { selected_text: "a".repeat(2500), comment: "b".repeat(3500) }),
      ctx(),
    );
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.selected_text).toHaveLength(2000);
    expect(sent.comment).toHaveLength(3000);
  });

  it("POST 400 when none of cfi_range/selected_text/comment", async () => {
    const res = await annPOST(req("book1/annotations", "POST", { color: "red", comment: "   " }), ctx());
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("POST 400 on a bad id", async () => {
    const res = await annPOST(req("x/annotations", "POST", { comment: "hi" }), ctx("a/b"));
    expect(res.status).toBe(400);
  });

  it("DELETE takes the annotation id from the ann_id query param", async () => {
    await annDELETE(req("book1/annotations?ann_id=ann-9", "DELETE"), ctx());
    expect(calls[0].url).toBe("https://h.test/mind/books/book1/annotations/ann-9");
  });

  it("DELETE 400 when ann_id is missing or bad", async () => {
    expect((await annDELETE(req("book1/annotations", "DELETE"), ctx())).status).toBe(400);
    expect((await annDELETE(req("book1/annotations?ann_id=a%2Fb", "DELETE"), ctx())).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("cover GET", () => {
  it("200 streams the body and keeps content-type", async () => {
    respond = () => new Response("PNGBYTES", { status: 200, headers: { "content-type": "image/png" } });
    const res = await coverGET(req("book1/cover", "GET"), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await res.text()).toBe("PNGBYTES");
  });

  it("upstream 404 gives 404 with an empty body", async () => {
    respond = () => new Response("missing", { status: 404 });
    const res = await coverGET(req("book1/cover", "GET"), ctx());
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("400 on a bad id", async () => {
    expect((await coverGET(req("x/cover", "GET"), ctx("a/b"))).status).toBe(400);
  });
});

describe("file GET", () => {
  it("200 streams the body and keeps content-type and length", async () => {
    respond = () =>
      new Response("EPUBBYTES", { status: 200, headers: { "content-type": "application/epub+zip", "content-length": "9" } });
    const res = await fileGET(req("book1/file", "GET"), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/epub+zip");
    expect(res.headers.get("content-length")).toBe("9");
    expect(await res.text()).toBe("EPUBBYTES");
  });

  it("upstream 500 gives a JSON error naming the book file", async () => {
    respond = () => new Response("bad", { status: 500 });
    const res = await fileGET(req("book1/file", "GET"), ctx());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("book file unavailable");
  });

  it("400 on a bad id", async () => {
    expect((await fileGET(req("x/file", "GET"), ctx("a/b"))).status).toBe(400);
  });
});

describe("upload-ticket POST", () => {
  it("passes upstream JSON and status through with Cache-Control no-store", async () => {
    respond = () => new Response(JSON.stringify({ upload_url: "https://h.test/up/1", ticket: "t" }), { status: 201 });
    const res = await ticketPOST();
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ upload_url: "https://h.test/up/1", ticket: "t" });
  });

  it("returns {} when upstream is not JSON, keeping the status", async () => {
    respond = () => new Response("<html>", { status: 503 });
    const res = await ticketPOST();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({});
  });
});
