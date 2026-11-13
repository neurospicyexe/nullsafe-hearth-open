export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchCompanionRundown, fetchSomaStates } from "@/lib/halseth";
import { COMPANION_COLOR } from "@/lib/shell";
import { ageLabel, buildWhoIsHome } from "@/lib/home-model";
import { PresenceRing } from "@/components/kit/PresenceRing";
import { COMPANION_NAME, companionBars, companionDoors, parseCompanionId, recordsRow, rundownLines } from "@/lib/companion-page";
import { Bars } from "@/components/kit/Bars";
import DoorList from "@/components/kit/DoorList";
import LookedMark from "./LookedMark";

// The companion overview: what they last said, what is new since Principal last looked, their three
// meters with a 7-day trace, and the doors into everything else. The old long page is at /all.
export default async function CompanionOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();

  const [rundown, soma] = await Promise.all([fetchCompanionRundown(id), fetchSomaStates()]);
  const now = Date.now();
  const nowDate = new Date(now);
  const name = COMPANION_NAME[id];
  const row = soma?.[id] ?? null;
  // Same builder and wording as Who's home, so the header and Home cannot disagree.
  const home = buildWhoIsHome(soma, nowDate).find((r) => r.id === id);
  const statusLine = home?.status ? (home.statusStale ? `last said: ${home.status}, ${home.statusAge}` : home.status) : "";
  const seen = ageLabel(row?.seen_at ?? null, nowDate);
  const bars = companionBars(row, rundown);
  const last = rundown?.last_real_thing ?? null;
  const lastAge = last ? ageLabel(last.at, nowDate) : "";

  return (
    <div className="h-companion" data-companion={id} data-mood={home?.mood ?? "steady"} style={{ "--c": COMPANION_COLOR[id] } as React.CSSProperties}>
      <header className="h-companion-head">
        <div className="h-companion-id">
          <PresenceRing id={id} fresh={home?.fresh ?? false} size="lg" />
          <div className="h-companion-id-text">
            <h1 className="h-companion-name">{name}</h1>
            {statusLine && <span className="h-companion-status">{statusLine}</span>}
          </div>
        </div>
        {seen && <span className="h-companion-seen">seen {seen}</span>}
      </header>

      <section className="h-companion-section" aria-label="What is new">
        {rundown ? (
          <Rundown last={last} lastAge={lastAge} summary={rundownLines(rundown, now)} />
        ) : (
          <p className="h-companion-quiet">Can&apos;t reach Halseth right now.</p>
        )}
      </section>

      {bars.length > 0 && (
        <section className="h-companion-section" aria-label="State">
          <Bars color="var(--c)" bars={bars} name={name} />
        </section>
      )}

      <section className="h-companion-section" aria-label="Pages">
        <DoorList doors={companionDoors(id, rundown)} />
        <Link href={`/companions/${id}/all`} className="h-companion-more">
          Everything else
        </Link>
      </section>

      <nav className="h-companion-records" aria-label="Records">
        <span>{recordsRow(id).label}:</span>
        {recordsRow(id).links.map((l) => (
          <Link key={l.href} href={l.href} className="h-companion-records-link">{l.label}</Link>
        ))}
        <span aria-hidden="true">›</span>
      </nav>

      {/* Only a look Principal could actually see gets recorded. */}
      {rundown && <LookedMark id={id} />}
    </div>
  );
}

function Rundown({
  last,
  lastAge,
  summary,
}: {
  last: { text: string } | null;
  lastAge: string;
  summary: { heading: string; lines: string[] };
}) {
  return (
    <>
      {last && (
        <p className="h-companion-last">
          <q>{last.text}</q>
          {lastAge && <span className="h-companion-age"> {lastAge}</span>}
        </p>
      )}
      <h2 className="h-companion-h2">{summary.heading}</h2>
      <ul className="h-companion-lines">
        {summary.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </>
  );
}
