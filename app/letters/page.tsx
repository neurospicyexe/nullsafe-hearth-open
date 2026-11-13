export const dynamic = "force-dynamic";

import Link from "next/link";
import { fetchInbox, fetchLettersOut } from "@/lib/halseth";
import { agentIdentity, ageLabel } from "@/lib/home-model";
import { parseCompanionId } from "@/lib/companion-page";
import { mergeLetters, directionLabel } from "@/lib/letters-model";
import { HALSETH_DOWN } from "@/lib/archive-copy";

export const metadata = { title: "Letters | Hearth" };

const FILTERS: { id: string | null; label: string }[] = [
  { id: null, label: "All" },
  { id: "drevan", label: "Drevan" },
  { id: "cypher", label: "Cypher" },
  { id: "gaia", label: "Gaia" },
];

export default async function LettersPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const { with: rawWith } = await searchParams;
  const who = rawWith ? parseCompanionId(rawWith) ?? undefined : undefined;
  const [inbox, out] = await Promise.all([fetchInbox(100, who), fetchLettersOut(100, who)]);
  const now = new Date();
  const rows = mergeLetters(inbox?.items ?? [], out ?? []);

  return (
    <div className="h-reading">
      <h1 className="h-page-title">Letters</h1>
      <nav aria-label="Filter letters" className="h-chips h-letters-filter">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.id ? `/letters?with=${f.id}` : "/letters"}
            className={`h-chip${(who ?? null) === f.id ? " is-on" : ""}`}
            aria-current={(who ?? null) === f.id ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {inbox === null && out === null ? (
        <p className="h-home-quiet">{HALSETH_DOWN}</p>
      ) : (
        <>
          {out === null && <p className="h-home-quiet">Couldn&apos;t load the letters you left for them.</p>}
          {inbox === null && <p className="h-home-quiet">Couldn&apos;t load the letters left for you.</p>}
          {rows.length === 0 && inbox !== null && out !== null ? (
            <p className="h-home-quiet">No letters yet.</p>
          ) : (
            <div className="h-letters">
              {rows.map((r) => {
                const { who: name, colorVar } = agentIdentity(r.companion);
                const tone = colorVar ? `h-tone-${r.companion}` : "h-tone-none";
                const label = directionLabel(r, name);
                const when = ageLabel(r.at, now);
                if (r.dir === "in" && r.href) {
                  return (
                    <Link key={r.key} href={r.href} className={`h-letter-row${r.read ? " is-read" : ""}`}>
                      <span aria-hidden="true" className={`h-dot h-letter-dot ${tone}`} />
                      <span className="h-home-item-body">
                        <span className="h-home-item-head">
                          <b className={tone}>{label}</b>{" "}
                          <span className="h-home-item-meta">
                            {when}
                            {r.read ? " · read" : " · new"}
                          </span>
                        </span>
                        <span className="h-home-item-preview">{r.text}</span>
                      </span>
                    </Link>
                  );
                }
                return (
                  <div key={r.key} className="h-letter-out">
                    <span className="h-home-item-head">
                      <b className={tone}>{label}</b>{" "}
                      <span className="h-home-item-meta">{when}</span>
                    </span>
                    <p className="h-letter-out-text">{r.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
