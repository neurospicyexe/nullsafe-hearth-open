import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { MemoryThrottleStore, __setStoreForTests } from "@/lib/rate-limit";

const SECRET = "correct horse battery staple";
let prev: string | undefined;

beforeEach(() => {
  prev = process.env.DASHBOARD_SECRET;
  process.env.DASHBOARD_SECRET = SECRET;
  __setStoreForTests(new MemoryThrottleStore());
});
afterEach(() => {
  if (prev === undefined) delete process.env.DASHBOARD_SECRET;
  else process.env.DASHBOARD_SECRET = prev;
  __setStoreForTests(null);
});

function login(secret: unknown, ip = "203.0.113.9") {
  return POST(
    new NextRequest("https://hearth.test/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vercel-forwarded-for": ip },
      body: JSON.stringify({ secret }),
    }),
  );
}

describe("POST /api/auth throttle", () => {
  it("5 wrong passphrases lock the IP out, and then even the right one gets 429", async () => {
    for (let i = 0; i < 5; i++) expect((await login("nope")).status).toBe(401);
    const res = await login(SECRET);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
    expect(res.cookies.get("hearth_session")).toBeUndefined();
  });

  it("a success before the limit clears the count", async () => {
    for (let i = 0; i < 4; i++) await login("nope");
    expect((await login(SECRET)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login("nope")).status).toBe(401);
    expect((await login(SECRET)).status).toBe(200);
  });

  it("successes never count toward the limit", async () => {
    for (let i = 0; i < 12; i++) expect((await login(SECRET)).status).toBe(200);
  });

  it("a non-string secret counts as a failure", async () => {
    for (let i = 0; i < 5; i++) expect((await login(12345)).status).toBe(401);
    expect((await login(SECRET)).status).toBe(429);
  });

  it("the lockout is per IP", async () => {
    for (let i = 0; i < 5; i++) await login("nope", "198.51.100.1");
    expect((await login(SECRET, "198.51.100.2")).status).toBe(200);
  });
});
