export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchSomaFeelings } from "@/lib/halseth";
import { COMPANION_CONFIG } from "../sections";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function IntensityBar({ value }: { value: number }) {
  return (
    <div className="h-cmp-bar is-wide">
      <i style={{ "--w": `${value}%` } as React.CSSProperties} />
    </div>
  );
}

export default async function CompanionFeelingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const feelings = await fetchSomaFeelings(id, 100).catch(() => []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{config.display} · SOMA Feelings</h1>
        <p className="page-subtitle">somatic emotional record — intensity and source</p>
      </div>

      {feelings.length === 0 && (
        <div className="pending-notice">
          <div className="pending-dot" />
          No SOMA feelings recorded yet.
        </div>
      )}

      <div className="card h-cmp-card">
        {feelings.map((f) => (
          <div key={f.id} className="journal-row h-cmp-center">
            <div className="h-cmp-grow">
              <div className="journal-text">
                {f.emotion}{f.sub_emotion ? ` · ${f.sub_emotion}` : ""}
              </div>
              {f.source && (
                <span className="page-subtitle h-cmp-sm">
                  {f.source}
                </span>
              )}
            </div>
            <IntensityBar value={f.intensity} />
            <span className="journal-time">{fmtTime(f.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
