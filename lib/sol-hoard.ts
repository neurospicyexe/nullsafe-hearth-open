// Sol's hoard on Hearth (B62 step 6, Halseth mig 0166). Pure helpers for app/creatures.
import type { NestItem } from "@/lib/halseth";

export const isMake = (n: NestItem) => n.ref_type === "make";

/** Sol's favourite: the shiniest treasured make, ties to the newest. Mirrors Halseth's favouriteOf. */
export function favouriteMake(kept: NestItem[]): NestItem | null {
  const t = kept.filter(n => isMake(n) && n.treasured === 1);
  if (t.length === 0) return null;
  return [...t].sort((a, b) => b.sparkle - a.sparkle || b.created_at.localeCompare(a.created_at))[0]!;
}
