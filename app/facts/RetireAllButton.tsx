"use client";

import { useState } from "react";
import { retireOlderThan30Days, type ActionResult } from "./actions";

export default function RetireAllButton() {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<ActionResult | null>(null);

  async function run() {
    setBusy(true);
    setFlash(null);
    const r = await retireOlderThan30Days();
    setFlash(r);
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="h-btn is-sm is-danger"
      >
        {busy ? "retiring…" : "Retire all older than 30 days"}
      </button>
      {flash && (
        <span className={`h-msg is-sm ${flash.ok ? "is-ok" : "is-warn"}`}>
          {flash.message}
        </span>
      )}
    </div>
  );
}
