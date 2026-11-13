"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failureLine, type Pending } from "@/lib/write-queue";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

type Phase = "editing" | "waiting";

// The write box for the async wall (write layer, 0092). Reusable: the global /log uses
// context="global"; the club + shelf threads reuse it with their own context and an
// optional replyTo. A drop, not a ping -- posting persists the thought, nothing more.
// P4: written through the queue. "Posted" shows at once with undo for the grace window; the typed
// text stays if the write does not land. The /api/commons payload is unchanged.
export default function PostBox({
  context = "global",
  replyTo = null,
  placeholder = "drop a thought, a half-idea, a note to no one in particular…",
  compact = false,
}: {
  context?: string;
  replyTo?: string | null;
  placeholder?: string;
  compact?: boolean;
}) {
  const queue = useWriteQueue();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  const [inGrace, setInGrace] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  // A post that failed retryably is stored by the queue and retried on the next Hearth open. The box
  // keeps the text, so the next submit reuses that key and supersedes the stored write instead of
  // posting the thought twice.
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

  function submit() {
    const text = body.trim();
    if (!text || phase !== "editing") return;
    const key = failedKey.current ?? `commons-${replyTo ? `reply-${replyTo}` : context}-${Date.now()}`;
    failedKey.current = null;
    const pending = queue.submit({
      key,
      url: "/api/commons",
      method: "POST",
      body: { body: text, context, reply_to: replyTo },
    });
    pendingRef.current = pending;
    setError(null);
    setPosted(false);
    setPhase("waiting");
    setInGrace(true);
    void pending.done.then((r) => {
      if (pendingRef.current !== pending) return; // undone here
      pendingRef.current = null;
      setInGrace(false);
      setPhase("editing");
      if (r === "undone") return;
      if (r.ok) {
        setBody("");
        setPosted(true);
        router.refresh();
        return;
      }
      if (!r.dropped) failedKey.current = key; // stored for retry: the next submit supersedes it
      setError(failureLine(r)); // the text stays as typed, so a retry is one tap
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

  const wrap = compact ? "h-post is-compact" : "h-post";

  if (phase === "waiting") {
    return (
      <div className={`${wrap} h-post-line`} role="status">
        <span className="h-msg">Posted</span>
        {inGrace && <button type="button" className="h-btn" onClick={undo}>undo</button>}
      </div>
    );
  }

  return (
    <div className={wrap}>
      <textarea
        className="h-input is-area h-post-input"
        aria-label="Your thought"
        value={body}
        onChange={(e) => { setBody(e.target.value); setPosted(false); }}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
      />
      <div className="h-post-line">
        <button type="button" className="h-btn is-primary" onClick={submit} disabled={!body.trim()}>
          {replyTo ? "reply" : "post"}
        </button>
        <span className="h-post-hint">⌘/Ctrl+Enter</span>
        {error && <span className="h-msg is-warn" role="status">{error}</span>}
        {!error && posted && <span className="h-msg" role="status">Posted</span>}
      </div>
    </div>
  );
}
