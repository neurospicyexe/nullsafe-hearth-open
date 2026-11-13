export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import DoorList from "@/components/kit/DoorList";
import { fetchCompanionRundown } from "@/lib/halseth";
import { COMPANION_NAME, mindDoors, parseCompanionId } from "@/lib/companion-page";

export const metadata = { title: "Mind | Hearth" };

// The Mind pill: everything inside a companion that is not a letter, a made thing or their thinking.
export default async function CompanionMind({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();
  const rundown = await fetchCompanionRundown(id);
  return (
    <div className="h-companion" data-companion={id}>
      <h1 className="h-page-title">{COMPANION_NAME[id]}&apos;s mind</h1>
      <DoorList doors={mindDoors(id, rundown)} />
    </div>
  );
}
