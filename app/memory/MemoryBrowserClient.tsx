"use client";

import { useState, useMemo } from "react";
import { toneOf } from "@/lib/tone";
import ClientTime from "@/components/ClientTime";

export type MemoryEntry = {
  id: string;
  type: "companion_note" | "feeling" | "tension" | "sit";
  companion: string;
  content: string;
  tags?: string[];
  created_at: string;
};

const ALL_TYPES      = ["all", "companion_note", "feeling", "tension", "sit"] as const;
const ALL_COMPANIONS = ["all", "cypher", "drevan", "gaia"] as const;
type TypeFilter      = typeof ALL_TYPES[number];
type CompFilter      = typeof ALL_COMPANIONS[number];

const TYPE_LABEL: Record<string, string> = {
  companion_note: "note",
  feeling:        "feeling",
  tension:        "tension",
  sit:            "sit",
};


const PAGE_SIZE = 30;

export default function MemoryBrowserClient({ entries }: { entries: MemoryEntry[] }) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [compFilter, setCompFilter] = useState<CompFilter>("all");
  const [query, setQuery]           = useState("");
  const [page, setPage]             = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      if (compFilter !== "all" && e.companion !== compFilter) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (q) {
        const inContent = e.content.toLowerCase().includes(q);
        const inTags    = (e.tags ?? []).some(t => t.toLowerCase().includes(q));
        if (!inContent && !inTags) return false;
      }
      return true;
    });
  }, [entries, typeFilter, compFilter, query]);

  const paged   = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paged.length < filtered.length;

  function handleType(t: TypeFilter) { setTypeFilter(t); setPage(1); }
  function handleComp(c: CompFilter) { setCompFilter(c); setPage(1); }
  function handleQuery(v: string)    { setQuery(v);      setPage(1); }

  return (
    <>
      <p className="h-mem-sub">{entries.length} entries · notes, feelings, tensions, sits</p>

      <input
        type="search"
        placeholder="Search…"
        value={query}
        onChange={e => handleQuery(e.target.value)}
        className="h-mem-search"
        aria-label="Search memory"
      />

      <div className="h-chips h-mem-chips">
        {ALL_TYPES.map(t => (
          <button
            key={t}
            className={`h-chip ${typeFilter === t ? "is-on" : ""}`}
            onClick={() => handleType(t)}
          >
            {t === "all" ? "all types" : TYPE_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      <div className="h-chips h-mem-chips">
        {ALL_COMPANIONS.map(c => (
          <button
            key={c}
            className={`h-chip ${c !== "all" ? toneOf(c) : ""} ${compFilter === c ? "is-on" : ""}`}
            onClick={() => handleComp(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="h-mem-count">
        {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        {(typeFilter !== "all" || compFilter !== "all" || query.trim()) &&
          ` · filtered from ${entries.length}`}
      </div>

      {filtered.length === 0 ? (
        <p className="h-home-quiet">No entries match these filters.</p>
      ) : (
        <>
          <div className="h-mem-feed">
            {paged.map(e => (
              <article key={e.id} className={`h-mem-entry h-mem-type-${e.type}`}>
                <header className="h-mem-head">
                  <b className={toneOf(e.companion)}>{e.companion}</b>
                  <span className="h-mem-badge">{TYPE_LABEL[e.type] ?? e.type}</span>
                  {Array.isArray(e.tags) && e.tags.length > 0 && (
                    <span className="h-mem-tags">{e.tags.join(" · ")}</span>
                  )}
                  <span className="h-mem-time">
                    <ClientTime iso={e.created_at} />
                  </span>
                </header>
                <p className="h-mem-body">{e.content}</p>
              </article>
            ))}
          </div>

          {hasMore && (
            <button className="h-chip h-mem-more" onClick={() => setPage(p => p + 1)}>
              Load more ({filtered.length - paged.length} remaining)
            </button>
          )}
        </>
      )}
    </>
  );
}
