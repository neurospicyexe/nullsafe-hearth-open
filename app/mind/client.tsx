"use client";

import { useState } from "react";
import { type CompanionNote } from "@/lib/halseth";

// ── Companion Notes Feed ──────────────────────────────────────────────────────

export function CompanionNotesFeedClient({ initialNotes }: { initialNotes: CompanionNote[] }) {
  const [filter, setFilter] = useState<"all" | "drevan" | "cypher" | "gaia">("all");

  const filtered =
    filter === "all" ? initialNotes : initialNotes.filter((n) => n.agent === filter);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="card">
      <div className="card-title">Companion Notes</div>
      <div className="agent-filter-tabs">
        {(["all", "drevan", "cypher", "gaia"] as const).map((f) => (
          <button
            key={f}
            className={`agent-filter-tab${filter === f ? ` active ${f}` : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="h-empty">No notes{filter !== "all" ? ` from ${filter}` : ""}.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {filtered.map((note) => (
            <div key={note.id} className="companion-note-card">
              <div className="companion-note-text">{note.note_text}</div>
              <div className="companion-note-meta">
                <span className={`agent-badge ${note.agent}`}>{note.agent}</span>
                {note.tags?.map((tag) => (
                  <span key={tag} className="companion-note-tag">{tag}</span>
                ))}
                <span className="companion-note-time">{formatTime(note.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Companion Note Form ───────────────────────────────────────────────────────

export function CompanionNoteFormClient() {
  const [agent, setAgent] = useState<"drevan" | "cypher" | "gaia">("drevan");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus("saving");
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await fetch("/api/companion-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, note_text: text, tags: tagList }),
    });
    if (res.ok) {
      setText("");
      setTags("");
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="card">
      <div className="card-title">Add Companion Note</div>
      <form onSubmit={submit} className="uplink-form">
        <div className="form-field">
          <label className="form-label">Agent</label>
          <div className="author-toggle">
            {(["drevan", "cypher", "gaia"] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`author-btn${agent === a ? ` active h-bg-${a}` : ""}`}
                onClick={() => setAgent(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">Note</label>
          <textarea
            className="form-textarea"
            maxLength={4000}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What does this companion want to remember about themselves?"
          />
        </div>
        <div className="form-field">
          <label className="form-label">Tags (comma-separated)</label>
          <input
            className="form-input"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="identity, values, memory"
          />
        </div>
        <button type="submit" className="submit-btn" disabled={status === "saving" || !text.trim()}>
          {status === "saving" ? "Saving…" : status === "done" ? "Saved ✓" : "Save Note"}
        </button>
        {status === "error" && (
          <p style={{ color: "var(--h-warn)", fontSize: "0.82rem" }}>Failed to save. Try again.</p>
        )}
      </form>
    </div>
  );
}

// ── Journal Form ──────────────────────────────────────────────────────────────

export function JournalFormClient() {
  const [entry, setEntry] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry.trim()) return;
    setStatus("saving");
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await fetch("/api/mind/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry, tags: tagList }),
    });
    if (res.ok) {
      setEntry("");
      setTags("");
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="card">
      <div className="card-title">New Journal Entry</div>
      <form onSubmit={submit} className="uplink-form">
        <div className="form-field">
          <textarea
            className="form-textarea"
            maxLength={8000}
            rows={4}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="What&apos;s on your mind?"
          />
        </div>
        <div className="form-field">
          <label className="form-label">Tags</label>
          <input
            className="form-input"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="identity, reflection"
          />
        </div>
        <button type="submit" className="submit-btn" disabled={status === "saving" || !entry.trim()}>
          {status === "saving" ? "Saving…" : status === "done" ? "Saved ✓" : "Add to Journal"}
        </button>
      </form>
    </div>
  );
}
