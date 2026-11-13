export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchRelationalHistory, type RelationalState } from "@/lib/halseth";
import { COMPANION_CONFIG } from "../sections";
import { stateTypeColor } from "../domain-colors";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function WeightDot({ value }: { value: number }) {
  const size = 6 + Math.round(value * 8);
  return (
    <div className="h-cmp-dot" style={{ "--s": `${size}px` } as React.CSSProperties} />
  );
}

export default async function CompanionRelationalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const states = await fetchRelationalHistory(id, 50).catch(() => []);

  // Group by 'toward' target for display
  const byTarget = states.reduce<Record<string, RelationalState[]>>((acc, s) => {
    (acc[s.toward] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div data-companion={id}>
      <div className="page-header">
        <h1 className="page-title">{config.display} · Relational State</h1>
        <p className="page-subtitle">what {config.display} is holding toward each relationship</p>
      </div>

      {states.length === 0 && (
        <div className="pending-notice">
          <div className="pending-dot" />
          No relational state recorded yet.
        </div>
      )}

      {Object.entries(byTarget).map(([toward, entries]) => {
        const latest = entries[0];
        return (
          <section key={toward} className="page-section">
            <div className="section-header">
              <h2 className="section-title section-title-flush h-cmp-tint">
                → {toward}
              </h2>
              <span className="section-row-meta h-cmp-sm">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            <div className="card h-cmp-card">
              {entries.map((s, i) => (
                <div
                  key={s.id}
                  className={`journal-row h-cmp-start${i === 0 ? "" : " h-cmp-older"}`}
                >
                  <WeightDot value={s.weight} />
                  <div className="h-cmp-grow">
                    <div className="journal-text">{s.state_text}</div>
                  </div>
                  <div className="h-cmp-col-end">
                    <span
                      className="note-type-badge h-cmp-tint h-cmp-edge"
                      style={{ "--c": stateTypeColor(s.state_type) } as React.CSSProperties}
                    >
                      {s.state_type}
                    </span>
                    <span className="journal-time">{fmtTime(s.noted_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
