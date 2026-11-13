export const dynamic = "force-dynamic";

import { fetchArchitectFacts, type ArchitectFact } from "@/lib/halseth";
import ClientTime from "@/components/ClientTime";
import { toneOf } from "@/lib/tone";
import { replacesLine } from "@/lib/facts";
import FactActions from "./FactActions";
import RetireAllButton from "./RetireAllButton";

const COMPANION_NAME: Record<string, string> = {
  drevan: "Drevan",
  cypher: "Cypher",
  gaia: "Gaia",
};

function companionLabel(id: string | null): string {
  return id ? (COMPANION_NAME[id] ?? id) : "unattributed";
}

// Mirrors Halseth's CATEGORY_TITLES (halseth/src/handlers/architect-facts.ts) — same order,
// "how to treat him first, biography after," then anything the triad invented since, alphabetically.
const CATEGORY_TITLES: Record<string, string> = {
  addressing: "How he is addressed",
  plural: "Plural system",
  people: "The people",
  work: "Work and school",
  body: "Body and regulation",
  animals: "The animals",
  anchors: "What he brings",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_TITLES);

function categoryTitle(cat: string): string {
  return CATEGORY_TITLES[cat] ?? cat.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

// D1 timestamps are "YYYY-MM-DD HH:MM:SS" UTC, no zone marker.
function ageDays(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt.replace(" ", "T") + "Z").getTime();
  return Math.floor(ms / 86_400_000);
}

function groupByCompanion(facts: ArchitectFact[]): Array<[string | null, ArchitectFact[]]> {
  const groups = new Map<string | null, ArchitectFact[]>();
  for (const f of facts) {
    const key = f.companion_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  // Named companions first (alphabetical), unattributed last.
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return companionLabel(a).localeCompare(companionLabel(b));
  });
}

export default async function FactsPage() {
  const facts = await fetchArchitectFacts();
  const open = facts
    .filter((f) => f.status === "open")
    .sort((a, b) => b.created_at.localeCompare(a.created_at)); // newest first
  const active = facts.filter((f) => f.status === "active");

  const oldestOpenDays = open.length
    ? Math.max(...open.map((f) => ageDays(f.created_at)))
    : 0;

  const openByCompanion = groupByCompanion(open);

  const knownCats = new Set(CATEGORY_ORDER);
  const extraCats = [...new Set(active.map((f) => f.category).filter((c) => !knownCats.has(c)))].sort();
  const activeByCategory = [...CATEGORY_ORDER, ...extraCats]
    .map((cat): [string, ArchitectFact[]] => [cat, active.filter((f) => f.category === cat)])
    .filter(([, rows]) => rows.length > 0);

  return (
    <main>
      <header className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Facts about Principal</h1>
        </div>
        <p className="section-row-meta">
          {open.length} open{open.length > 0 ? ` (oldest ${oldestOpenDays}d)` : ""} · {active.length} active
        </p>
      </header>

      <section style={{ marginBottom: "2.5rem" }}>
        <div className="home-section-header">
          <span className="home-section-title">Open — waiting on you</span>
        </div>

        {open.length === 0 ? (
          <div className="card" style={{ marginBottom: "1rem" }}>
            <span className="section-row-meta">Nothing open. Every proposed fact has been confirmed or retired.</span>
          </div>
        ) : (
          <>
            <RetireAllButton />
            {openByCompanion.map(([companionId, rows]) => (
              <div key={companionId ?? "unattributed"} style={{ marginBottom: "1.5rem" }}>
                <span
                  className={`section-row-meta h-fact-group ${toneOf(companionId)}`}
                >
                  {companionLabel(companionId)} · {rows.length}
                </span>
                {rows.map((f) => {
                  const replaces = replacesLine(f, facts);
                  return (
                  <div key={f.id} className="section-row" style={{ marginTop: "0.5rem", alignItems: "flex-start" }}>
                    <div>{f.fact}</div>
                    {replaces && (
                      <div className="section-row-meta" style={{ marginTop: "0.35rem" }}>
                        replaces: {replaces}
                      </div>
                    )}
                    <div className="section-row-meta" style={{ marginTop: "0.35rem" }}>
                      {categoryTitle(f.category)} · {ageDays(f.created_at)}d old · source: {f.source ?? "unattributed"} ·{" "}
                      <ClientTime iso={f.created_at} />
                    </div>
                    <FactActions
                      id={f.id}
                      fact={f.fact}
                      category={f.category}
                      status="open"
                    />
                  </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </section>

      <section>
        <div className="home-section-header">
          <span className="home-section-title">Active</span>
        </div>

        {active.length === 0 ? (
          <div className="card">
            <span className="section-row-meta">No active facts yet.</span>
          </div>
        ) : (
          activeByCategory.map(([cat, rows]) => (
            <div key={cat} style={{ marginBottom: "1.5rem" }}>
              <span
                className="section-row-meta"
                style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.72rem" }}
              >
                {categoryTitle(cat)} · {rows.length}
              </span>
              {rows.map((f) => (
                <div key={f.id} className="section-row" style={{ marginTop: "0.5rem", alignItems: "flex-start" }}>
                  <div>{f.fact}</div>
                  <div className="section-row-meta" style={{ marginTop: "0.35rem" }}>
                    {companionLabel(f.companion_id)} · source: {f.source ?? "unattributed"} ·{" "}
                    <ClientTime iso={f.created_at} />
                  </div>
                  <FactActions
                    id={f.id}
                    fact={f.fact}
                    category={f.category}
                    status="active"
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
