export const dynamic = "force-dynamic";

import {
  fetchMetronomeActions,
  fetchAutonomySeeds,
  fetchGrowthJournal,
  type MetronomeAction,
  type AutonomySeed,
  type GrowthJournalEntry,
} from "@/lib/halseth";
import ManageClient, { type CompanionBundle } from "./ManageClient";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;

export default async function ManagePage() {
  const bundles = await Promise.all(
    COMPANIONS.map(async (id): Promise<CompanionBundle> => {
      const [actions, seeds, journal] = await Promise.all([
        fetchMetronomeActions(id).catch(() => [] as MetronomeAction[]),
        fetchAutonomySeeds(id, true).catch(() => [] as AutonomySeed[]),
        fetchGrowthJournal(id, 40).catch(() => [] as GrowthJournalEntry[]),
      ]);
      return { id, actions, seeds, journal };
    }),
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Manage</h1>
        <p className="page-subtitle">
          metronome actions, autonomy seeds, and journal pruning — no API required
        </p>
      </div>
      <ManageClient bundles={bundles} />
    </>
  );
}
