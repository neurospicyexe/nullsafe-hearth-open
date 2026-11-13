// lib/timing-safe.ts
//
// Constant-time string comparison for Route Handlers (Node runtime only -- this
// module is NOT safe to import from middleware.ts, which runs on the Edge runtime
// and has no Node `crypto` module. See lib/session.ts for the Edge-safe equivalent.
import { timingSafeEqual } from "crypto";

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // dummy compare of equal-length buffers -- no early-return timing tell
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
