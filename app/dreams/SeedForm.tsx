"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failureLine, type Pending } from "@/lib/write-queue";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

type Phase = "editing" | "waiting" | "left";

// Leave something for a companion to find in autonomous time. The seed goes through the write
// queue: it confirms at once, can be undone during the grace window, and keeps the typed text if
// it does not land.
export default function SeedForm() {
  const queue = useWriteQueue();
  const router = useRouter();
  const [text, setText] = useState("");
  const [forCompanion, setForCompanion] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  const [inGrace, setInGrace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  useEffect(() => {
    if (!inGrace) return;
    const t = window.setInterval(() => {
      const p = pendingRef.current;
      if (!p || !p.waiting()) {
        setInGrace(false);
        window.clearInterval(t);
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [inGrace]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || phase === "waiting") return;
    const pending = queue.submit({
      key: "dream-seed-" + Date.now(),
      method: "POST",
      url: "/api/dream-seeds",
      body: { content, ...(forCompanion ? { for_companion: forCompanion } : {}) },
    });
    pendingRef.current = pending;
    setError(null);
    setPhase("waiting");
    setInGrace(true);
    void pending.done.then((r) => {
      if (pendingRef.current !== pending) return; // undone here
      pendingRef.current = null;
      setInGrace(false);
      if (r === "undone") {
        setPhase("editing");
        return;
      }
      if (r.ok) {
        setText("");
        setForCompanion("");
        setPhase("left");
        router.refresh();
        return;
      }
      setError(failureLine(r)); // the text stays as typed, so a retry is one tap
      setPhase("editing");
    });
  }

  function undo() {
    const p = pendingRef.current;
    if (!p || !p.waiting()) return;
    pendingRef.current = null;
    p.undo();
    setInGrace(false);
    setPhase("editing"); // the typed text was never cleared
  }

  const busy = phase === "waiting";

  return (
    <section className="h-section h-seed">
      <h2 className="h-section-title">Leave a dream seed</h2>
      <p className="h-seed-hint">
        Leave something for a companion to find during autonomous time. A question, a memory, an
        image, a fragment. If no seed is pending, they fall back to reading deltas and handovers.
      </p>
      <form onSubmit={submit} className="h-seed-form">
        <textarea
          className="h-input is-area"
          aria-label="Dream seed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What do you want them to sit with?"
          rows={3}
          readOnly={busy}
        />
        <div className="h-seed-row">
          <select
            className="h-input"
            aria-label="For"
            value={forCompanion}
            onChange={(e) => setForCompanion(e.target.value)}
            disabled={busy}
          >
            <option value="">any companion</option>
            <option value="drevan">drevan</option>
            <option value="cypher">cypher</option>
            <option value="gaia">gaia</option>
          </select>
          <button type="submit" className="h-btn is-primary" disabled={busy || !text.trim()}>
            Inject
          </button>
          {busy && <span className="h-msg" role="status">Seed left</span>}
          {busy && inGrace && (
            <button type="button" className="h-btn" onClick={undo}>undo</button>
          )}
          {phase === "left" && <span className="h-msg" role="status">Seed left</span>}
          {error && <span className="h-msg" role="status">{error}</span>}
        </div>
      </form>
    </section>
  );
}
