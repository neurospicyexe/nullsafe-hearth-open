// Basins that move (mig 0172): pure shaping for /companions/[id]/basins. No React, no fetching.
import type { BasinLine } from "./halseth";
import { dayLabel } from "./garden";

const CAUSE: Record<string, string> = {
  conclusion: "a conclusion",
  refusal: "a refusal",
  tension: "a tension",
  drift: "a drift reading",
  session: "a session",
  self_model: "a self-model observation made canon",
};

const asUtc = (v: string): string => (v.includes("T") ? v : `${v.replace(" ", "T")}Z`);

/** "from a refusal (abcdef01)"; empty when the row has no cause (an original basin). */
export function causeLine(b: Pick<BasinLine, "cause_kind" | "cause_ref">): string {
  if (!b.cause_kind) return "";
  const kind = CAUSE[b.cause_kind] ?? b.cause_kind;
  return b.cause_ref ? `from ${kind} (${b.cause_ref.slice(0, 8)})` : `from ${kind}`;
}

/** The plain status words under a row. */
export function statusLine(b: BasinLine, now: Date): string {
  const made = dayLabel(asUtc(b.created_at), now);
  if (b.status === "awaiting_witness") return `Proposed ${made}, waiting for your witness`;
  if (b.status === "declined") return `Proposed ${made}, declined${b.witnessed_at ? ` ${dayLabel(asUtc(b.witnessed_at), now)}` : ""}`;
  if (b.status === "superseded") {
    const when = b.superseded_at ? dayLabel(asUtc(b.superseded_at), now) : "";
    return when ? `Held until ${when}` : "Superseded";
  }
  return made ? `Since ${made}` : "";
}

/** The live row an awaiting row would replace. */
export function replacedBy(awaiting: BasinLine, live: BasinLine[]): BasinLine | null {
  return live.find((l) => l.id === awaiting.supersedes) ?? null;
}

/** Awaiting rows first (they need Principal), then newest first. */
export function orderHistory(history: BasinLine[]): BasinLine[] {
  return [...history].sort((a, b) => {
    const aw = Number(b.status === "awaiting_witness") - Number(a.status === "awaiting_witness");
    return aw !== 0 ? aw : b.created_at.localeCompare(a.created_at);
  });
}

export function paceLine(paceDays: number, windowOpens: string | null, now: Date): string {
  if (!paceDays) return "";
  const base = `One revision at most every ${paceDays} days.`;
  if (!windowOpens) return base;
  return `${base} The next opens ${dayLabel(windowOpens, now)}.`;
}
