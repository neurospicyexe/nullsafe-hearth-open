import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { requireSession } from "./require-session";
import { signSession, SESSION_COOKIE } from "./session";
import { isValidId } from "./valid-id";
import { config } from "../middleware";

const SECRET = "test-secret-123";
const req = (cookie?: string) =>
  new Request("http://x/api/y", { method: "PATCH", headers: cookie ? { cookie } : {} });

describe("requireSession", () => {
  const prev = process.env.DASHBOARD_SECRET;
  beforeEach(() => { process.env.DASHBOARD_SECRET = SECRET; });
  afterEach(() => { process.env.DASHBOARD_SECRET = prev; if (prev === undefined) delete process.env.DASHBOARD_SECRET; });

  it("rejects a missing cookie", async () => {
    const r = await requireSession(req());
    expect(r?.status).toBe(401);
  });
  it("rejects a junk or wrongly signed cookie", async () => {
    expect((await requireSession(req(`${SESSION_COOKIE}=junk`)))?.status).toBe(401);
    const other = await signSession("other-secret");
    expect((await requireSession(req(`${SESSION_COOKIE}=${other}`)))?.status).toBe(401);
  });
  it("accepts a valid session cookie", async () => {
    const t = await signSession(SECRET);
    expect(await requireSession(req(`a=b; ${SESSION_COOKIE}=${t}`))).toBeNull();
  });
  it("fails closed with no DASHBOARD_SECRET", async () => {
    delete process.env.DASHBOARD_SECRET;
    expect((await requireSession(req()))?.status).toBe(401);
  });
  it("falls back to next/headers cookies when no request is given", async () => {
    expect((await requireSession())?.status).toBe(401);
  });
});

describe("middleware matcher: static extensions never exempt /api", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  it("protects /api paths ending in an image extension", () => {
    for (const p of ["/api/x/zz.png", "/api/biometrics/zz.png", "/api/metronome/a.svg", "/api/tasks/x.webp", "/api/a/b.JPG".toLowerCase()]) {
      expect(matcher.test(p), p).toBe(true);
    }
  });
  it("still exempts real static images outside /api", () => {
    for (const p of ["/logo.png", "/img/a.svg", "/icon.png"]) expect(matcher.test(p), p).toBe(false);
  });
});

describe("isValidId", () => {
  it("accepts uuids and slugs", () => {
    for (const id of ["0b7c6f1e-3a2d-4c5b-9e8f-1a2b3c4d5e6f", "abc_123"]) expect(isValidId(id)).toBe(true);
  });
  it("rejects junk", () => {
    for (const id of ["", "../x", "a/b", "a b", "a?b=1", "x%2e", "a".repeat(129), "zz.png", undefined, 5]) {
      expect(isValidId(id), String(id)).toBe(false);
    }
  });
});
