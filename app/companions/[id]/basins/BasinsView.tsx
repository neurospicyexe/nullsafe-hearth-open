import type { BasinsData, CompanionId } from "@/lib/halseth";
import { COMPANION_NAME } from "@/lib/companion-page";
import { causeLine, orderHistory, paceLine, replacedBy, statusLine } from "@/lib/basins";
import WitnessButtons from "./WitnessButtons";

// Ground and rows, not cards. The words are the companion's own, rendered as text (React escapes them).
// The companion's hue is one hairline on the title (identity only); a pending move is marked by the lamp line.
export default function BasinsView({ id, data, now }: { id: CompanionId; data: BasinsData | null; now: Date }) {
  const name = COMPANION_NAME[id];
  const hue = { borderTopColor: `var(--h-${id})` };
  if (data === null) {
    return (
      <div className="h-basins">
        <h1 className="h-basins-title" style={hue}>Basins</h1>
        <p className="h-basins-quiet">Can&apos;t reach {name}&apos;s basins right now.</p>
      </div>
    );
  }
  const history = orderHistory(data.history);
  const pace = paceLine(data.pace_days, data.window_opens, now);
  return (
    <div className="h-basins">
      <h1 className="h-basins-title" style={hue}>Basins</h1>
      {data.live.length === 0 && <p className="h-basins-quiet">No basins yet.</p>}
      <section aria-label="Where each basin sits now">
        {data.live.map((b) => (
          <article key={b.id} className="h-basins-row">
            <h2 className="h-basins-name">{b.name}</h2>
            <p className="h-basins-body">{b.description}</p>
            <p className="h-basins-meta">
              {statusLine(b, now)}
              {causeLine(b) && <span> · revised {causeLine(b)}</span>}
              {b.witnessed_by === "principal" && <span> · you witnessed it</span>}
            </p>
          </article>
        ))}
      </section>
      {history.length > 0 && (
        <section aria-label="Earlier wordings and proposals">
          <h2 className="h-basins-h2">History</h2>
          {history.map((b) => {
            const old = b.status === "awaiting_witness" ? replacedBy(b, data.live) : null;
            return (
              <article key={b.id} className={`h-basins-row h-basins-${b.status}`}>
                <h3 className="h-basins-name">{b.name}</h3>
                {old && <p className="h-basins-old"><span className="h-basins-label">Now: </span>{old.description}</p>}
                <p className="h-basins-body">
                  {b.status === "awaiting_witness" && <span className="h-basins-label">Proposed: </span>}
                  {b.description}
                </p>
                <p className="h-basins-meta">
                  {statusLine(b, now)}
                  {causeLine(b) && <span> · {causeLine(b)}</span>}
                  {b.revision_note && <span> · your note: {b.revision_note}</span>}
                </p>
                {b.status === "awaiting_witness" && <WitnessButtons id={b.id} companionName={name} />}
              </article>
            );
          })}
        </section>
      )}
      {pace && <footer className="h-basins-foot"><p>{pace}</p></footer>}
    </div>
  );
}
