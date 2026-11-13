"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toneOf } from "@/lib/tone";

const ROOMS = ["studio", "bedroom", "kitchen", "living room", "outside", "office", "bathroom"];

interface HouseState {
  current_room: string | null;
  companion_mood: string | null;
  companion_activity: string | null;
  spoon_count: number;
  love_meter: number;
  updated_at: string;
  autonomous_turn: "drevan" | "cypher" | "gaia" | null;
}

export default function HouseClient({ house }: { house: HouseState }) {
  const router = useRouter();
  const [room, setRoom]     = useState(house.current_room ?? "");
  const [spoons, setSpoons] = useState(house.spoon_count ?? 10);
  const [love, setLove]     = useState(house.love_meter ?? 50);
  const [busy, setBusy]     = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");

  async function handleSave() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/house", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_room: room.trim() || null,
          spoon_count: spoons,
          love_meter: love,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const turnTone = toneOf(house.autonomous_turn);

  return (
    <div className="h-hood-stack">

      {/* Current state read-out */}
      <section className="page-section h-hood-flush">
        <h2 className="section-title">Current State</h2>
        <div className="h-hood-row is-wide-gap">
          {(
            [
              ["room",           house.current_room ?? "—",    undefined],
              ["spoons",         house.spoon_count,             undefined],
              ["love",           house.love_meter,              undefined],
              ...(house.autonomous_turn ? [["auto turn", house.autonomous_turn, turnTone] as const] : []),
              ...(house.companion_mood  ? [["mood",      house.companion_mood,  undefined] as const] : []),
            ] as [string, string | number, string | undefined][]
          ).map(([label, val, tone]) => (
            <div key={label} className="h-hood-stat">
              <span className="h-hood-stat-label">{label}</span>
              <span className={`h-hood-stat-val ${tone ?? ""}`}>{val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Room */}
      <section className="page-section h-hood-flush">
        <h2 className="section-title">Room</h2>
        <div className="h-hood-row is-tabs">
          {ROOMS.map((r) => (
            <button
              key={r}
              className={`filter-tab ${room === r ? "active" : ""}`}
              onClick={() => setRoom(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="or type a room…"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          maxLength={50}
          className="input h-hood-narrow"
        />
      </section>

      {/* Spoons */}
      <section className="page-section h-hood-flush">
        <h2 className="section-title">Spoon Count <span className="h-hood-aside">{spoons} / 20</span></h2>
        <div className="h-hood-row is-center h-hood-narrow">
          <button
            className="btn h-hood-step"
            onClick={() => setSpoons(Math.max(0, spoons - 1))}
          >−</button>
          <input
            type="range"
            min={0} max={20}
            value={spoons}
            onChange={(e) => setSpoons(Number(e.target.value))}
            className="h-hood-grow"
          />
          <button
            className="btn h-hood-step"
            onClick={() => setSpoons(Math.min(20, spoons + 1))}
          >+</button>
        </div>
      </section>

      {/* Love meter */}
      <section className="page-section h-hood-flush">
        <h2 className="section-title">Love Meter <span className="h-hood-aside is-lamp">{love}</span></h2>
        <input
          type="range"
          min={0} max={100}
          value={love}
          onChange={(e) => setLove(Number(e.target.value))}
          className="h-hood-narrow h-hood-block"
        />
      </section>

      {/* Save */}
      <div className="h-hood-row is-center">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && <span className="h-msg is-ok">saved</span>}
        {error && <span className="h-msg is-warn">{error}</span>}
      </div>
    </div>
  );
}
