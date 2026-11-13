"use client";

// Tend a creature from its card (2026-07-02): feed/play/talk/give without leaving Hearth.
// Inner life (0100): a give WITH WORDS lands in the nest as a kept thing, and any tend
// that crosses a trust milestone shows the one-time moment text right here.
// P4: each tend goes through the write queue, confirms at once in the past tense and can be
// undone for the grace window. Every tap is its own act (its own key), so a second tap never
// cancels the first.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failureLine, type Pending } from "@/lib/write-queue";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

const ACTIONS = ["feed", "play", "talk", "give"] as const;
type Action = (typeof ACTIONS)[number];

const PAST: Record<Action, string> = { feed: "Fed", play: "Played", talk: "Talked", give: "Gave" };

// How long a landed tend keeps its past-tense label before the verb comes back.
const SHOWN_MS = 3000;

export default function TendButtons({ creatureId }: { creatureId: string }) {
  const queue = useWriteQueue();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);
  // Per action: tends still in the grace window (undo takes back the newest) and tends that just landed.
  const pendingRef = useRef<Record<Action, Pending[]>>({ feed: [], play: [], talk: [], give: [] });
  const [graceCount, setGraceCount] = useState<Record<Action, number>>({ feed: 0, play: 0, talk: 0, give: 0 });
  const [landed, setLanded] = useState<Record<Action, number>>({ feed: 0, play: 0, talk: 0, give: 0 });
  const [sending, setSending] = useState<Record<Action, number>>({ feed: 0, play: 0, talk: 0, give: 0 });
  const timers = useRef<number[]>([]);
  // A tend that failed retryably is stored by the queue and retried on the next Hearth open. The
  // next tap of the same action reuses its key, so the tap supersedes the stored write instead of
  // adding a second one (one owner for the retry: the queue).
  const failedKey = useRef<Partial<Record<Action, string>>>({});

  useEffect(() => () => { for (const t of timers.current) window.clearTimeout(t); }, []);

  // Keep the undo control honest: once the queue sends a write, its grace window is over.
  const anyGrace = ACTIONS.some((a) => graceCount[a] > 0);
  useEffect(() => {
    if (!anyGrace) return;
    const t = window.setInterval(() => {
      const next = { feed: 0, play: 0, talk: 0, give: 0 } as Record<Action, number>;
      for (const a of ACTIONS) next[a] = pendingRef.current[a].filter((p) => p.waiting()).length;
      setGraceCount(next);
    }, 250);
    return () => window.clearInterval(t);
  }, [anyGrace]);

  function bump(set: typeof setGraceCount, action: Action, by: number) {
    set((c) => ({ ...c, [action]: Math.max(0, c[action] + by) }));
  }

  function tend(action: Action) {
    const words = note.trim();
    const key = failedKey.current[action] ?? `creature-${creatureId}-${action}-${Date.now()}`;
    delete failedKey.current[action];
    const pending = queue.submit({
      key,
      url: `/api/creatures/${encodeURIComponent(creatureId)}`,
      method: "POST",
      body: { action, ...(words ? { note: words } : {}) },
    });
    pendingRef.current[action] = [...pendingRef.current[action], pending];
    setError(null);
    bump(setGraceCount, action, 1);
    bump(setSending, action, 1);
    void pending.done.then((r) => {
      const list = pendingRef.current[action];
      const wasLive = list.includes(pending);
      pendingRef.current[action] = list.filter((p) => p !== pending);
      if (!wasLive) return; // undone here; undo already settled the counts
      bump(setSending, action, -1);
      setGraceCount((c) => ({ ...c, [action]: pendingRef.current[action].filter((p) => p.waiting()).length }));
      if (r === "undone") return;
      if (!r.ok) {
        if (!r.dropped) failedKey.current[action] = key; // stored for retry: the next tap supersedes it
        setError(failureLine(r)); // the words stay in the box, so a retry is one tap
        return;
      }
      setNote((current) => (current.trim() === words ? "" : current));
      const fired = (r.json as { milestones_fired?: Array<{ text?: unknown }> } | null)?.milestones_fired;
      if (Array.isArray(fired) && fired.length > 0) {
        // A milestone fires once, ever. Leave it on screen until the next one.
        setMilestone(fired.map((m) => (typeof m.text === "string" ? m.text : "")).filter(Boolean).join(" ") || null);
      }
      bump(setLanded, action, 1);
      timers.current.push(window.setTimeout(() => bump(setLanded, action, -1), SHOWN_MS));
      router.refresh();
    });
  }

  function undo(action: Action) {
    const list = pendingRef.current[action];
    const newest = [...list].reverse().find((p) => p.waiting());
    if (!newest) return;
    pendingRef.current[action] = list.filter((p) => p !== newest);
    newest.undo();
    bump(setSending, action, -1);
    setGraceCount((c) => ({ ...c, [action]: pendingRef.current[action].filter((p) => p.waiting()).length }));
  }

  return (
    <div className="h-creature-tend">
      <div className="h-creature-tend-row">
        {ACTIONS.map((a) => {
          const shown = sending[a] > 0 || landed[a] > 0;
          return (
            <span key={a} className="h-creature-tend-act">
              <button
                type="button"
                className={`h-btn h-creature-btn${shown ? " is-done" : ""}`}
                onClick={() => tend(a)}
              >
                {shown ? PAST[a] : a}
              </button>
              {graceCount[a] > 0 && (
                <button
                  type="button"
                  className="h-btn h-creature-btn is-undo"
                  aria-label={`undo ${a}`}
                  onClick={() => undo(a)}
                >
                  undo
                </button>
              )}
            </span>
          );
        })}
      </div>
      {error && <p className="h-msg is-warn" role="status">{error}</p>}
      <input
        className="h-input"
        aria-label="With words"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="with words (a give with words goes in the nest)"
        maxLength={120}
      />
      {milestone && <p className="h-creature-moment" role="status">✦ {milestone}</p>}
    </div>
  );
}
