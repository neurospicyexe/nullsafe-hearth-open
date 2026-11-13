"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LetterFormClient({
  companionId,
  companionName,
}: {
  companionId: string;
  companionName: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const router = useRouter();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus("sending");

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: "principal",
        content: text.trim(),
        note_type: `letter:${companionId}`,
      }),
    });

    if (res.ok) {
      setText("");
      setOpen(false);
      setStatus("idle");
      router.refresh();
    } else {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button className="letter-write-btn" onClick={() => setOpen(true)}>
        + write to {companionName}
      </button>
    );
  }

  return (
    <form className="letter-form" onSubmit={send}>
      <textarea
        className="letter-textarea"
        placeholder={`Leave something for ${companionName} — they'll find it when they're next in session.`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="letter-form-actions">
        {status === "error" && (
          <span className="h-cmp-send-err">
            failed to send
          </span>
        )}
        <button
          type="button"
          className="letter-cancel-btn"
          onClick={() => { setOpen(false); setText(""); setStatus("idle"); }}
        >
          cancel
        </button>
        <button
          type="submit"
          className="letter-send-btn"
          disabled={status === "sending" || !text.trim()}
        >
          {status === "sending" ? "sending…" : "send"}
        </button>
      </div>
    </form>
  );
}
