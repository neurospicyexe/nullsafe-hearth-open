export const dynamic = "force-dynamic";

import { fetchPresence } from "@/lib/halseth";
import HouseClient from "./HouseClient";

export default async function HousePage() {
  let house = null;
  try {
    const presence = await fetchPresence();
    house = presence?.house ?? null;
  } catch {
    // show controls with defaults if presence fails
  }

  const defaults = {
    current_room: null,
    companion_mood: null,
    companion_activity: null,
    spoon_count: 10,
    love_meter: 50,
    updated_at: new Date().toISOString(),
    autonomous_turn: null,
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">House</h1>
        <p className="page-subtitle">current room, spoon count, love meter — shared with the triad</p>
      </div>
      <HouseClient house={house ?? defaults} />
    </>
  );
}
