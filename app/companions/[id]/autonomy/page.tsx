export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import {
  fetchAutonomyRuns,
  fetchAutonomySeeds,
} from "@/lib/halseth";
import type {
  AutonomyRun,
} from "@/lib/halseth";
import { COMPANION_CONFIG, fmtTime } from "../sections";
import SeedsClient from "./SeedsClient";
import { runStatusColor, runTypeColor } from "../domain-colors";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

export default async function AutonomyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const [runsRes, seedsRes] = await Promise.allSettled([
    fetchAutonomyRuns(id, 20),
    fetchAutonomySeeds(id),
  ]);

  const runs   = (runsRes.status   === "fulfilled" ? runsRes.value   : null) ?? [];
  const allSeeds = (seedsRes.status === "fulfilled" ? seedsRes.value : null) ?? [];

  const sortedRuns = [...runs].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  const availableSeeds = [...allSeeds]
    .filter((s) => s.used_at === null)
    .sort((a, b) => b.priority - a.priority);

  const usedSeeds = [...allSeeds]
    .filter((s) => s.used_at !== null)
    .sort((a, b) => {
      const aTime = a.used_at ? new Date(a.used_at).getTime() : 0;
      const bTime = b.used_at ? new Date(b.used_at).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div data-companion={id}>
      {/* Page title */}
      <div className="companion-header">
        <div className={`companion-avatar companion-avatar--lg ${id}`}>
          {config.sym}
        </div>
        <div className="h-cmp-grow">
          <h1 className="companion-header-name">Autonomy</h1>
          <p className="companion-header-tagline">{config.display}</p>
        </div>
      </div>

      {/* ── Section 1: Recent Runs ── */}
      <section className="page-section">
        <h2 className="section-title">Recent Runs</h2>
        {sortedRuns.length === 0 ? (
          <p className="h-empty">No runs recorded yet</p>
        ) : (
          <div className="section-list">
            {sortedRuns.map((run) => {
              return (
                <div key={run.id} className="section-row h-cmp-col">
                  {/* Type + status row: status is carried by its badge, not an edge accent */}
                  <div className="h-cmp-wrap">
                    <span
                      className="h-cmp-badge"
                      style={{ "--c": runTypeColor(run.run_type) } as React.CSSProperties}
                    >
                      {run.run_type}
                    </span>

                    <span
                      className="h-cmp-badge"
                      style={{ "--c": runStatusColor(run.status) } as React.CSSProperties}
                    >
                      {run.status === "running" && <span className="live-dot" />}
                      {run.status}
                    </span>
                  </div>

                  {/* Timestamps */}
                  <div className="h-cmp-wrap is-wide">
                    <span className="section-row-meta h-cmp-sm">
                      started: {run.started_at ? fmtTime(run.started_at) : "—"}
                    </span>
                    <span className="section-row-meta h-cmp-sm">
                      completed: {run.completed_at ? fmtTime(run.completed_at) : "—"}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="h-cmp-wrap is-wide">
                    <span className="section-row-meta h-cmp-sm">
                      tokens: {run.tokens_used}
                    </span>
                    <span className="section-row-meta h-cmp-sm">
                      artifacts: {run.artifacts_created}
                    </span>
                  </div>

                  {/* Error */}
                  {run.error_message && (
                    <p className="h-cmp-err h-cmp-flush">
                      {run.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Seeds ── */}
      <section className="page-section">
        <h2 className="section-title">Seeds</h2>
        <SeedsClient
          companionId={id}
          availableSeeds={availableSeeds}
          usedSeeds={usedSeeds}
        />
      </section>
    </div>
  );
}
