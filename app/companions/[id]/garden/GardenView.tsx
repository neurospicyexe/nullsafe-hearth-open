import type { GardenData } from "@/lib/halseth";
import {
  awaitingLine, dayLabel, gardenIsEmpty, witnessWaiting, orderPlantings, orderWitnessDays,
  plantingDates, plantingLabel, restingLine, timeLabel,
} from "@/lib/garden";

// Ground and rows, not cards. Text is rendered as text (React escapes it); line breaks are kept by CSS.
export default function GardenView({ garden, now }: { garden: GardenData | null; now: Date }) {
  const resting = garden ? restingLine(garden.resting) : "";
  const awaiting = garden ? awaitingLine(garden.awaiting) : "";
  const days = garden?.witness ? orderWitnessDays(garden.witness.days) : [];
  return (
    <div className="h-garden">
      <h1 className="h-garden-title">Garden</h1>
      {garden === null ? (
        <p className="h-garden-quiet">Can&apos;t reach the garden right now.</p>
      ) : (
        <>
          {gardenIsEmpty(garden) && <p className="h-garden-quiet">Nothing planted yet.</p>}
          {witnessWaiting(garden) && <p className="h-garden-quiet">The witness is planted. Its first day has not come up yet.</p>}
          {days.length > 0 && (
            <section className="h-garden-witness" aria-label="Witness">
              <h2 className="h-garden-h2">Witness</h2>
              {days.map((d) => (
                <div key={d.day} className="h-garden-day">
                  <h3 className="h-garden-dayname">{dayLabel(d.day, now)}</h3>
                  <ul className="h-garden-lines">
                    {d.entries.map((e) => (
                      <li key={e.id} className="h-garden-line">
                        <span className="h-garden-time">{timeLabel(e.at)}</span>
                        <span className="h-garden-text">{e.text}</span>
                        <span className="h-garden-type">{e.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {garden.planted.length > 0 && (
            <section className="h-garden-planted" aria-label="Planted">
              {orderPlantings(garden.planted).map((p) => {
                const dates = plantingDates(p, now);
                return (
                  <article key={p.id} className="h-garden-planting">
                    <p className="h-garden-body">{p.text}</p>
                    <p className="h-garden-meta">
                      <span className="h-garden-label">{plantingLabel(p)}</span>
                      {dates && <span> · {dates}</span>}
                    </p>
                  </article>
                );
              })}
            </section>
          )}
          {(resting || awaiting) && (
            <footer className="h-garden-foot">
              {resting && <p>{resting}</p>}
              {awaiting && <p>{awaiting}</p>}
            </footer>
          )}
        </>
      )}
    </div>
  );
}
