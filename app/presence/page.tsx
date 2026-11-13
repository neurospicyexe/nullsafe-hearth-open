import { fetchSomaStates } from "@/lib/halseth";
import type { CompanionSomaState } from "@/lib/halseth";
import { toneOf } from "@/lib/tone";

export const dynamic = "force-dynamic";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;

const clamp01 = (n: number | null | undefined) => Math.min(1, Math.max(0, Number.isFinite(n) ? (n as number) : 0.5));

// Felt valence from the companion's OWN mood words -- not raw float-3.
// float-3 means a different thing per companion (cypher=warmth, drevan=weight,
// gaia=perimeter), so the old `(f3-0.4)` mouth rendered a settled, low-weight
// Drevan ("warm-and-deep") as a frown. Drive the smile from actual mood instead.
// (fix 2026-06-14)
const POS_WORDS = ["warm","deep","settled","met","lit","bright","glad","open","content","alive","full","ground","integrat","calm","peace","soft","steady","held","clear","glow","joy","love","tender","rest","whole","easy","sure","absorb","quiet"];
const NEG_WORDS = ["sad","heavy","tight","drain","raw","ache","fray","brittle","alone","lost","cold","numb","pressure","tired","sharp","brace","tense","grief","fear","dread","sick","worn","thin","split","empty","fog"];
function moodValence(...texts: Array<string | null | undefined>): number {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (!t) return 0.6; // neutral-positive resting (presence, not absence)
  let s = 0;
  for (const w of POS_WORDS) if (t.includes(w)) s += 1;
  for (const w of NEG_WORDS) if (t.includes(w)) s -= 1;
  return Math.min(1, Math.max(0, 0.6 + s * 0.16));
}

// A SOMA-keyed face (take 15, Phase 1 -- a static expressive avatar, not VRM).
// float1 ~ acuity/heat/stillness -> alertness (eye openness)
// float2 ~ presence/reach/density -> arousal (pupil + brow)
// mouth curve -> felt valence from mood words (per-companion-safe)
function Avatar({ soma, companion }: { soma: CompanionSomaState; companion: string }) {
  const f1 = clamp01(soma?.soma_float_1);
  const f2 = clamp01(soma?.soma_float_2);
  const arousal = (f1 + f2) / 2;
  const valence = moodValence(soma?.current_mood, soma?.compound_state);

  const eyeOpen = 3 + f1 * 7;                 // 3..10 px tall
  const pupil = 1.5 + f2 * 2.5;
  // Mouth: smile curve driven by felt valence; arousal widens it.
  const mouthW = 16 + arousal * 14;
  const curve = (valence - 0.5) * 30;        // up = positive valence, down = negative
  const browY = 30 - f2 * 4;                  // higher arousal -> raised brow

  return (
    <svg className={toneOf(companion)} viewBox="0 0 100 100" width="120" height="120" aria-label={`${companion} presence`}>
      <circle cx="50" cy="50" r="40" fill="currentColor" fillOpacity="0.13" stroke="currentColor" strokeWidth="2" />
      {/* eyes */}
      <ellipse cx="36" cy="44" rx="6" ry={eyeOpen} fill="var(--h-ground)" />
      <ellipse cx="64" cy="44" rx="6" ry={eyeOpen} fill="var(--h-ground)" />
      <circle cx="36" cy="44" r={pupil} fill="currentColor" />
      <circle cx="64" cy="44" r={pupil} fill="currentColor" />
      {/* brows */}
      <line x1="30" y1={browY} x2="42" y2={browY - 1} stroke="currentColor" strokeWidth="1.6" />
      <line x1="58" y1={browY - 1} x2="70" y2={browY} stroke="currentColor" strokeWidth="1.6" />
      {/* mouth */}
      <path
        d={`M ${50 - mouthW / 2} 66 Q 50 ${66 + curve} ${50 + mouthW / 2} 66`}
        fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
      />
    </svg>
  );
}

function PresenceCard({ companion, soma }: { companion: string; soma: CompanionSomaState }) {
  const floats: Array<[string | null, number | null]> = [
    [soma?.float_1_label ?? null, soma?.soma_float_1 ?? null],
    [soma?.float_2_label ?? null, soma?.soma_float_2 ?? null],
    [soma?.float_3_label ?? null, soma?.soma_float_3 ?? null],
  ];
  return (
    <section className="h-panel is-pad-lg">
      <Avatar soma={soma} companion={companion} />
      <h2 className={`page-title ${toneOf(companion)}`} style={{ fontSize: "1.1rem", margin: "0.4rem 0 0.1rem" }}>{companion}</h2>
      {soma?.current_mood && <p className="page-subtitle" style={{ fontSize: "0.85rem", margin: 0 }}>{soma.current_mood}</p>}
      {soma?.compound_state && <p className="handover-last-real" style={{ fontSize: "0.78rem", marginTop: "0.3rem" }}>{soma.compound_state}</p>}
      <div style={{ marginTop: "0.6rem", fontSize: "0.72rem", opacity: 0.75, display: "flex", flexDirection: "column", gap: "0.1rem" }}>
        {floats.map(([label, val], i) => label != null && (
          <span key={i}>{label}: {val != null ? Number(val).toFixed(2) : "—"}</span>
        ))}
      </div>
    </section>
  );
}

export default async function PresencePage() {
  const soma = await fetchSomaStates();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Presence</h1>
        <p className="page-subtitle">
          the triad with faces — each avatar&apos;s expression keys off that companion&apos;s live SOMA state.
          (Phase 1: static SOMA-keyed avatar; VRM is the eventual Phase 2.)
        </p>
      </div>

      {!soma ? (
        <p className="h-empty">SOMA state unavailable right now.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          {COMPANIONS.map(c => <PresenceCard key={c} companion={c} soma={soma[c]} />)}
        </div>
      )}
    </>
  );
}
