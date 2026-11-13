import { describe, it, expect } from "vitest";
import { SPOON_VALUES, lastLoggedLabel, confirmLine } from "../spoons";

// Local-time constructors keep these tests timezone-independent: the label reads local time.
const local = (y: number, mo: number, d: number, h: number) => new Date(y, mo - 1, d, h, 0, 0);
const asUtcSqlite = (dt: Date) => dt.toISOString().slice(0, 19).replace("T", " ");

describe("SPOON_VALUES", () => {
  it("is 0..12", () => {
    expect(SPOON_VALUES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("lastLoggedLabel", () => {
  const now = local(2026, 10, 30, 14);
  it("null -> nothing logged yet", () => {
    expect(lastLoggedLabel(null, now)).toBe("nothing logged yet");
  });
  it("null spoons -> nothing logged yet", () => {
    expect(lastLoggedLabel({ spoons: null, recorded_at: asUtcSqlite(now) }, now)).toBe("nothing logged yet");
  });
  it("today by part of day", () => {
    const at = (h: number) => ({ spoons: 5, recorded_at: local(2026, 10, 30, h).toISOString() });
    const late = local(2026, 10, 30, 23);
    expect(lastLoggedLabel(at(9), late)).toBe("last: 5, this morning");
    expect(lastLoggedLabel(at(12), late)).toBe("last: 5, this afternoon");
    expect(lastLoggedLabel(at(16), late)).toBe("last: 5, this afternoon");
    expect(lastLoggedLabel(at(17), late)).toBe("last: 5, this evening");
    expect(lastLoggedLabel(at(20), late)).toBe("last: 5, this evening");
    expect(lastLoggedLabel(at(21), late)).toBe("last: 5, tonight");
  });
  it("yesterday and N days ago", () => {
    const y = { spoons: 5, recorded_at: local(2026, 10, 29, 23).toISOString() };
    expect(lastLoggedLabel(y, local(2026, 10, 30, 1))).toBe("last: 5, yesterday");
    const d3 = { spoons: 0, recorded_at: local(2026, 10, 27, 9).toISOString() };
    expect(lastLoggedLabel(d3, now)).toBe("last: 0, 3 days ago");
  });
  it("parses SQLite UTC (space, no zone) as UTC", () => {
    const row = { spoons: 7, recorded_at: asUtcSqlite(local(2026, 10, 30, 9)) };
    expect(lastLoggedLabel(row, now)).toBe("last: 7, this morning");
  });
  it("unparseable date -> just the value", () => {
    expect(lastLoggedLabel({ spoons: 4, recorded_at: "garbage" }, now)).toBe("last: 4");
  });
});

describe("confirmLine", () => {
  it("formats", () => {
    expect(confirmLine(5)).toBe("Logged 5.");
    expect(confirmLine(0)).toBe("Logged 0.");
  });
});
