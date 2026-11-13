import { describe, it, expect } from "vitest";
import {
  awaitingLine, dayLabel, gardenIsEmpty, witnessWaiting, orderPlantings, orderWitnessDays,
  plantingDates, plantingLabel, restingLine, timeLabel,
} from "./garden";
import type { GardenPlanting } from "./halseth";

const NOW = new Date("2026-11-05T12:00:00Z");
const planting = (o: Partial<GardenPlanting> = {}): GardenPlanting => ({
  id: "a", kind: "letter", planted_at: "2026-11-04T15:00:00Z", written_at: "2026-11-02T15:00:00Z",
  text: "t", to: "principal", interest_name: null, ...o,
});

describe("plantingLabel", () => {
  it("names the addressee in plain words", () => {
    expect(plantingLabel(planting({ to: "principal" }))).toBe("to you");
    expect(plantingLabel(planting({ kind: "note", to: "triad" }))).toBe("to all three");
    expect(plantingLabel(planting({ to: "cypher" }))).toBe("to Cypher");
    expect(plantingLabel(planting({ to: "drevan" }))).toBe("to Drevan");
  });
  it("falls back for an unaddressed letter or note", () => {
    expect(plantingLabel(planting({ to: null }))).toBe("a letter");
    expect(plantingLabel(planting({ kind: "note", to: null }))).toBe("a note");
  });
  it("kept lines and interest lines", () => {
    expect(plantingLabel(planting({ kind: "kept_line", to: null }))).toBe("a kept line");
    expect(plantingLabel(planting({ kind: "interest_line", to: null, interest_name: "moss" }))).toBe("from moss");
    expect(plantingLabel(planting({ kind: "interest_line", to: null, interest_name: " " }))).toBe("a kept line");
  });
});

describe("dates", () => {
  it("formats a day and a timestamp, year only when it differs", () => {
    expect(dayLabel("2026-11-02", NOW)).toBe("Nov 2");
    expect(dayLabel("2026-11-02T15:00:00Z", NOW)).toBe("Nov 2");
    expect(dayLabel("2025-11-02", NOW)).toBe("Nov 2, 2025");
    expect(dayLabel("nope", NOW)).toBe("");
  });
  it("time in Chicago", () => {
    expect(timeLabel("2026-11-02T21:42:00Z")).toBe("3:42 PM");
    expect(timeLabel("x")).toBe("");
  });
  it("plantingDates drops planted when same day or unreadable", () => {
    expect(plantingDates(planting(), NOW)).toBe("written Nov 2 · planted Nov 4");
    expect(plantingDates(planting({ planted_at: "2026-11-02T18:00:00Z" }), NOW)).toBe("written Nov 2");
    expect(plantingDates(planting({ planted_at: "bad" }), NOW)).toBe("written Nov 2");
  });
});

describe("ordering", () => {
  it("plantings newest-written first, no mutation", () => {
    const a = planting({ id: "a", written_at: "2026-11-01T00:00:00Z" });
    const b = planting({ id: "b", written_at: "2026-11-03T00:00:00Z" });
    const input = [a, b];
    expect(orderPlantings(input).map((p) => p.id)).toEqual(["b", "a"]);
    expect(input[0]).toBe(a);
  });
  it("witness days newest first, empties dropped, entries in time order", () => {
    const e = (id: string, at: string) => ({ id, at, type: "x", text: id });
    const out = orderWitnessDays([
      { day: "2026-11-01", entries: [e("a", "2026-11-01T10:00:00Z")] },
      { day: "2026-11-03", entries: [e("c", "2026-11-03T12:00:00Z"), e("b", "2026-11-03T09:00:00Z")] },
      { day: "2026-11-02", entries: [] },
    ]);
    expect(out.map((d) => d.day)).toEqual(["2026-11-03", "2026-11-01"]);
    expect(out[0].entries.map((x) => x.id)).toEqual(["b", "c"]);
  });
});

describe("lines and emptiness", () => {
  it("resting and awaiting", () => {
    expect(restingLine(0)).toBe("");
    expect(restingLine(3)).toBe("3 resting in the ground.");
    expect(awaitingLine(0)).toBe("");
    expect(awaitingLine(2)).toBe("2 waiting on a sibling's yes.");
  });
  it("gardenIsEmpty", () => {
    expect(gardenIsEmpty({ planted: [], witness: null })).toBe(true);
    expect(gardenIsEmpty({ planted: [], witness: { days: [{ entries: [] }] } })).toBe(false);
    expect(witnessWaiting({ witness: { days: [] } })).toBe(true);
    expect(witnessWaiting({ witness: { days: [{ entries: [1] }] } })).toBe(false);
    expect(witnessWaiting({ witness: null })).toBe(false);
    expect(gardenIsEmpty({ planted: [], witness: { days: [{ entries: [1] }] } })).toBe(false);
    expect(gardenIsEmpty({ planted: [1], witness: null })).toBe(false);
  });
});
