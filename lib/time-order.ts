// Journal and session rows are "YYYY-MM-DD HH:MM:SS" (UTC, no zone); notes are ISO with Z.
// Parse both to one instant so mixed lists sort correctly.
export function ms(at: string): number {
  const iso = /[zZ]$|[+-]\d\d:?\d\d$/.test(at) ? at.replace(" ", "T") : `${at.replace(" ", "T")}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Comparator: newest first, by the timestamp `at` returns for each item. */
export function newestFirst<T>(at: (item: T) => string): (a: T, b: T) => number {
  return (a, b) => ms(at(b)) - ms(at(a));
}
