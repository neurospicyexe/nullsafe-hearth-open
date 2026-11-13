"use client";

// Act-in-place on a tray draft (mig 0132): keep it as the companion's memory or drop it.
// Same idiom as guardian/FlagActions: POST through the Hearth proxy, then router.refresh()
// so the server page re-reads the tray and the stats line moves.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TrayKind } from "@/lib/halseth";

export default function TrayActions({ agent, kind, id }: { agent: string; kind: TrayKind; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function act(decision: "kept" | "dropped") {
    setBusy(decision);
    setError(false);
    const res = await fetch("/api/tray/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, kind, id, decision }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { setError(true); return; }
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", gap: "0.4rem", whiteSpace: "nowrap" }}>
      <button className="h-tray-btn is-keep" disabled={busy !== null} onClick={() => act("kept")}>
        {busy === "kept" ? "…" : "keep"}
      </button>
      <button className="h-tray-btn" disabled={busy !== null} onClick={() => act("dropped")}>
        {busy === "dropped" ? "…" : "drop"}
      </button>
      {error && <span className="h-msg is-warn h-tray-err">failed</span>}
    </span>
  );
}
