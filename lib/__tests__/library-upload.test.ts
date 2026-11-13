import { describe, it, expect } from "vitest";
import { uploadBook } from "../library-upload";

type Call = { url: string; init?: RequestInit };

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return new Response(JSON.stringify(next.body), { status: next.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const TICKET = { status: 200, body: { upload_url: "https://halseth.example/mind/books/upload", ticket: "abc.def" } };

describe("uploadBook", () => {
  it("gets a ticket, then PUTs the raw file straight to Halseth (never /api/library/upload)", async () => {
    const { impl, calls } = fakeFetch([TICKET, { status: 201, body: { book: { id: "b1" } } }]);
    const file = new File([new Uint8Array(6_000_000)], "Big Book.pdf", { type: "application/pdf" });
    expect(await uploadBook(file, false, impl)).toEqual({ kind: "ok" });

    expect(calls[0]!.url).toBe("/api/library/upload-ticket");
    const put = new URL(calls[1]!.url);
    expect(put.origin + put.pathname).toBe("https://halseth.example/mind/books/upload");
    expect(put.searchParams.get("ticket")).toBe("abc.def");
    expect(put.searchParams.get("filename")).toBe("Big Book.pdf");
    expect(put.searchParams.has("replace")).toBe(false);
    expect(calls[1]!.init?.method).toBe("PUT");
    expect(calls[1]!.init?.body).toBe(file);
  });

  it("a 409 is a conflict carrying Halseth's hint; the replace retry mints a fresh ticket", async () => {
    const { impl, calls } = fakeFetch([
      TICKET, { status: 409, body: { error: "book already in the library", hint: "pass replace=true to overwrite" } },
      TICKET, { status: 201, body: {} },
    ]);
    const file = new File(["x"], "a.epub");
    expect(await uploadBook(file, false, impl)).toEqual({ kind: "conflict", message: "pass replace=true to overwrite" });
    expect(await uploadBook(file, true, impl)).toEqual({ kind: "ok" });
    expect(calls.filter(c => c.url === "/api/library/upload-ticket")).toHaveLength(2);
    expect(new URL(calls[3]!.url).searchParams.get("replace")).toBe("true");
    expect((calls[3]!.init?.headers as Record<string, string>)["Content-Type"]).toBe("application/epub+zip");
  });

  it("names the reason when Halseth refuses, and says so when the ticket can't be had", async () => {
    let f = fakeFetch([TICKET, { status: 401, body: { error: "upload ticket refused", reason: "expired" } }]);
    expect(await uploadBook(new File(["x"], "a.pdf"), false, f.impl))
      .toEqual({ kind: "error", message: "upload ticket refused (expired)" });

    f = fakeFetch([{ status: 503, body: { error: "uploads are not configured (UPLOAD_TICKET_SECRET unset)" } }]);
    const res = await uploadBook(new File(["x"], "a.pdf"), false, f.impl);
    expect(res).toEqual({ kind: "error", message: "could not start upload: uploads are not configured (UPLOAD_TICKET_SECRET unset)" });
    expect(f.calls).toHaveLength(1);
  });

  it("413 reports the limit", async () => {
    const { impl } = fakeFetch([TICKET, { status: 413, body: { error: "file too large", max_bytes: 100_000_000 } }]);
    expect(await uploadBook(new File(["x"], "a.pdf"), false, impl)).toEqual({ kind: "error", message: "too large (limit 100 MB)" });
  });

  it("a thrown fetch (CORS block, offline) is a network error, not a crash", async () => {
    const impl = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect(await uploadBook(new File(["x"], "a.pdf"), false, impl)).toEqual({ kind: "error", message: "network error" });
  });
});
