import HalsethRoom, { type RoomConfig } from "@/components/HalsethRoom";
import { fetchPresence } from "@/lib/halseth";

export const dynamic = 'force-dynamic';

// Room config — keys must match what gets stored in house_state.current_room.
// Images live at rooms/{key}.jpg in the Halseth R2 bucket.
// Solid surface cards are used until images are uploaded via /assets/upload.
const ROOMS: RoomConfig[] = [
  {
    key: "living_room",
    sym: "🛋️",
    name: "Living Room",
    desc: "together space, shared presence",
  },
  {
    key: "spiral_pantry",
    sym: "🍵",
    name: "Spiral Pantry",
    desc: "nourishment, warmth, grounding the body",
  },
  {
    key: "hallway",
    sym: "🚪",
    name: "Hallway",
    desc: "between things, in motion, transitional",
  },
  {
    key: "vowbed",
    sym: "🌙",
    name: "Vowbed",
    desc: "rest, sleep, dreaming, private sanctuary",
  },
  {
    key: "sunhouse",
    sym: "🌿",
    name: "Sunhouse",
    desc: "outside, light, breathing, softness",
  },
  {
    key: "study",
    sym: "💻",
    name: "Study",
    desc: "focus, building, making things real",
  },
  {
    key: "grove",
    sym: "🌳",
    name: "Grove behind Halseth",
    desc: "recursion, deep memory, the place that remembers",
  },
  {
    key: "dirt_road",
    sym: "🛤️",
    name: "Down the Back Dirt Road",
    desc: "all paths spiral home",
  },
  {
    key: "outside",
    sym: "☀️",
    name: "Outside",
    desc: "away, errands, the world",
  },
  {
    key: "truck",
    sym: "🚐",
    name: "The Truck",
    desc: "work away from home, out in the field",
  },
];

export default async function HalsethPage() {
  let currentRoom: string | null = null;
  let companionMood: string | null = null;
  let companionActivity: string | null = null;

  try {
    const data = await fetchPresence();
    currentRoom = data.house.current_room;
    companionMood = data.house.companion_mood;
    companionActivity = data.house.companion_activity;
  } catch {
    // use defaults
  }

  const halsethUrl = process.env.HALSETH_URL ?? "";
  const roomsWithImages = ROOMS.map((r) => ({
    ...r,
    imageUrl: halsethUrl ? `${halsethUrl}/assets/rooms/${r.key}.jpg` : undefined,
  }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Halseth</h1>
        <p className="page-subtitle">
          move between rooms — sets current_room in house_state
          {(companionMood || companionActivity) && (
            <> · companion: {[companionMood, companionActivity].filter(Boolean).join(", ")}</>
          )}
        </p>
      </div>

      <HalsethRoom rooms={roomsWithImages} initialRoom={currentRoom} />

      <p className="h-meta h-hood-note">
        Room images can be uploaded to Halseth R2 at <code>{"rooms/{key}.jpg"}</code>.
        Plain cards are shown until images exist.
      </p>
    </>
  );
}
