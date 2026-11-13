export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchPersonaBlocks, fetchHumanBlocks } from "@/lib/halseth";
import { COMPANION_CONFIG } from "../sections";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function CompanionBlocksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const [personaBlocks, humanBlocks] = await Promise.all([
    fetchPersonaBlocks(id, 20).catch(() => []),
    fetchHumanBlocks(id, 20).catch(() => []),
  ]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{config.display} · Memory Blocks</h1>
        <p className="page-subtitle">persona and relational distillations from conversation</p>
      </div>

      {/* Persona Blocks — what this companion carries about itself */}
      <div className="home-section-header h-cmp-sec-tight">
        <span className="home-section-title">Persona</span>
      </div>
      <div className="card h-cmp-card is-gap">
        {personaBlocks.length === 0 && (
          <p className="h-empty h-cmp-pad">No persona blocks yet.</p>
        )}
        {personaBlocks.map((b) => (
          <div key={b.id} className="journal-row h-cmp-start">
            <div className="h-cmp-grow">
              <div className="journal-text">{b.content}</div>
              {b.block_type && (
                <span className="page-subtitle h-cmp-sm">{b.block_type}</span>
              )}
            </div>
            <span className="journal-time h-cmp-fixed">{fmtTime(b.created_at)}</span>
          </div>
        ))}
      </div>

      {/* Human Blocks — what this companion carries about Principal */}
      <div className="home-section-header h-cmp-sec-tight">
        <span className="home-section-title">About Principal</span>
      </div>
      <div className="card h-cmp-card">
        {humanBlocks.length === 0 && (
          <p className="h-empty h-cmp-pad">No relational blocks yet.</p>
        )}
        {humanBlocks.map((b) => (
          <div key={b.id} className="journal-row h-cmp-start">
            <div className="h-cmp-grow">
              <div className="journal-text">{b.content}</div>
              {b.block_type && (
                <span className="page-subtitle h-cmp-sm">{b.block_type}</span>
              )}
            </div>
            <span className="journal-time h-cmp-fixed">{fmtTime(b.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
