"use client";

// Convene a council right from the page (2026-07-02) — no Discord detour.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConveneForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  // Halseth refuses a question over this (POST /mind/council/convene, 413). It used to slice at
  // 2000 and echo the full text back, so a long paste looked like it saved and did not.
  const MAX = 2000;
  const over = question.length - MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || q.length > MAX) return;
    setStatus("saving");
    const res = await fetch("/api/council", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    }).catch(() => null);
    if (!res?.ok) { setStatus("error"); return; }
    setQuestion("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: "1.5rem" }}>
      <div className="card-title">Convene a council</div>
      <p style={{ fontSize: "0.72rem", color: "var(--h-muted)", margin: "0 0 0.75rem" }}>
        A hard question, answered by each of the triad, ranked blind, synthesized by Gaia.
      </p>
      <textarea
        className="form-textarea"
        rows={2}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="the question you want the triad to sit with…"
      />
      <div style={{ fontSize: "0.7rem", marginTop: "0.35rem", color: over > 0 ? "var(--h-warn)" : "var(--h-muted)" }}>
        {over > 0
          ? `${over.toLocaleString()} over — a council question is capped at ${MAX.toLocaleString()} characters. Send the ask; keep the background for the thread.`
          : `${question.length.toLocaleString()} / ${MAX.toLocaleString()}`}
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <button type="submit" className="submit-btn" disabled={status === "saving" || !question.trim() || over > 0}>
          {status === "saving" ? "Convening…" : "Convene"}
        </button>
        {status === "error" && (
          <span style={{ color: "var(--h-warn)", fontSize: "0.8rem", marginLeft: "0.6rem" }}>failed — try again</span>
        )}
      </div>
    </form>
  );
}
