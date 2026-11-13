"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failureLine, type Pending } from "@/lib/write-queue";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

type Phase = "idle" | "waiting";

// Archive a shelf item (0094): drops it from the active shelf without deleting history.
// P4: through the queue with undo; the PATCH body is unchanged.
export default function ArchiveButton({ id }: { id: string }) {
  const queue = useWriteQueue();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
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

  function archive() {
    if (phase !== "idle") return;
    const pending = queue.submit({
      key: `shelf-archive-${id}`,
      url: "/api/shelf",
      method: "PATCH",
      body: { id, status: "archived" },
    });
    pendingRef.current = pending;
    setError(null);
    setPhase("waiting");
    setInGrace(true);
    void pending.done.then((r) => {
      if (pendingRef.current !== pending) return; // undone or superseded here
      pendingRef.current = null;
      setInGrace(false);
      if (r === "undone") { setPhase("idle"); return; }
      if (r.ok) { router.refresh(); return; } // stays "Archived" until the refresh drops the item
      setError(failureLine(r));
      setPhase("idle");
    });
  }

  function undo() {
    const p = pendingRef.current;
    if (!p || !p.waiting()) return;
    pendingRef.current = null;
    p.undo();
    setInGrace(false);
    setPhase("idle");
  }

  if (phase === "waiting") {
    return (
      <span className="h-shelf-line" role="status">
        <span className="h-msg">Archived</span>
        {inGrace && <button type="button" className="h-btn" onClick={undo}>undo</button>}
      </span>
    );
  }
  return (
    <span className="h-shelf-line">
      <button type="button" className="h-btn" onClick={archive}>archive</button>
      {error && <span className="h-msg is-warn" role="status">{error}</span>}
    </span>
  );
}
