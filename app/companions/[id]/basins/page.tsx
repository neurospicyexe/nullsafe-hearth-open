export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { fetchBasins } from "@/lib/halseth";
import { parseCompanionId } from "@/lib/companion-page";
import BasinsView from "./BasinsView";

// A companion's basins: where each sits now, and every earlier wording with the event that moved it.
// Anything that is not drevan/cypher/gaia is a 404 before any Halseth call.
export default async function CompanionBasinsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const data = await fetchBasins(id);
  return <BasinsView id={id} data={data} now={new Date()} />;
}
