"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NeedsItem } from "@/lib/halseth";
import type { Pending } from "@/lib/write-queue";
import { COMPANION_COLOR } from "@/lib/shell";
import { tint } from "@/lib/domain-colors";
import { ageLabel } from "@/lib/home-model";
import {
  buttons, canSend, doneLine, kindLabel, outcomeLine, resolveWrite, rowLink, rowState, titleText, whoLabel,
  type NeedsAction, type RowState,
} from "@/lib/needs";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

const MAX_ANSWER = 2000; // the /api/questions proxy slices at 2000

/** A row's tap, typed: the verb from `buttons(item)` plus the answer text for a question answer. */
function actionFor(item: NeedsItem, verb: string, answer: string): NeedsAction {
  switch (item.kind) {
    case "question":
      return verb === "answer" ? { kind: "question", verb: "answer", answer } : { kind: "question", verb: "dismiss" };
    case "growth": return { kind: "growth", verb: verb === "accept" ? "accept" : "decline" };
    case "guardian": return { kind: "guardian", verb: verb === "resolve" ? "resolve" : "acknowledge" };
    case "basin": return { kind: "basin", verb: verb === "confirm" ? "confirm" : "dismiss" };
    case "basin_move": throw new Error("not actionable here"); // rowLink() sends it to the basins page
  }
}

export default function NeedsRow({
  item,
  nowMs,
  onSettled,
}: {
  item: NeedsItem;
  nowMs: number;
  onSettled: (key: string) => void;
}) {
  const queue = useWriteQueue();
  const [st, setSt] = useState<RowState>("idle");
  const [answer, setAnswer] = useState("");
  const [action, setAction] = useState<NeedsAction | null>(null);
  const [dropped, setDropped] = useState(false);
  const [inGrace, setInGrace] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  // `waiting()` is not reactive: watch it while a write sits in its grace window, so undo leaves when it sends.
  useEffect(() => {
    if (st !== "pending") return;
    const t = window.setInterval(() => {
      const p = pendingRef.current;
      if (!p || !p.waiting()) {
        setInGrace(false);
        window.clearInterval(t);
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [st]);

  function submit(verb: string) {
    const a = actionFor(item, verb, answer.trim());
    const wasAnswer = a.verb === "answer";
    const pending = queue.submit(resolveWrite(item, a));
    pendingRef.current = pending;
    setAction(a);
    setDropped(false);
    setInGrace(true);
    setSt((s) => rowState(s, "submit"));
    void pending.done.then((r) => {
      if (pendingRef.current !== pending) return; // undone, or replaced by a newer tap
      const o = outcomeLine(r);
      setSt((s) => rowState(s, "result", o, { wasAnswer }));
      if (o === "saved" || o === "already") {
        onSettled(item.key);
        window.dispatchEvent(new Event("hearth:needs-changed"));
      }
      if (o === "failed" && r !== "undone" && r.dropped) setDropped(true);
    });
  }

  function undo() {
    const p = pendingRef.current;
    if (!p || !p.waiting()) return;
    pendingRef.current = null;
    p.undo();
    setInGrace(false);
    setSt((s) => rowState(s, "undo", undefined, { wasAnswer: action?.verb === "answer" }));
  }

  const who = whoLabel(item);
  const dot = who === "Guardian" ? null : (item.companion_id && COMPANION_COLOR[item.companion_id as keyof typeof COMPANION_COLOR]) || "var(--h-muted)";
  const age = ageLabel(item.created_at, new Date(nowMs));
  const settled = st === "saved" || st === "already";

  return (
    <li className={settled ? "h-needs-row is-done" : "h-needs-row"}>
      <div className="h-needs-head">
        {dot && <span aria-hidden="true" className="h-dot has-c h-needs-dot" style={tint(dot)} />}
        <b>{who}</b>
        <span className="h-needs-meta">
          {kindLabel(item.kind)}
          {age ? ` · ${age}` : ""}
        </span>
        {item.kind === "guardian" && item.severity === "red" && <span className="h-needs-urgent">urgent</span>}
      </div>
      <p className="h-needs-title">{titleText(item)}</p>
      {item.detail && item.kind !== "basin_move" && <p className="h-needs-detail">{item.detail}</p>}
      {rowLink(item) && (
        <div className="h-needs-actions">
          <Link href={rowLink(item)!.href} className="h-btn is-primary">{rowLink(item)!.label}</Link>
        </div>
      )}

      {st === "idle" && (
        <div className="h-needs-actions">
          {buttons(item).map((b, i) => (
            <button
              key={b.verb}
              type="button"
              className={i === 0 ? "h-btn is-primary" : "h-btn"}
              onClick={() => (b.verb === "answer" ? setSt((s) => rowState(s, "open-answer")) : submit(b.verb))}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {st === "answering" && (
        <div className="h-needs-answer">
          <textarea
            className="h-input is-area"
            value={answer}
            maxLength={MAX_ANSWER}
            rows={3}
            aria-label={`Your answer to ${who}`}
            autoFocus
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="h-needs-actions">
            <button type="button" className="h-btn is-primary" disabled={!canSend(answer)} onClick={() => submit("answer")}>
              Send
            </button>
            <button type="button" className="h-btn" onClick={() => setSt((s) => rowState(s, "cancel"))}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(st === "pending" || st === "saved") && action && (
        <div className="h-needs-line" role="status">
          <span className="h-msg">{doneLine(action)}</span>
          {st === "pending" && inGrace && (
            <button type="button" className="h-btn" onClick={undo}>
              undo
            </button>
          )}
        </div>
      )}

      {st === "already" && (
        <div className="h-needs-line" role="status">
          <span className="h-msg">Already handled.</span>
        </div>
      )}

      {st === "failed" && (
        <div className="h-needs-line" role="status">
          <span className="h-msg is-warn">
            {dropped ? "Didn’t save." : "Didn’t save. I’ll retry next time Hearth opens."}
          </span>
        </div>
      )}
    </li>
  );
}
