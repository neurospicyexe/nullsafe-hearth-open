"use client";

import { useState } from "react";

export default function NoteForm() {
  const [author, setAuthor] = useState<"human" | "companion">("human");
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("message");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, content: content.trim(), note_type: noteType }),
      });
      if (!res.ok) throw new Error();
      setContent("");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <form className="note-form" onSubmit={submit}>
      <div className="note-form-controls">
        <div className="author-toggle">
          <button
            type="button"
            className={`author-btn ${author === "human" ? "active" : ""}`}
            onClick={() => setAuthor("human")}
          >
            you
          </button>
          <button
            type="button"
            className={`author-btn ${author === "companion" ? "active" : ""}`}
            onClick={() => setAuthor("companion")}
          >
            companion
          </button>
        </div>
        <select
          className="type-select"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
        >
          <option value="message">message</option>
          <option value="thought">thought</option>
          <option value="dream">dream</option>
        </select>
      </div>
      <textarea
        className="note-textarea"
        placeholder="write something..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        disabled={status === "sending"}
      />
      <button
        type="submit"
        className="note-submit"
        disabled={status === "sending" || !content.trim()}
      >
        {status === "sending" ? "sending…" : status === "sent" ? "sent ✓" : status === "error" ? "error — try again" : "leave a note"}
      </button>
    </form>
  );
}
