"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Principal's witness on a revision (mig 0172). Witness swaps the basin in; Decline keeps the old words live.
// Posts through /api/basin-witness, which holds the admin secret; the page never sees it.
export default function WitnessButtons({ id, companionName }: { id: string; companionName: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(decision: "witness" | "decline") {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/basin-witness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision, note: note.trim() || undefined }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(typeof out?.error === "string" ? out.error : "Couldn't reach Halseth.");
      else router.refresh();
    } catch {
      setMsg("Couldn't reach Halseth.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-basins-witness">
      <label className="h-basins-notelabel">
        Note to {companionName} (optional)
        <input className="h-basins-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="h-basins-actions">
        <button type="button" className="h-basins-btn" disabled={busy} onClick={() => send("witness")}>Witness</button>
        <button type="button" className="h-basins-btn" disabled={busy} onClick={() => send("decline")}>Decline</button>
      </div>
      {msg && <p className="h-basins-err" role="alert">{msg}</p>}
    </div>
  );
}
