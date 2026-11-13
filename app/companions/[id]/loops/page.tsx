export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchLoops } from "@/lib/halseth";
import { COMPANION_CONFIG } from "../sections";
import { CloseLoopButton } from "./CloseButton";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function WeightBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="h-cmp-bar">
      <i style={{ "--w": `${pct}%` } as React.CSSProperties} />
    </div>
  );
}

export default async function CompanionLoopsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const loops = await fetchLoops(id).catch(() => []);
  const open = loops.filter((l) => !l.closed_at);
  const closed = loops.filter((l) => l.closed_at);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{config.display} · Open Loops</h1>
        <p className="page-subtitle">unresolved threads carried between sessions · heaviest first</p>
      </div>

      {open.length === 0 && (
        <div className="pending-notice">
          <div className="pending-dot" />
          No open loops right now.
        </div>
      )}

      {open.length > 0 && (
        <div className="card h-cmp-card">
          {open.map((loop) => (
            <div key={loop.id} className="journal-row h-cmp-center h-cmp-gap">
              <div className="h-cmp-grow">
                <div className="journal-text">{loop.loop_text}</div>
                <span className="journal-time">{fmtTime(loop.opened_at)}</span>
              </div>
              <WeightBar value={loop.weight} />
              <CloseLoopButton loopId={loop.id} companionId={id} />
            </div>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="section-title h-cmp-mt-lg">
            Closed ({closed.length})
          </h2>
          {/* No clip. This IS the loops page -- the header already names the real count, and
              hiding rows behind it left nothing to click to reach them. On a dedicated full-list
              page the fetch limit is the only cap, and it is stated once rather than twice. */}
          <div className="card h-cmp-card is-closed">
            {closed.map((loop) => (
              <div key={loop.id} className="journal-row">
                <div className="h-cmp-grow">
                  <div className="journal-text h-cmp-strike">
                    {loop.loop_text}
                  </div>
                  <span className="journal-time">{fmtTime(loop.closed_at!)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
