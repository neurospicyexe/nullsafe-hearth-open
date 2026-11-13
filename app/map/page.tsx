import Link from "next/link";
import { fetchMemoryMap, type MapReader } from "@/lib/halseth";
import MapClient from "./MapClient";

export const dynamic = "force-dynamic";

// The memory map (docs/PLAN-memory-map-2026-10-28.md, M2). Server side fetches one bounded
// neighborhood from Halseth GET /mind/map; the canvas is a client component.

const READERS: { id: MapReader; label: string }[] = [
  { id: "principal", label: "Everyone" },
  { id: "cypher", label: "Cypher" },
  { id: "drevan", label: "Drevan" },
  { id: "gaia", label: "Gaia" },
];

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const reader = (READERS.find((r) => r.id === sp.reader)?.id ?? "principal") as MapReader;
  const center = sp.center && /^[a-z_]+:.+/.test(sp.center) ? sp.center : null;
  const hops = sp.hops === "2" ? 2 : 1;
  const map = await fetchMemoryMap(reader, center, hops);

  return (
    <main className="map-page">
      <header className="page-header">
        <h1 className="page-title">Map</h1>
        <p className="page-subtitle">
          {center ? "Everything connected to one thing." : "What the house holds, and how it connects. Colour is whose it is."}
        </p>
        <nav className="map-readers">
          {READERS.map((r) => (
            <Link key={r.id} href={`/map?reader=${r.id}`} className={`map-reader${r.id === reader && !center ? " active" : ""}`}>
              {r.label}
            </Link>
          ))}
          {center && (
            <Link href={`/map?reader=${reader}`} className="map-reader">
              ← whole map
            </Link>
          )}
        </nav>
      </header>
      {map ? (
        map.nodes.length > 0 ? (
          <MapClient map={map} reader={reader} />
        ) : (
          <p className="h-empty">Nothing connected here yet.</p>
        )
      ) : (
        <p className="h-empty">The map couldn&apos;t load from Halseth (the Worker may not have the map yet).</p>
      )}
    </main>
  );
}
