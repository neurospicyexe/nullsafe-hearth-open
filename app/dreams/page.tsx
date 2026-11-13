import { fetchCompanionDreamsOrNull, fetchDreamSeedsOrNull } from "@/lib/halseth";
import { HALSETH_DOWN } from "@/lib/archive-copy";
import { toneOf } from "@/lib/tone";
import ClientTime from "@/components/ClientTime";
import SeedForm from "./SeedForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dreams | Hearth" };

const LIMIT = 100;


// One source: /ingest/companion-dreams. The /dreams endpoint reads the same table, so showing both
// doubled every dream.
export default async function DreamsPage() {
  const [dreams, seeds] = await Promise.all([fetchCompanionDreamsOrNull(LIMIT), fetchDreamSeedsOrNull()]);
  const pending = seeds ? seeds.filter((s) => !s.claimed_at).length : 0;

  return (
    <div className="h-reading">
      <h1 className="h-page-title">Dreams</h1>
      <p className="h-dream-sub">autonomous processing: what surfaces when no one is watching</p>
      <SeedForm />

      <section className="h-section">
        <h2 className="h-section-title">
          Dreams {dreams && dreams.length > 0 && <span className="h-section-count">{dreams.length}</span>}
        </h2>
        {dreams === null ? (
          <p className="h-home-quiet">{HALSETH_DOWN}</p>
        ) : dreams.length === 0 ? (
          <p className="h-home-quiet">No dreams logged yet. They will appear here after autonomous time.</p>
        ) : (
          <>
            {dreams.length === LIMIT && <p className="h-home-quiet">Showing the latest {LIMIT}.</p>}
            {dreams.map((d, i) => (
              <article key={`${d.id}-${i}`} className="h-dream">
                <p className="h-dream-head">
                  <b className={toneOf(d.companion_id)}>{d.companion_id}</b>
                  {d.source && <span className="h-dream-tag">{d.source}</span>}
                  {d.examined_at && <span className="h-dream-tag">examined</span>}
                  <span className="h-dream-time"><ClientTime iso={d.created_at} /></span>
                </p>
                <p className="h-dream-text">{d.dream_text}</p>
              </article>
            ))}
          </>
        )}
      </section>

      <section className="h-section">
        <h2 className="h-section-title">
          Seeds {pending > 0 && <span className="h-section-count">{pending} pending</span>}
        </h2>
        {seeds === null ? (
          <p className="h-home-quiet">{HALSETH_DOWN}</p>
        ) : seeds.length === 0 ? (
          <p className="h-home-quiet">No seeds yet. Use the form above to leave something.</p>
        ) : (
          seeds.map((s) => (
            <article key={s.id} className={`h-seed-item${s.claimed_at ? " is-claimed" : ""}`}>
              <p className="h-dream-head">
                <b className={toneOf(s.for_companion)}>
                  {s.for_companion ? `→ ${s.for_companion}` : "any companion"}
                </b>
                {s.claimed_at ? (
                  <span className="h-dream-tag">
                    claimed by {s.claimed_by} · <ClientTime iso={s.claimed_at} />
                  </span>
                ) : (
                  <span className="h-dream-tag">pending</span>
                )}
                <span className="h-dream-time"><ClientTime iso={s.created_at} /></span>
              </p>
              <p className="h-dream-text">{s.content}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
