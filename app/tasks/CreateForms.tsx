"use client";

// Create tasks + events in place (2026-07-02) — Hearth was read-only for both.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddTaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setStatus("saving");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        priority,
        // date-only input: anchor to local noon so the ISO date can't roll back
        // a day when rendered in CDT (UTC-midnight trap)
        due_at: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : undefined,
      }),
    }).catch(() => null);
    if (!res?.ok) { setStatus("error"); return; }
    setTitle(""); setDueAt(""); setPriority("normal");
    setStatus("idle");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      <input
        className="form-input"
        style={{ flex: "1 1 200px" }}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="new task…"
      />
      <select className="form-select" style={{ width: "auto" }} value={priority} onChange={(e) => setPriority(e.target.value)}>
        {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input
        className="form-input"
        style={{ width: "auto" }}
        type="date"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        title="due date (optional)"
      />
      <button type="submit" className="submit-btn" disabled={status === "saving" || !title.trim()}>
        {status === "saving" ? "…" : "add"}
      </button>
      {status === "error" && <span style={{ color: "var(--h-warn)", fontSize: "0.8rem", alignSelf: "center" }}>failed</span>}
    </form>
  );
}

export function AddEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !start) return;
    setStatus("saving");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), start_time: new Date(start).toISOString() }),
    }).catch(() => null);
    if (!res?.ok) { setStatus("error"); return; }
    setTitle(""); setStart("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      <input
        className="form-input"
        style={{ flex: "1 1 200px" }}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="new event…"
      />
      <input
        className="form-input"
        style={{ width: "auto" }}
        type="datetime-local"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <button type="submit" className="submit-btn" disabled={status === "saving" || !title.trim() || !start}>
        {status === "saving" ? "…" : "add"}
      </button>
      {status === "error" && <span style={{ color: "var(--h-warn)", fontSize: "0.8rem", alignSelf: "center" }}>failed</span>}
    </form>
  );
}
