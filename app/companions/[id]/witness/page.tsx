export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { parseCompanionId } from "@/lib/companion-page";
import { fetchGaiaWitness } from "@/lib/halseth";
import { GaiaWitnessSection } from "../sections";

export function generateStaticParams() {
  return [{ id: "gaia" }];
}

export default async function CompanionWitnessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (id !== "gaia") notFound();

  const witnessEntries = await fetchGaiaWitness(200);

  return (
    <div>
      <h1 className="h-cmp-title">Witness ledger</h1>
      <p className="h-meta">
        Shared by all three: each of them logs what you got through here. Each line says who wrote it.
      </p>
      <GaiaWitnessSection entries={witnessEntries} />
    </div>
  );
}
