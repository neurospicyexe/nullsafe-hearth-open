import { fetchSomaFeelings } from "@/lib/halseth";

export const dynamic = "force-dynamic";

import ClientTime from "@/components/ClientTime";
import { toneOf } from "@/lib/tone";

export default async function FeelingsPage() {
  const feelings = await fetchSomaFeelings(undefined, 100);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Feelings</h1>
        <p className="page-subtitle">SOMA feeling log — per-companion emotion entries</p>
      </div>

      {feelings.length === 0 ? (
        <p className="h-empty">No feeling entries yet.</p>
      ) : (
        <div className="journal-feed">
          {feelings.map((f) => {
            return (
              <div key={f.id} className="journal-entry">
                <div className="journal-text">{f.emotion}{f.sub_emotion ? ` · ${f.sub_emotion}` : ""}</div>
                <div className="delta-meta delta-meta-mt">
                  <span className={toneOf(f.companion_id)} style={{ fontWeight: 600 }}>{f.companion_id}</span>
                  {f.intensity != null && <span>intensity {f.intensity}</span>}
                  {f.source && <span>{f.source}</span>}
                  <span className="ml-auto"><ClientTime iso={f.created_at} /></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
