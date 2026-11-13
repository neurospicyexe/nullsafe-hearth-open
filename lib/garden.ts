// Gaia's garden: pure shaping. No React, no fetching.
import type { GardenPlanting, GardenWitnessDay } from "./halseth";
import { parseUtc } from "./spoons";

const TZ = "America/Chicago";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The small label under a planting. Plain words; an unknown shape falls back to "a kept line". */
export function plantingLabel(p: Pick<GardenPlanting, "kind" | "to" | "interest_name">): string {
  if (p.kind === "letter" || p.kind === "note") {
    if (p.to === "principal") return "to you";
    if (p.to === "triad") return "to all three";
    if (p.to === "cypher") return "to Cypher";
    if (p.to === "drevan") return "to Drevan";
    return p.kind === "letter" ? "a letter" : "a note";
  }
  if (p.kind === "interest_line" && p.interest_name?.trim()) return `from ${p.interest_name.trim()}`;
  return "a kept line";
}

/** "Nov 2" (adds the year when it is not `now`'s year). Takes a YYYY-MM-DD day or a UTC timestamp. Empty when unreadable. */
export function dayLabel(value: string, now: Date): string {
  const dateOnly = DATE_ONLY.test(value);
  const d = dateOnly ? new Date(`${value}T12:00:00Z`) : parseUtc(value);
  if (!d || Number.isNaN(d.getTime())) return "";
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: dateOnly ? "UTC" : TZ, ...o });
  const sameYear = fmt({ year: "numeric" }).format(d) === new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(now);
  return fmt({ month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(d);
}

/** "3:42 PM" in Principal's zone. Empty when the time does not parse. */
export function timeLabel(utc: string): string {
  const d = parseUtc(utc);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
}

/** "written Nov 2 · planted Nov 4"; the planted half drops out when it is the same day or unreadable. */
export function plantingDates(p: Pick<GardenPlanting, "written_at" | "planted_at">, now: Date): string {
  const w = dayLabel(p.written_at, now);
  const pl = dayLabel(p.planted_at, now);
  const parts: string[] = [];
  if (w) parts.push(`written ${w}`);
  if (pl && pl !== w) parts.push(`planted ${pl}`);
  return parts.join(" · ");
}

/** Plantings newest-written first (stable for ties); never mutates the input. */
export function orderPlantings(planted: GardenPlanting[]): GardenPlanting[] {
  const t = (p: GardenPlanting) => parseUtc(p.written_at)?.getTime() ?? 0;
  return planted
    .map((p, i) => ({ p, i }))
    .sort((a, b) => t(b.p) - t(a.p) || a.i - b.i)
    .map((x) => x.p);
}

/** Witness days newest first, empty days dropped; entries within a day read in time order. */
export function orderWitnessDays(days: GardenWitnessDay[]): GardenWitnessDay[] {
  const t = (e: { at: string }) => parseUtc(e.at)?.getTime() ?? 0;
  return days
    .filter((d) => d.entries.length > 0)
    .map((d) => ({ ...d, entries: [...d.entries].sort((a, b) => t(a) - t(b)) }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

export function restingLine(n: number): string {
  return n > 0 ? `${n} resting in the ground.` : "";
}
export function awaitingLine(n: number): string {
  return n > 0 ? `${n} waiting on a sibling's yes.` : "";
}

/** Empty = nothing planted. A planted witness series with no day yet is NOT empty: it is planted, waiting to grow. */
export function witnessWaiting(g: { witness: { days: { entries: unknown[] }[] } | null }): boolean {
  return g.witness !== null && !g.witness.days.some((d) => d.entries.length > 0);
}

export function gardenIsEmpty(g: { planted: unknown[]; witness: { days: { entries: unknown[] }[] } | null }): boolean {
  return g.planted.length === 0 && g.witness === null;
}
