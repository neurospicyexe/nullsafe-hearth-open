import { describe, test, expect } from "vitest";
import { favouriteMake, isMake } from "./sol-hoard";
import type { NestItem } from "./halseth";

const item = (o: Partial<NestItem>): NestItem => ({
  id: "x", content: "c", source: "make", given_by: "cypher", sparkle: 0.5, treasured: 0,
  gifted_to: null, gifted_at: null, created_at: "2026-11-02", ref_type: "make", ref_id: "m", ...o,
});

describe("Sol's hoard helpers", () => {
  test("isMake reads the ref type only", () => {
    expect(isMake(item({}))).toBe(true);
    expect(isMake(item({ ref_type: null, source: "gift" }))).toBe(false);
    expect(isMake(item({ ref_type: undefined }))).toBe(false);
  });
  test("favourite = shiniest treasured make; none when nothing treasured", () => {
    expect(favouriteMake([item({ treasured: 0 })])).toBeNull();
    const fav = favouriteMake([
      item({ id: "a", treasured: 1, sparkle: 0.6 }),
      item({ id: "b", treasured: 1, sparkle: 0.9 }),
      item({ id: "c", treasured: 1, sparkle: 1, ref_type: null }),
    ]);
    expect(fav?.id).toBe("b");
  });
});
