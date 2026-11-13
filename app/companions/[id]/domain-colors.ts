// Rule: companion hues mean identity only; --h-lamp is Principal or ONE attention state per map.
// Categorical maps are neutral (ink/muted/faint); semantic maps may use gaia (ok) / warn (bad).
// One home for the companion-page domain color maps. Every value is a kit token; consumers set it
// as `--c` (style={{ "--c": ... }}) and let `.h-cmp-badge` / `.h-cmp-tint` read it.
// Companion identity colors are NOT here: they come from lib/shell.ts COMPANION_COLOR.

export const MUTED = "var(--h-muted)";

function pick(map: Record<string, string>, key: string | null | undefined, fallback = MUTED): string {
  return key != null && Object.hasOwn(map, key) ? map[key] : fallback;
}

/** relational_state.state_type (sections RelationalStateSection + relational page). */
export const STATE_TYPE_COLOR: Record<string, string> = {
  feeling: "var(--h-ink)",
  witness: "var(--h-gaia)",
  held: "var(--h-faint)",
};
export const stateTypeColor = (t: string) => pick(STATE_TYPE_COLOR, t);

/** growth journal entry_type. */
export const ENTRY_TYPE_COLOR: Record<string, string> = {
  learning: "var(--h-ink)",
  insight: "var(--h-muted)",
  connection: "var(--h-faint)",
  question: "var(--h-ink)",
};
export const entryTypeColor = (t: string) => pick(ENTRY_TYPE_COLOR, t);

/** growth journal source. */
export const SOURCE_COLOR: Record<string, string> = {
  autonomous: "var(--h-faint)",
  conversation: "var(--h-ink)",
  reflection: "var(--h-muted)",
};
export const sourceColor = (s: string | null | undefined) => (s != null && Object.hasOwn(SOURCE_COLOR, s) ? SOURCE_COLOR[s] : null);

/** growth journal review_status. */
export const REVIEW_STATUS_COLOR: Record<string, string> = {
  accepted: "var(--h-gaia)",
  declined: "var(--h-warn)",
};
export const reviewStatusColor = (s: string) => pick(REVIEW_STATUS_COLOR, s);

/** autonomy run status. */
export const RUN_STATUS_COLOR: Record<string, string> = {
  running: "var(--h-lamp)",
  completed: "var(--h-gaia)",
  failed: "var(--h-warn)",
};
export const runStatusColor = (s: string) => pick(RUN_STATUS_COLOR, s);

/** autonomy run_type. */
export const RUN_TYPE_COLOR: Record<string, string> = {
  exploration: "var(--h-ink)",
  reflection: "var(--h-muted)",
  synthesis: "var(--h-faint)",
};
export const runTypeColor = (t: string) => pick(RUN_TYPE_COLOR, t);

/** autonomy seed_type. */
export const SEED_TYPE_COLOR: Record<string, string> = {
  topic: "var(--h-ink)",
  question: "var(--h-muted)",
  reflection_prompt: "var(--h-faint)",
};
export const seedTypeColor = (t: string) => pick(SEED_TYPE_COLOR, t, "var(--h-faint)");

/** worldview belief_type. */
export const BELIEF_TYPE_COLOR: Record<string, string> = {
  self: "var(--h-ink)",
  relational: "var(--h-muted)",
  observational: "var(--h-faint)",
  systemic: "var(--h-ink)",
};
export const beliefTypeColor = (t: string) => pick(BELIEF_TYPE_COLOR, t);

/** growth marker_type. */
export const MARKER_TYPE_COLOR: Record<string, string> = {
  milestone: "var(--h-ink)",
  shift: "var(--h-muted)",
  realization: "var(--h-faint)",
};
export const markerTypeColor = (t: string) => pick(MARKER_TYPE_COLOR, t);

/** worldview conclusion confidence: high / middling / low. */
export function confidenceColor(c: number): string {
  if (c >= 0.8) return "var(--h-gaia)";
  if (c >= 0.5) return "var(--h-lamp)";
  return MUTED;
}

/** voice-lane conformance score: good / watch / drifting. */
export function laneScoreColor(score: number): string {
  return score >= 0.8 ? "var(--h-gaia)" : score >= 0.6 ? "var(--h-lamp)" : "var(--h-warn)";
}

/** An item the page flags for attention (contradiction flag, fired drive, baseline sinking). */
export const FLAG_COLOR = "var(--h-lamp)";
