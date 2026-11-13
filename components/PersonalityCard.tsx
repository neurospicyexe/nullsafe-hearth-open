import type { PresenceData } from "@/lib/halseth";

type Props = { personality: NonNullable<PresenceData["personality"]> };

const VALENCE_ORDER = ["toward", "tender", "neutral", "repair", "rupture"] as const;
const VALENCE_LABEL: Record<string, string> = {
  toward:  "toward",
  tender:  "tender",
  neutral: "neutral",
  repair:  "repair",
  rupture: "rupture",
};

export default function PersonalityCard({ personality: p }: Props) {
  if (p.total_deltas === 0) return null;

  const maxValence = Math.max(1, ...Object.values(p.valence));
  const totalInitiated = Object.values(p.initiated_by).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="card">
      <div className="card-title">
        Relational Shape
        <span className="personality-count">{p.total_deltas} moments</span>
      </div>

      <div className="valence-bars">
        {VALENCE_ORDER.filter((v) => p.valence[v] !== undefined).map((v) => (
          <div key={v} className="valence-row">
            <span className="valence-label">{VALENCE_LABEL[v]}</span>
            <div className="valence-track">
              <div
                className={`valence-fill ${v}`}
                style={{ width: `${((p.valence[v] ?? 0) / maxValence) * 100}%` }}
              />
            </div>
            <span className="valence-count">{p.valence[v] ?? 0}</span>
          </div>
        ))}
      </div>

      {totalInitiated > 0 && (
        <div className="initiated-row">
          {(["architect", "companion", "mutual"] as const).map((k) => {
            const n = p.initiated_by[k] ?? 0;
            const pct = Math.round((n / totalInitiated) * 100);
            return (
              <div key={k} className="initiated-stat">
                <span className="initiated-pct">{pct}%</span>
                <span className="initiated-label">{k}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
