import { fetchKeepOff, fetchPeople } from "@/lib/halseth";
import PeopleClient from "./PeopleClient";
import KeepOffClient from "./KeepOffClient";

export const dynamic = "force-dynamic";

// The people the memory map may link to (Halseth mig 0149, map M5). Nobody is linked until named
// here: many system members share names with characters in the shows the triad watches, and the text
// alone cannot tell which one a journal line means. The graph never guesses.
export default async function PeoplePage() {
  const [people, keepOff] = await Promise.all([fetchPeople(), fetchKeepOff()]);
  return (
    <main className="map-page">
      <header className="page-header">
        <h1 className="page-title">People</h1>
        <p className="page-subtitle">
          You&rsquo;re the centre of the map, and every name that is you points there. Names are matched exactly as you spell
          them, capital letters included, so &ldquo;Spouse&rdquo; finds &ldquo;Spouse&rdquo; and not &ldquo;blue&rdquo;. New links show up after the nightly rebuild.
        </p>
      </header>
      {people === null ? (
        <p className="h-empty">Couldn&rsquo;t reach Halseth.</p>
      ) : (
        <PeopleClient initial={people} />
      )}
      {keepOff === null ? (
        <p className="h-empty">Couldn&rsquo;t load the keep-off list.</p>
      ) : (
        <KeepOffClient initial={keepOff} />
      )}
    </main>
  );
}
