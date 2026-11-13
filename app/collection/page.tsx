import { fetchCollectionOrNull } from "@/lib/halseth";
import type { CollectionForageItem, CollectionListenItem } from "@/lib/halseth";
import { memberClass } from "@/lib/kit";

export const dynamic = "force-dynamic";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;

// A small row of stars scaled to sparkle weight (the "shine" each item has earned).
function Sparkle({ weight }: { weight: number }) {
  const stars = Math.min(5, Math.max(0, Math.round(weight)));
  if (stars === 0) return <span className="h-collection-spark is-none">·</span>;
  return <span title={`sparkle ${weight.toFixed(1)}`} className="h-collection-spark">{"✦".repeat(stars)}</span>;
}

function ForageRow({ item }: { item: CollectionForageItem }) {
  return (
    <li className="h-collection-row">
      <div className="h-collection-line">
        <span className="h-collection-title">
          {item.source_url
            ? <a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.title}</a>
            : item.title}
        </span>
        <Sparkle weight={item.sparkle} />
      </div>
      <div className="h-meta">
        {item.domain}{item.consumed_at ? " · explored" : " · waiting"}
      </div>
    </li>
  );
}

function ListenRow({ item }: { item: CollectionListenItem }) {
  return (
    <li className="h-collection-row">
      <div className="h-collection-line">
        <span className="h-collection-title">
          {item.title}{item.artist ? <span className="h-collection-artist"> · {item.artist}</span> : null}
        </span>
        <Sparkle weight={item.sparkle} />
      </div>
    </li>
  );
}

export default async function CollectionPage() {
  const collections = await Promise.all(COMPANIONS.map((c) => fetchCollectionOrNull(c, 30)));
  const sections = COMPANIONS.map((id, i) => ({ id, data: collections[i] }));
  const reached = sections.filter((s) => s.data !== null);
  const total = reached.reduce((n, s) => n + s.data!.forage.length + s.data!.listens.length, 0);
  const unreached = sections.filter((s) => s.data === null);

  return (
    <div className="h-collection">
      <h1 className="h-page-title">Collection</h1>
      {reached.length === 0 ? (
        <p className="h-collection-quiet">Can&apos;t reach Halseth right now.</p>
      ) : (
        <>
          <p className="h-collection-lede">
            emotional archaeology; what each companion has gathered, ordered by what gripped (sparkle).
            a forage find shines when explored; a listen shines when it earns a reaction.
          </p>
          {unreached.map((s) => (
            <p key={s.id} className="h-collection-quiet">Can&apos;t load {s.id}&apos;s collection right now.</p>
          ))}
          {total === 0 ? (
            <p className="h-collection-quiet">Nothing collected yet.</p>
          ) : (
            reached.map(({ id, data }) => {
              const { forage, listens } = data!;
              return (
                <section key={id} className="h-collection-section">
                  <h2 className={`h-collection-h2 ${memberClass(id)}`}>{id}</h2>
                  <div className="h-collection-cols">
                    <div>
                      <h3 className="h-collection-h3">forage finds ({forage.length})</h3>
                      {forage.length === 0
                        ? <p className="h-collection-none">none</p>
                        : <ul className="h-collection-list">{forage.map((f) => <ForageRow key={f.id} item={f} />)}</ul>}
                    </div>
                    <div>
                      <h3 className="h-collection-h3">listens ({listens.length})</h3>
                      {listens.length === 0
                        ? <p className="h-collection-none">none</p>
                        : <ul className="h-collection-list">{listens.map((l) => <ListenRow key={l.id} item={l} />)}</ul>}
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
