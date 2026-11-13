"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failureLine, type Pending } from "@/lib/write-queue";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

const KINDS = ["show", "movie", "actor", "person", "book", "music", "game", "article", "other"];

type Phase = "editing" | "waiting";

// Add a fixation to the shelf (0094). The triad reacts to it in their own time.
// P4: written through the queue. "Added" shows at once with undo for the grace window; the typed
// text stays if the write does not land. The /api/shelf payload is unchanged (cy: into reads the
// same rows).
export default function AddBox() {
  const queue = useWriteQueue();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("other");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  const [inGrace, setInGrace] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  // An add that failed retryably is stored by the queue and retried on the next Hearth open. The box
  // holds that same draft (the text is kept), so the next submit reuses its key and supersedes the
  // stored write instead of adding the item twice.
  const failedKey = useRef<string | null>(null);

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

  function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim() || phase !== "editing") return;
    const key = failedKey.current ?? `shelf-add-${Date.now()}`;
    failedKey.current = null;
    const pending = queue.submit({
      key,
      url: "/api/shelf",
      method: "POST",
      body: { title: title.trim(), kind, note: note.trim() || null },
    });
    pendingRef.current = pending;
    setError(null);
    setAdded(false);
    setPhase("waiting");
    setInGrace(true);
    void pending.done.then((r) => {
      if (pendingRef.current !== pending) return; // undone here
      pendingRef.current = null;
      setInGrace(false);
      setPhase("editing");
      if (r === "undone") return;
      if (r.ok) {
        setTitle(""); setNote(""); setKind("other");
        setAdded(true);
        router.refresh();
        return;
      }
      if (!r.dropped) failedKey.current = key; // stored for retry: the next submit supersedes it
      setError(failureLine(r)); // the fields stay as typed, so a retry is one tap
    });
  }

  function undo() {
    const p = pendingRef.current;
    if (!p || !p.waiting()) return;
    pendingRef.current = null;
    p.undo();
    setInGrace(false);
    setPhase("editing");
  }

  if (phase === "waiting") {
    return (
      <div className="h-shelf-add h-shelf-line" role="status">
        <span className="h-msg">Added</span>
        {inGrace && <button type="button" className="h-btn" onClick={undo}>undo</button>}
      </div>
    );
  }

  return (
    <form className="h-shelf-add" onSubmit={add}>
      <div className="h-shelf-form-row">
        <input
          className="h-input is-grow"
          aria-label="What you're into"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setAdded(false); }}
          placeholder="what are you into right now?"
        />
        <select className="h-input" aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <input
        className="h-input"
        aria-label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="a note on why / what (optional)"
      />
      <div className="h-shelf-line">
        <button type="submit" className="h-btn is-primary" disabled={!title.trim()}>add to shelf</button>
        {error && <span className="h-msg is-warn" role="status">{error}</span>}
        {!error && added && <span className="h-msg" role="status">Added</span>}
      </div>
    </form>
  );
}
