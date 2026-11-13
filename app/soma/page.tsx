export const dynamic = "force-dynamic";

import { fetchSomaStates, fetchTensionsFor, fetchBasinHistory, fetchSomaticSnapshots } from "@/lib/halseth";
import type { CompanionTension, BasinHistory, SomaticSnapshot } from "@/lib/halseth";
import SomaClient from "./SomaClient";

export default async function SomaPage() {
  // Per companion, simmering only. The old single `fetchTensions(undefined, 20)` hit the sync
  // feed, which returns EVERY status -- so "Active Tensions" listed crystallized and released
  // ones, and a release reappeared on the next load looking like the button had failed.
  const [data, cyT, drT, gaT, basins, snapshots] = await Promise.allSettled([
    fetchSomaStates(),
    fetchTensionsFor("cypher"),
    fetchTensionsFor("drevan"),
    fetchTensionsFor("gaia"),
    fetchBasinHistory(undefined, 10),
    fetchSomaticSnapshots(undefined, 6),
  ]);

  // One companion's read failing must not blank the other two.
  const tensions: CompanionTension[] = [cyT, drT, gaT].flatMap(r =>
    r.status === "fulfilled" ? r.value : [],
  );

  return (
    <SomaClient
      initialData={data.status === "fulfilled" ? data.value : null}
      tensions={tensions}
      basins={basins.status === "fulfilled" ? (basins.value as BasinHistory[]) : []}
      snapshots={snapshots.status === "fulfilled" ? (snapshots.value as SomaticSnapshot[]) : []}
    />
  );
}
