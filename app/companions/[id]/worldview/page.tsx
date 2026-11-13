export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchConclusions } from "@/lib/halseth";
import PinButton from "@/components/PinButton";
import type { ConclusionRow } from "@/lib/halseth";
import { COMPANION_CONFIG, fmtTime } from "../sections";
import { confidenceColor, FLAG_COLOR } from "../domain-colors";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

const BELIEF_TYPE_ORDER = ["self", "relational", "observational", "systemic"] as const;

const BELIEF_TYPE_LABELS: Record<string, string> = {
  self:          "Self",
  relational:    "Relational",
  observational: "Observational",
  systemic:      "Systemic",
};

export default async function WorldviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const all = await fetchConclusions(id);

  // Active only (superseded_by null); Halseth may or may not pre-filter — guard both ways
  const active = all.filter((c) => !c.superseded_by);

  const grouped: Record<string, ConclusionRow[]> = {};
  for (const type of BELIEF_TYPE_ORDER) {
    grouped[type] = active.filter((c) => c.belief_type === type);
  }

  // Catch any belief_type values not in the ordered list
  const otherTypes = [...new Set(active.map((c) => c.belief_type))].filter(
    (t) => !(BELIEF_TYPE_ORDER as readonly string[]).includes(t),
  );
  for (const type of otherTypes) {
    grouped[type] = active.filter((c) => c.belief_type === type);
  }
  const allTypes = [...BELIEF_TYPE_ORDER, ...otherTypes];

  return (
    <div data-companion={id}>
      {/* Header */}
      <div className="companion-header">
        <div className={`companion-avatar companion-avatar--lg ${id}`}>
          {config.sym}
        </div>
        <div className="h-cmp-grow">
          <h1 className="companion-header-name">Worldview</h1>
          <p className="companion-header-tagline">{config.display}</p>
        </div>
      </div>

      {/* Empty state */}
      {active.length === 0 && (
        <section className="page-section">
          <p className="h-empty">No conclusions recorded yet.</p>
        </section>
      )}

      {/* Belief-type sections */}
      {allTypes.map((type) => {
        const items = grouped[type];
        if (!items?.length) return null;
        return (
          <section key={type} className="page-section">
            <h2 className="section-title">{BELIEF_TYPE_LABELS[type] ?? type}</h2>
            <div className="section-list">
              {items.map((c) => {
                const flagged = c.contradiction_flagged === 1;
                const cc = confidenceColor(c.confidence);
                return (
                  <div key={c.id} className="section-row h-cmp-col">
                    {/* Conclusion text (a flagged one carries the [?] flagged badge, not an edge accent) */}
                    <span className="section-row-text h-cmp-body is-bold">
                      {c.conclusion_text}
                    </span>

                    {/* Meta row */}
                    <div className="h-cmp-wrap is-mid">
                      {/* Pin (mig 0148): keeps this belief in front of them at every boot */}
                      <PinButton companionId={id} kind="conclusion" id={c.id} pinned={!!c.pinned_at} compact />
                      {/* Confidence bar + value */}
                      <span
                        className="h-cmp-badge"
                        style={{ "--c": cc } as React.CSSProperties}
                      >
                        {Number.isFinite(c.confidence) ? c.confidence.toFixed(2) : "--"}
                      </span>

                      {/* Subject tag */}
                      {c.subject && (
                        <span className="h-cmp-badge">
                          {c.subject}
                        </span>
                      )}

                      {/* Contradiction flag */}
                      {flagged && (
                        <span
                          className="h-cmp-badge"
                          style={{ "--c": FLAG_COLOR } as React.CSSProperties}
                        >
                          [?] flagged
                        </span>
                      )}

                      {/* Timestamp */}
                      <span className="section-row-meta h-cmp-sm">
                        {fmtTime(c.created_at)}
                        {c.edited_at ? ` · edited ${fmtTime(c.edited_at)}` : ""}
                      </span>
                    </div>

                    {/* Provenance */}
                    {c.provenance && (
                      <span className="section-row-meta h-cmp-sm is-italic">
                        {c.provenance}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
