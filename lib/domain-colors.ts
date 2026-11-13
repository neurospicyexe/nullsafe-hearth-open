// Neutral home for color tokens and helpers shared by the Under-the-hood pages.
// Rule: companion hues mean identity only (use lib/tone.ts toneOf / lib/shell.ts COMPANION_COLOR);
// --h-lamp is Principal, a primary action, or ONE attention state per map; categorical maps are
// neutral (ink/muted/faint); semantic ok = --h-gaia, bad = --h-warn.
// Companion-page domain maps live in app/companions/[id]/domain-colors.ts and are reused as-is.
import type { CSSProperties } from "react";

export const OK = "var(--h-gaia)";
export const WARN = "var(--h-warn)";
export const ATTN = "var(--h-lamp)";
export const INK = "var(--h-ink)";
export const MUTED = "var(--h-muted)";
export const QUIET = "var(--h-faint)";

/** Relational-delta valence: one meaning on every page. globals.css .valence-fill, .valence-badge and
 * .delta-valence follow the same tokens (lib/__tests__/valence-drift-colors.test.ts keeps them in step). */
export const VALENCE: Record<string, string> = {
  toward: INK,
  tender: MUTED,
  neutral: QUIET,
  repair: OK,
  rupture: WARN,
};

/** Sets --c (a kit token, never a literal) for `.h-cmp-badge` / `.h-cmp-tint`. */
export function tint(color: string): CSSProperties {
  return { "--c": color } as CSSProperties;
}
