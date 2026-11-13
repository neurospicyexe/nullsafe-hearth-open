import type { ArchitectFact } from "./halseth";

// A correction proposal (Halseth facts-write, 2026-11-11) names the fact it would replace in
// `supersedes_id` WITHOUT retiring it; Confirm retires the target. The list endpoint returns active +
// open rows, so the target is normally in the same list. Returns the line to show beside the proposal,
// or null when the proposal replaces nothing.
export function replacesLine(fact: ArchitectFact, all: ArchitectFact[]): string | null {
  const target = fact.supersedes_id;
  if (!target) return null;
  const old = all.find((f) => f.id === target);
  return old ? old.fact : `a fact no longer active (${target.slice(0, 8)})`;
}
