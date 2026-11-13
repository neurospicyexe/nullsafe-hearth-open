import Link from "next/link";
import type { HomeRow } from "@/lib/home-model";
import { Bars } from "@/components/kit/Bars";
import { PresenceRing } from "@/components/kit/PresenceRing";

/**
 * Three companion rings (name, state word, time), each opening that companion's tab. The meters Home
 * always showed stay one tap down, folded under the rings.
 */
export default function WhoIsHome({ rows }: { rows: HomeRow[] }) {
  return (
    <section aria-label="Who's home">
      <div className="h-rings">
        {rows.map((r) => (
          <Link key={r.id} href={`/companions/${r.id}`} className="h-rings-item" data-mood={r.mood}>
            <PresenceRing id={r.id} fresh={r.fresh} size="lg" />
            <span className="h-rings-name">{r.name}</span>
            <span className="h-rings-state">
              {r.status ? (r.statusStale ? `last said: ${r.status}, ${r.statusAge}` : r.status) : ""}
              {r.seenLabel ? `${r.status ? " · " : ""}${r.seenLabel}` : ""}
            </span>
          </Link>
        ))}
      </div>
      <details className="h-home-meters">
        <summary>Their meters</summary>
        <div className="h-home-card">
          {rows.map((r) =>
            r.bars.length > 0 ? (
              <Link key={r.id} href={`/companions/${r.id}`} className="h-home-row">
                <span className="h-home-name">{r.name}</span>
                <Bars color={r.colorVar} bars={r.bars} name={r.name} />
              </Link>
            ) : null,
          )}
        </div>
      </details>
    </section>
  );
}
