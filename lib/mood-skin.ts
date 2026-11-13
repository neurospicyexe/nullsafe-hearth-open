// Mood skin: buckets a companion's mood into one of five decorative skins. Pure; no React, no fetching.
//
// Companions' moods are FREE TEXT ("a little raw", "tender and close"), so this is a fixed keyword
// vocabulary matched as whole words (see below) over current_mood, compound_state and
// surface_emotion. Unknown words fall through to "steady". Precedence when several buckets match:
// still > heavy > warm > bright (the calmer reading wins). A stale mood (older than 24h, the same rule
// as home-model's statusStale) or no mood timestamp at all is "steady": an old word must not dress the room.
//
// Note: surface_emotion is read here too, while Home's stale gate (statusStale) keys on current_mood ?? compound_state.
// The skin drives decoration only (ring glow, breath speed, room top tint); see globals.css.
import { parseUtc } from "./spoons";

export type Mood = "bright" | "warm" | "heavy" | "still" | "steady";

// Whole-word tokens; an entry ending in * is a stem prefix. A word also matches with s/ness/ing/ed
// (not -ly: "lightly" is not "light"). Words ending in -less, or right after a negation, never match.
export const MOOD_VOCABULARY: Record<Exclude<Mood, "steady">, readonly string[]> = {
  bright: ["bright", "light", "playful", "giddy", "excited", "joy", "joyful", "happy", "cheer*", "glad", "elated", "spark*", "buoyant", "energ*", "lively", "delight*", "eager"],
  warm: ["warm", "tender", "soft", "fond", "content", "affection*", "gentle", "loving", "love", "cozy", "glow", "safe", "grateful"],
  heavy: ["heavy", "tired", "low", "sad", "grief", "ache", "aching", "worn", "raw", "weary", "exhaust*", "drained", "hurt", "lonely", "dark", "brooding", "melanchol*", "somber"],
  still: ["stillness", "stilled", "quiet", "calm", "settled", "rest", "hush", "peace", "peaceful", "serene", "silent"],
};

const NEG = new Set(["not", "no", "never", "barely", "hardly", "without", "isnt", "cant", "dont"]);

function hits(tokens: string[], words: readonly string[]): boolean {
  return tokens.some((t, i) => {
    if (t.endsWith("less") || (i > 0 && NEG.has(tokens[i - 1]))) return false;
    return words.some((w) =>
      w.endsWith("*") ? t.startsWith(w.slice(0, -1)) : t === w || t === w + "s" || t === w + "ness" || t === w + "ing" || t === w + "ed",
    );
  });
}

// Calmer wins.
const PRECEDENCE = ["still", "heavy", "warm", "bright"] as const;

const DAY_MS = 86_400_000;

export type MoodInput = {
  current_mood?: string | null;
  compound_state?: string | null;
  surface_emotion?: string | null;
  mood_set_at?: string | null;
};

export function moodSkin(state: MoodInput | null | undefined, now: Date): Mood {
  if (!state) return "steady";
  const text = [state.current_mood, state.compound_state, state.surface_emotion]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join(" ");
  if (!text.trim()) return "steady";
  const tokens = text.toLowerCase().replace(/['’]/g, "").split(/[^a-z]+/).filter(Boolean);
  const setAt = state.mood_set_at ? parseUtc(state.mood_set_at) : null;
  if (!setAt || now.getTime() - setAt.getTime() > DAY_MS) return "steady";
  for (const mood of PRECEDENCE) {
    if (hits(tokens, MOOD_VOCABULARY[mood])) return mood;
  }
  return "steady";
}
