import Link from "next/link";
import DoorList from "@/components/kit/DoorList";
import { HOUSE_DOORS, SHARED_PLACES, SHARED_QUIET } from "@/lib/shell";
import { fetchBooks, fetchClubCurrent, fetchCreature, fetchCreatures, fetchNeeds, fetchNewestImage } from "@/lib/halseth";
import { currentBook } from "@/lib/home-model";
import type { Door } from "@/lib/shell";
import { clubHint, galleryHint, readingHint, solHint, togetherDoors } from "@/lib/together-model";

// The doors carry search hints for the page index; this page shows live state or nothing.
const bare = (doors: Door[]): Door[] => doors.map(({ href, label }) => ({ href, label }));

export const metadata = { title: "Us | Hearth" };
export const dynamic = "force-dynamic";

// The Us tab: shared places, you and the house, and one door down to the cellar.
export default async function Page() {
  const now = new Date();
  const [club, books, creatures, image, needs] = await Promise.all([
    fetchClubCurrent().catch(() => null),
    fetchBooks().catch(() => []),
    fetchCreatures().catch(() => []),
    fetchNewestImage().catch(() => null),
    fetchNeeds(1).catch(() => null),
  ]);
  const sol = (creatures ?? []).find((c) => c.name.toLowerCase() === "sol");
  const solDetail = sol ? await fetchCreature(sol.id).catch(() => null) : null;

  const hints = {
    "/club": clubHint(club ?? null),
    "/creatures": solHint(solDetail, now),
    "/library": readingHint(currentBook(books ?? [])),
    "/gallery": galleryHint(image ?? null, now),
  };
  // The count rides the Needs door as a pill; zero or an unreachable Halseth leaves the door plain.
  const waiting = needs?.counts.total ?? 0;
  const house = bare(HOUSE_DOORS).map((d) => (d.href === "/needs" && waiting > 0 ? { ...d, count: waiting } : d));

  return (
    <div className="h-us">
      <h1 className="h-page-title">Us</h1>

      <section aria-label="Shared places" className="h-section">
        <h2 className="h-section-title">Shared places</h2>
        <DoorList doors={togetherDoors(bare(SHARED_PLACES), hints)} />
        <ul className="h-us-quiet" aria-label="More shared places">
          {togetherDoors(bare(SHARED_QUIET), hints).map((d) => (
            <li key={d.href}>
              <Link href={d.href} className="h-us-quiet-link">{d.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="You and the house" className="h-section">
        <h2 className="h-section-title">You and the house</h2>
        <DoorList doors={house} />
      </section>

      <Link href="/archive" className="h-us-cellar">
        <span>The cellar · all records</span>
        <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}
