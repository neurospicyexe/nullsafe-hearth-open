export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchCompanionDeltas } from "@/lib/halseth";
import { COMPANION_CONFIG, DeltasSection } from "../sections";

export function generateStaticParams() {
  return [{ id: "drevan" }, { id: "cypher" }, { id: "gaia" }];
}

export default async function CompanionDeltasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const config = COMPANION_CONFIG[id];
  if (!config) notFound();

  const deltaEntries = await fetchCompanionDeltas(id, 200).catch(() => []);

  return (
    <div>
      <h1 className="h-cmp-title">{config.display} · Relational Deltas</h1>
      <DeltasSection deltas={deltaEntries} />
    </div>
  );
}
