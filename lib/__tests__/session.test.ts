import { describe, it, expect, vi, afterEach } from "vitest";
import {
  signSession, verifySession, sessionNeedsRenewal, SESSION_COOKIE_OPTIONS, SESSION_RENEW_AFTER_MS,
} from "../session.js";

describe("sliding session (home-screen app, 2026-10-27)", () => {
  afterEach(() => vi.useRealTimers());
  const DAY = 24 * 60 * 60 * 1000;

  it("a fresh token is not renewed; a day-old one is", async () => {
    const token = await signSession("s");
    expect(sessionNeedsRenewal(token)).toBe(false);
    expect(sessionNeedsRenewal(token, Date.now() + SESSION_RENEW_AFTER_MS + 1000)).toBe(true);
  });

  it("daily use keeps it alive past 30 days; a month idle still expires it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    let token = await signSession("s");
    for (let day = 1; day <= 45; day++) {
      vi.setSystemTime(new Date(Date.parse("2026-10-01T12:00:00Z") + day * DAY));
      expect(await verifySession(token, "s")).toBe(true);
      if (sessionNeedsRenewal(token)) token = await signSession("s");
    }
    vi.setSystemTime(new Date(Date.now() + 31 * DAY));
    expect(await verifySession(token, "s")).toBe(false);
  });

  it("a malformed token never asks for renewal", () => {
    expect(sessionNeedsRenewal("garbage")).toBe(false);
  });

  it("cookie stays server-only (httpOnly, secure) and is lax, not strict, so links arrive signed in", () => {
    expect(SESSION_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  });
});

describe("signSession / verifySession", () => {
  it("a freshly signed session verifies against the same secret", async () => {
    const token = await signSession("my-secret");
    expect(await verifySession(token, "my-secret")).toBe(true);
  });

  it("does not verify against a different secret", async () => {
    const token = await signSession("my-secret");
    expect(await verifySession(token, "wrong-secret")).toBe(false);
  });

  it("rejects an undefined token", async () => {
    expect(await verifySession(undefined, "my-secret")).toBe(false);
  });

  it("rejects a malformed token", async () => {
    expect(await verifySession("not.a.validtoken", "my-secret")).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession("my-secret");
    const [issuedAt, nonce, sig] = token.split(".");
    const tampered = `${issuedAt}.tampered-nonce.${sig}`;
    expect(await verifySession(tampered, "my-secret")).toBe(false);
  });

  it("rejects a token older than maxAgeMs", async () => {
    const token = await signSession("my-secret");
    expect(await verifySession(token, "my-secret", -1)).toBe(false); // already "expired"
  });

  it("never stores the raw secret in the token", async () => {
    const token = await signSession("my-super-secret-value");
    expect(token).not.toContain("my-super-secret-value");
  });
});
