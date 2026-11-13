export const dynamic = "force-dynamic";

import { fetchBasinHistory } from "@/lib/halseth";
import type { BasinHistory } from "@/lib/halseth";
import BasinsClient from "./BasinsClient";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;

export default async function BasinsPage() {
  // Per-companion fetch (endpoint caps at 500): 400 rows ≈ 90+ days at the
  // evaluator's 6h cadence.
  const results = await Promise.allSettled(
    COMPANIONS.map((id) => fetchBasinHistory(id, 400)),
  );

  const byCompanion: Record<string, BasinHistory[]> = {};
  COMPANIONS.forEach((id, i) => {
    const r = results[i];
    byCompanion[id] = r?.status === "fulfilled" ? r.value : [];
  });

  return <BasinsClient byCompanion={byCompanion} />;
}
