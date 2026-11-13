import { describe, it, expect } from "vitest";
import { config } from "../middleware";

// 2026-10-29: the exclusion was `api/companion` with no slash, so the negative lookahead also
// skipped `/api/companion-notes` -- every companion journal (drafts included) was readable and
// writable without a session, with HALSETH_SECRET attached server-side. Exclusions are now exact
// (`$`) or end at a path boundary (`/`). This pins that.
const matcher = new RegExp(`^${config.matcher[0]}$`);
const isProtected = (path: string) => matcher.test(path);

describe("middleware matcher", () => {
  it("protects companion-notes and every other data route", () => {
    for (const p of ["/api/companion-notes", "/api/pin", "/api/link", "/api/keep-off", "/api/people", "/api/authz", "/loginx", "/", "/map"]) {
      expect(isProtected(p), p).toBe(true);
    }
  });

  it("protects the Hearth v2 write routes (inbox read marks, needs count, check-in undo/amend by id)", () => {
    for (const p of ["/api/inbox/read", "/api/needs/count", "/api/biometrics", "/api/biometrics/0b7c6f1e-3a2d-4c5b-9e8f-1a2b3c4d5e6f"]) {
      expect(isProtected(p), p).toBe(true);
    }
  });

  it("protects the companion page look proxy", () => {
    for (const p of ["/api/companions/cypher/looked", "/api/companions/gaia/looked", "/api/companions/drevan/looked"]) {
      expect(isProtected(p), p).toBe(true);
    }
  });

  it("leaves the deliberate public paths public", () => {
    for (const p of ["/api/auth", "/login", "/api/companion/house", "/manifest.webmanifest", "/sw.js", "/offline.html", "/icon.png"]) {
      expect(isProtected(p), p).toBe(false);
    }
  });
});
