"use client";

import { useState } from "react";

// One pin toggle for a conclusion or a continuity note (mig 0148, map M3). Optimistic, with the
// server's answer winning: a cap refusal (409) puts the button back and says why.
export default function PinButton({
  companionId,
  kind,
  id,
  pinned: initial,
  compact = false,
}: {
  companionId: string;
  kind: "conclusion" | "note";
  id: string;
  pinned: boolean;
  compact?: boolean;
}) {
  const [pinned, setPinned] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !pinned;
    setBusy(true);
    setMsg(null);
    setPinned(next);
    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companion_id: companionId, kind, id, pinned: next }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPinned(!next);
        setMsg(
          out?.reason === "cap_reached"
            ? `Already ${out.cap} pinned ${kind}s. Unpin one first.`
            : out?.reason === "not_found"
              ? "Can't pin this one (a draft, released, or replaced)."
              : "Couldn't reach Halseth.",
        );
      }
    } catch {
      setPinned(!next);
      setMsg("Couldn't reach Halseth.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="pin-wrap">
      <button
        type="button"
        className={`pin-btn${pinned ? " pinned" : ""}${compact ? " compact" : ""}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={pinned}
        title={pinned ? "Pinned: always in front of them at boot. Tap to unpin." : "Pin: keep this in front of them at every boot"}
      >
        {pinned ? "📌 Pinned" : "Pin"}
      </button>
      {msg && <span className="pin-msg">{msg}</span>}
    </span>
  );
}
