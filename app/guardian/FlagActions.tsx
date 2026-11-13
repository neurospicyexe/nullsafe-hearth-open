"use client";

// Act-in-place on guardian flags (2026-07-02): if Principal is looking at a flag,
// they can acknowledge/resolve it right here — not carry it to another chat.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FlagActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function act(next: "acknowledged" | "resolved") {
    setBusy(next);
    setError(false);
    const res = await fetch(`/api/guardian/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { setError(true); return; }
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", gap: "0.4rem", whiteSpace: "nowrap" }}>
      {status !== "acknowledged" && (
        <button className="h-tray-btn" disabled={busy !== null} onClick={() => act("acknowledged")}>
          {busy === "acknowledged" ? "…" : "ack"}
        </button>
      )}
      <button className="h-tray-btn" disabled={busy !== null} onClick={() => act("resolved")}>
        {busy === "resolved" ? "…" : "resolve"}
      </button>
      {error && <span className="h-msg is-warn h-tray-err">failed</span>}
    </span>
  );
}
