import { fetchHomePresence, fetchHomeBasin } from "@/lib/halseth";
import type { HomeBasinReading, HomePresence, HomeRoom } from "@/lib/halseth";

export const dynamic = "force-dynamic";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;
type CompanionKey = (typeof COMPANIONS)[number];

const COMPANION_META: Record<CompanionKey, { label: string; abbr: string }> = {
  cypher: { label: "Cypher", abbr: "Cy" },
  drevan: { label: "Drevan", abbr: "Dr" },
  gaia: { label: "Gaia", abbr: "Ga" },
};

const DRIFT_TYPES = ["stable", "growth", "pressure"] as const;

function driftClass(type: string | undefined) {
  return type === "stable" || type === "growth" || type === "pressure" ? `is-${type}` : "is-none";
}

function driftLabel(type: string) {
  return type === "pressure" ? "! pressure" : type;
}

// room.gradient is authored data; pass it through only as a plain colour/gradient, never a url().
function roomWash(gradient: unknown): string | null {
  return typeof gradient === "string" && gradient.trim() && !/url\(/i.test(gradient) ? gradient : null;
}

function fmt(score: number) {
  return score.toFixed(3);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

type Basins = Record<CompanionKey, HomeBasinReading | null>;

function RoomCard({ room, occupants, basins }: { room: HomeRoom; occupants: HomePresence[]; basins: Basins }) {
  const wash = roomWash(room.gradient);
  const style = wash ? ({ "--room-wash": wash } as React.CSSProperties) : undefined;
  return (
    <li className={`h-rooms-room${occupants.length > 0 ? " is-occupied" : ""}`} style={style}>
      <span className="h-rooms-swatch" aria-hidden="true" />
      <span className="h-rooms-sym">{room.sym}</span>
      <span className="h-rooms-room-name">{room.name}</span>
      <span className="h-rooms-register">{room.register}</span>
      {occupants.length > 0 && (
        <span className="h-rooms-chips">
          {occupants.map((o) => {
            const key = o.companion_id as CompanionKey;
            const meta = COMPANION_META[key];
            const basin = basins[key] ?? null;
            return (
              <span key={o.companion_id} className={`h-rooms-chip is-${o.companion_id}`}>
                {meta ? meta.abbr : o.companion_id}
                {basin && <span className={`h-rooms-drift ${driftClass(basin.drift_type)}`}> {driftLabel(basin.drift_type)}</span>}
              </span>
            );
          })}
        </span>
      )}
    </li>
  );
}

function Topology({ rooms, companions, basins }: { rooms: HomeRoom[]; companions: HomePresence[]; basins: Basins }) {
  const laneRooms = rooms.filter((r) => r.primary_lane !== null);
  const commonRooms = rooms.filter((r) => r.primary_lane === null);
  const at = (key: string) => companions.filter((c) => c.current_room === key);
  return (
    <section className="h-rooms-section">
      <h2 className="h-rooms-h2">The Home</h2>
      {laneRooms.length > 0 && (
        <ul className="h-rooms-grid">
          {laneRooms.map((r) => <RoomCard key={r.key} room={r} occupants={at(r.key)} basins={basins} />)}
        </ul>
      )}
      {commonRooms.length > 0 && (
        <ul className="h-rooms-grid is-commons">
          {commonRooms.map((r) => <RoomCard key={r.key} room={r} occupants={at(r.key)} basins={basins} />)}
        </ul>
      )}
      <ul className="h-rooms-legend">
        {DRIFT_TYPES.map((type) => (
          <li key={type} className={`h-rooms-drift ${driftClass(type)}`}>{driftLabel(type)}</li>
        ))}
      </ul>
    </section>
  );
}

function Readings({ companions, basins }: { companions: HomePresence[]; basins: Basins }) {
  return (
    <section className="h-rooms-section">
      <h2 className="h-rooms-h2">Basin Readings</h2>
      <ul className="h-rooms-readings">
        {COMPANIONS.map((id) => {
          const meta = COMPANION_META[id];
          const presence = companions.find((c) => c.companion_id === id) ?? null;
          const basin = basins[id];
          return (
            <li key={id} className="h-rooms-reading">
              <div className="h-rooms-reading-top">
                <span className={`h-rooms-who is-${id}`}>{meta.label}</span>
                {presence && <span className="h-meta">{presence.current_room} · {presence.activity}</span>}
                {basin?.recorded_at && <span className="h-meta is-right">{timeAgo(basin.recorded_at)}</span>}
              </div>
              {basin ? (
                <div className="h-rooms-reading-bottom">
                  <span className={`h-rooms-drift ${driftClass(basin.drift_type)}`}>{driftLabel(basin.drift_type)}</span>
                  <span className="h-rooms-score">{fmt(basin.drift_score)}</span>
                  {basin.worst_basin && <span className="h-rooms-worst">↑ {basin.worst_basin}</span>}
                </div>
              ) : (
                <span className="h-meta">no reading</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const [home, ...readings] = await Promise.all([
    fetchHomePresence(),
    ...COMPANIONS.map((c) => fetchHomeBasin(c)),
  ]);
  const basins: Basins = { cypher: readings[0] ?? null, drevan: readings[1] ?? null, gaia: readings[2] ?? null };

  return (
    <div className="h-rooms">
      <h1 className="h-page-title">The Home</h1>
      {home === null ? (
        <p className="h-rooms-quiet">Can&apos;t reach Halseth right now.</p>
      ) : home.rooms.length === 0 ? (
        <p className="h-rooms-quiet">Home substrate not available. Ensure Halseth is deployed with migration 0065.</p>
      ) : (
        <>
          <p className="h-rooms-lede">inhabited place-graph + basin readings</p>
          <Topology rooms={home.rooms} companions={home.presence} basins={basins} />
          <Readings companions={home.presence} basins={basins} />
        </>
      )}
    </div>
  );
}
