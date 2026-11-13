"use client";

import { useState } from "react";
import { confirmFact, retireFact, fixFact, type ActionResult } from "./actions";

// Row-level action bar: Confirm (open facts only) / Retire / Fix (inline supersede form).
// One flash line per row, cleared on the next action.
export default function FactActions({
  id,
  fact,
  category,
  status,
}: {
  id: string;
  fact: string;
  category: string;
  status: "active" | "open";
}) {
  const [busy, setBusy] = useState<null | "confirm" | "retire" | "fix">(null);
  const [flash, setFlash] = useState<ActionResult | null>(null);
  const [fixing, setFixing] = useState(false);
  const [draft, setDraft] = useState(fact);

  async function run(kind: "confirm" | "retire", fn: () => Promise<ActionResult>) {
    setBusy(kind);
    setFlash(null);
    const r = await fn();
    setFlash(r);
    setBusy(null);
  }

  async function submitFix() {
    if (!draft.trim()) {
      setFlash({ ok: false, message: "fact text can't be empty" });
      return;
    }
    setBusy("fix");
    setFlash(null);
    const r = await fixFact(id, draft, category);
    setFlash(r);
    setBusy(null);
    if (r.ok) setFixing(false);
  }

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {status === "open" && (
          <button
            type="button"
            onClick={() => run("confirm", () => confirmFact(id))}
            disabled={busy !== null}
            className="h-btn is-sm is-outlined is-primary"
          >
            {busy === "confirm" ? "confirming…" : "confirm"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("retire", () => retireFact(id))}
          disabled={busy !== null}
          className="h-btn is-sm is-danger"
        >
          {busy === "retire" ? "retiring…" : "retire"}
        </button>
        <button
          type="button"
          onClick={() => { setFixing((v) => !v); setFlash(null); }}
          disabled={busy !== null}
          className="h-btn is-sm is-quiet"
        >
          {fixing ? "cancel" : "fix"}
        </button>
        {flash && (
          <span className={`h-msg is-sm ${flash.ok ? "is-ok" : "is-warn"}`}>
            {flash.message}
          </span>
        )}
      </div>

      {fixing && (
        <div style={{ marginTop: "0.5rem" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            disabled={busy !== null}
            className="h-input is-area is-full"
          />
          <div style={{ marginTop: "0.4rem" }}>
            <button
              type="button"
              onClick={submitFix}
              disabled={busy !== null}
              className="h-btn is-sm is-outlined is-primary"
            >
              {busy === "fix" ? "saving…" : "save correction (supersedes this fact)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
