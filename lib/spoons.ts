// Spoons strip helpers. Pure: no React, no window access.

export const SPOON_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Halseth dates are SQLite UTC "YYYY-MM-DD HH:MM:SS" or ISO; both read as UTC when no zone is given. */
export function parseUtc(s: string): Date | null {
  let t = s.trim().replace(" ", "T");
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(t)) t += "Z";
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partOfDay(hour: number): string {
  if (hour < 12) return "this morning";
  if (hour < 17) return "this afternoon";
  if (hour < 21) return "this evening";
  return "tonight";
}

function localDayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export function lastLoggedLabel(
  latest: { spoons: number | null; recorded_at: string } | null,
  now: Date,
): string {
  if (!latest || latest.spoons === null) return "nothing logged yet";
  const at = parseUtc(latest.recorded_at);
  if (!at) return `last: ${latest.spoons}`;
  const days = localDayNumber(now) - localDayNumber(at);
  let when: string;
  if (days <= 0) when = partOfDay(at.getHours());
  else if (days === 1) when = "yesterday";
  else when = `${days} days ago`;
  return `last: ${latest.spoons}, ${when}`;
}

export function confirmLine(spoons: number): string {
  return `Logged ${spoons}.`;
}
