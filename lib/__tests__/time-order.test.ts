import { describe, it, expect } from "vitest";
import { ms, newestFirst } from "../time-order";

describe("ms", () => {
  it("reads zone-less D1 stamps as UTC and ISO Z the same way", () => {
    expect(ms("2026-10-30 10:00:00")).toBe(ms("2026-10-30T10:00:00Z"));
    expect(ms("2026-10-30T10:00:00+00:00")).toBe(ms("2026-10-30T10:00:00Z"));
  });
  it("returns 0 for garbage", () => {
    expect(ms("nope")).toBe(0);
  });
});

describe("newestFirst", () => {
  it("orders mixed formats by instant, newest first", () => {
    const rows = [
      { at: "2026-10-30 10:00:00" },
      { at: "2026-10-30T12:00:00Z" },
      { at: "2026-10-30 11:00:00" },
    ];
    expect(rows.sort(newestFirst((r) => r.at)).map((r) => r.at)).toEqual([
      "2026-10-30T12:00:00Z",
      "2026-10-30 11:00:00",
      "2026-10-30 10:00:00",
    ]);
  });
});
