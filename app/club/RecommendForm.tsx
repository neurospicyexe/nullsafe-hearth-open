"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failureLine, type Pending } from "@/lib/write-queue";
import { recommendWrite } from "@/lib/club-model";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

const KINDS = ["song", "album", "book", "article", "video", "forage", "other"] as const;

type Phase = "editing" | "waiting" | "done";

// Principal's pick for the round, written through the queue: it confirms at once, can be undone during
// the grace window, and keeps every field if the write does not land.
export default function RecommendForm({ roundId }: { roundId: string }) {
  const queue = useWriteQueue();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("editing");
  const [inGrace, setInGrace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("other");
  const [creator, setCreator] = useState("");
  const [url, setUrl] = useState("");
  const [pitch, setPitch] = useState("");
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
    if (!title.trim() || phase !== "editing") return;
    const pending = queue.submit(
      recommendWrite(roundId, {
        title: title.trim(),
        media_kind: kind,
        creator: creator.trim() || null,
        url: url.trim() || null,
        pitch: pitch.trim() || null,
      }),
    );
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
        setPhase("done");
        router.refresh();
        return;
      }
      setError(failureLine(r)); // the fields stay as typed, so a retry is one tap
      setPhase("editing");
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

  if (phase !== "editing") {
    return (
      <div className="h-club-line" role="status">
        <span className="h-msg">Recommended</span>
        {phase === "waiting" && inGrace && (
          <button type="button" className="h-btn" onClick={undo}>undo</button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="h-club-form">
      <div className="h-club-form-row">
        <input
          type="text"
          className="h-input is-grow"
          placeholder="title *"
          aria-label="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
        <select className="h-input" aria-label="Kind" value={kind} onChange={e => setKind(e.target.value)}>
          {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <input
        type="text"
        className="h-input"
        placeholder="creator (optional)"
        aria-label="Creator"
        value={creator}
        onChange={e => setCreator(e.target.value)}
      />
      <input
        type="text"
        className="h-input"
        placeholder="url (optional)"
        aria-label="Link"
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <textarea
        className="h-input is-area"
        placeholder="why this? (optional)"
        aria-label="Why this"
        value={pitch}
        onChange={e => setPitch(e.target.value)}
        rows={2}
      />
      <div className="h-club-line">
        <button type="submit" className="h-btn is-primary" disabled={!title.trim()}>
          Recommend
        </button>
        {error && <span className="h-msg is-warn" role="status">{error}</span>}
      </div>
    </form>
  );
}
