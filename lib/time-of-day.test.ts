import { describe, it, expect } from "vitest";
import { partOfDay, TIME_BOOT, TIME_CUTOFFS } from "./time-of-day";
import { greeting } from "./home-model";

const at = (h: number, m = 0) => new Date(2026, 10, 1, h, m);

describe("partOfDay", () => {
  it("cuts at 12, 17 and 21 like the greeting", () => {
    expect(partOfDay(at(0))).toBe("morning");
    expect(partOfDay(at(11, 59))).toBe("morning");
    expect(partOfDay(at(12))).toBe("afternoon");
    expect(partOfDay(at(16, 59))).toBe("afternoon");
    expect(partOfDay(at(17))).toBe("evening");
    expect(partOfDay(at(20, 59))).toBe("evening");
    expect(partOfDay(at(21))).toBe("night");
    expect(partOfDay(at(23, 59))).toBe("night");
  });
  it("greeting() ends with the same word", () => {
    for (const h of [0, 6, 11, 12, 16, 17, 20, 21, 23]) expect(greeting(at(h)).endsWith(partOfDay(at(h)))).toBe(true);
  });
});

describe("TIME_BOOT head script", () => {
  it("sets data-time with the same answers as partOfDay for every hour", () => {
    for (let h = 0; h < 24; h++) {
      const attrs: Record<string, string> = {};
      const RealDate = Date;
      const fake = class extends RealDate { getHours() { return h; } } as unknown as DateConstructor;
      new Function("Date", "document", TIME_BOOT)(fake, { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } });
      expect(attrs["data-time"]).toBe(partOfDay(new Date(2026, 10, 1, h)));
    }
  });
  it("embeds the shared cutoffs", () => {
    for (const c of Object.values(TIME_CUTOFFS)) expect(TIME_BOOT).toContain(`<${c}`);
  });
});
