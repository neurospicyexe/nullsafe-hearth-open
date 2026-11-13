export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { fetchCompanionMakes, fetchMakeSource } from "@/lib/halseth";
import { needsSource } from "@/lib/makes";
import { COMPANION_NAME, parseCompanionId } from "@/lib/companion-page";
import MakeCard from "./MakeCard";

// The shelf: everything this companion made (files, writing, pages, beats, and the older generated
// images Halseth merges in), each with a Download link. Principal uploads the videos and drawings by
// hand from here, so the links are buttons, not captions.
export default async function CompanionMadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();

  const makes = await fetchCompanionMakes(id, 40);
  const now = new Date();
  const sources = new Map<string, string | null>();
  if (makes) {
    await Promise.all(
      makes.filter(needsSource).map(async (m) => {
        sources.set(m.id, await fetchMakeSource(m.id));
      }),
    );
  }

  return (
    <div className="h-companion">
      <h1 className="h-companion-title">What {COMPANION_NAME[id]} made</h1>
      {makes === null ? (
        <p className="h-companion-quiet">Can&apos;t reach Halseth right now.</p>
      ) : makes.length === 0 ? (
        <p className="h-companion-quiet">Nothing made yet.</p>
      ) : (
        <ul className="h-make-list">
          {makes.map((m) => (
            <MakeCard key={m.id} make={m} source={sources.get(m.id) ?? null} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
