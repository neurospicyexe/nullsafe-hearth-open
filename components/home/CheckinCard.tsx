"use client";

import { useEffect, useState } from "react";
import {
  FOLD_KEY,
  NOTES_MAX,
  PAIN_MAX,
  PAIN_WHERE_MAX,
  SPOON_MAX,
  createCheckin,
  fieldsFromForm,
  foldMarker,
  foldedUntilTomorrow,
  summaryParts,
  todaysCheckin,
  type FormState,
  type SavedCheckin,
} from "@/lib/checkin";
import { unsavedCount, unsavedLine } from "@/lib/write-queue";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

type Mode = "loading" | "open" | "saved" | "folded";
type Save = "idle" | "saving" | "saved" | "failed" | "dropped";

const SPOONS = Array.from({ length: SPOON_MAX + 1 }, (_, i) => i);
const PAINS = Array.from({ length: PAIN_MAX + 1 }, (_, i) => i);
const EMPTY: FormState = { spoons: null, pain: null, painWhere: "", notes: "" };

/** Row id generated at tap time; Halseth takes 8..64 chars of [A-Za-z0-9_-]. */
function newRowId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `hq${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

// localStorage can be missing, blocked or full (private window): the card must work without it.
function readFold(): string | null {
  try {
    return window.localStorage.getItem(FOLD_KEY);
  } catch {
    return null;
  }
}
function writeFold(marker: string): void {
  try {
    window.localStorage.setItem(FOLD_KEY, marker);
  } catch {
    // folded for this visit only
  }
}
function clearFold(): void {
  try {
    window.localStorage.removeItem(FOLD_KEY);
  } catch {
    // nothing to clear
  }
}

function toForm(c: SavedCheckin): FormState {
  return { spoons: c.spoons, pain: c.pain, painWhere: c.pain_where ?? "", notes: c.notes ?? "" };
}

/**
 * The Home check-in (nav 3a): spoons 0-12 and pain 0-10 as rows of chips, where the pain is, "how it
 * is", one "Check in" button. Any ONE field is enough. Saved, it folds to one line; "edit" reopens the
 * same card bound to the same row and amends it (never a second row). "not now" folds it until
 * tomorrow, per device. No streak, no nag.
 */
export default function CheckinCard() {
  const queue = useWriteQueue();
  const [mode, setMode] = useState<Mode>("loading");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<SavedCheckin | null>(null);
  const [save, setSave] = useState<Save>("idle");
  const [failedKeys, setFailedKeys] = useState<string[]>([]);

  // Which write goes where (POST for a new row, PATCH for an edit, by row id) lives in lib/checkin.ts.
  // A refused or unreachable save reopens the form with what was typed still in it.
  const [checkin] = useState(() =>
    createCheckin(
      queue,
      { newId: newRowId, now: () => new Date() },
      (o) => {
        setSave(o === "landed" ? "saved" : o);
        if (o !== "landed") setMode("open");
      },
      (w) => {
        setSave(w);
        if (w === "failed" || w === "dropped") setMode("open");
      },
    ),
  );

  useEffect(() => {
    const read = () => setFailedKeys(queue.failed().map((w) => w.key));
    read();
    return queue.subscribe(read);
  }, [queue]);
  const notice = unsavedLine(unsavedCount(failedKeys, checkin.owned()));

  // On load: today's row (from any hearth path) shows folded; else open, unless "not now" was said today.
  useEffect(() => {
    let live = true;
    const now = new Date();
    const folded = foldedUntilTomorrow(readFold(), now);
    fetch("/api/biometrics")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((rows: unknown) => {
        if (!live) return;
        const today = todaysCheckin(rows, now);
        if (today) {
          checkin.adopt(today.id);
          setSaved(today);
          setForm(toForm(today));
          setMode("saved");
        } else {
          setMode(folded ? "folded" : "open");
        }
      });
    return () => {
      live = false;
    };
  }, [checkin]);

  const fields = fieldsFromForm(form, saved);

  function submit() {
    if (!fields) return;
    const next: SavedCheckin = {
      id: saved?.id ?? "",
      spoons: form.spoons ?? saved?.spoons ?? null,
      pain: form.pain,
      pain_where: form.painWhere.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (!checkin.save(fields)) return;
    setSaved(next);
    setSave("saving");
    setMode("saved");
    clearFold();
  }

  function notNow() {
    writeFold(foldMarker(new Date()));
    setMode("folded");
  }

  if (mode === "loading") return <section className="h-checkin is-loading" aria-hidden="true" />;

  if (mode === "folded") {
    return (
      <section className="h-checkin is-folded" aria-label="Check in">
        <button type="button" className="h-btn" onClick={() => setMode("open")}>
          check in
        </button>
      </section>
    );
  }

  if (mode === "saved" && saved) {
    const parts = summaryParts(saved);
    return (
      <section className="h-checkin is-saved" aria-label="Check in">
        {notice && <p className="h-checkin-unsaved" role="status">{notice}</p>}
        <div className="h-checkin-sum">
          <p className="h-checkin-line" role="status">
            {saved.spoons !== null && (
              <span className="h-checkin-big">{saved.spoons} <span className="h-checkin-unit">{saved.spoons === 1 ? "spoon" : "spoons"}</span></span>
            )}
            {saved.pain !== null && (
              <span className="h-checkin-big is-pain">
                {saved.pain} <span className="h-checkin-unit">pain{saved.pain_where ? ` · ${saved.pain_where}` : ""}</span>
              </span>
            )}
            {saved.spoons === null && saved.pain === null && <span className="h-checkin-unit">{parts.join(" · ")}</span>}
            {save === "saving" && <span className="h-checkin-state">saving…</span>}
          </p>
          {saved.notes && <p className="h-checkin-note">“{saved.notes}”</p>}
        </div>
        <button type="button" className="h-checkin-edit" onClick={() => { setForm(toForm(saved)); setMode("open"); }}>
          edit
        </button>
      </section>
    );
  }

  const failed = save === "failed" || save === "dropped";
  return (
    <section className="h-checkin" aria-label="Check in">
      {notice && <p className="h-checkin-unsaved" role="status">{notice}</p>}
      <div className="h-checkin-group">
        <div className="h-checkin-head">
          <span className="h-checkin-label" id="ck-spoons">Spoons</span>
          {form.spoons !== null && <span className="h-checkin-val">{form.spoons}</span>}
        </div>
        <div className="h-checkin-row" role="group" aria-labelledby="ck-spoons">
          {SPOONS.map((n) => (
            <button
              key={n}
              type="button"
              className="h-checkin-chip"
              aria-pressed={form.spoons === n}
              aria-label={`${n} spoons`}
              onClick={() => setForm((f) => ({ ...f, spoons: f.spoons === n ? null : n }))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="h-checkin-group">
        <div className="h-checkin-head">
          <span className="h-checkin-label" id="ck-pain">Pain</span>
          {form.pain !== null && <span className="h-checkin-val is-pain">{form.pain}</span>}
        </div>
        <div className="h-checkin-row" role="group" aria-labelledby="ck-pain">
          {PAINS.map((n) => (
            <button
              key={n}
              type="button"
              className="h-checkin-chip"
              aria-pressed={form.pain === n}
              aria-label={`pain ${n}`}
              onClick={() => setForm((f) => ({ ...f, pain: f.pain === n ? null : n }))}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          className="h-input h-checkin-where"
          type="text"
          value={form.painWhere}
          maxLength={PAIN_WHERE_MAX}
          placeholder="where, or what kind"
          aria-label="Where the pain is, or what kind"
          onChange={(e) => setForm((f) => ({ ...f, painWhere: e.target.value }))}
        />
      </div>

      <div className="h-checkin-group">
        <div className="h-checkin-head">
          <label className="h-checkin-label" htmlFor="ck-notes">How it is</label>
          <span className="h-checkin-hint">a word, or a few sentences</span>
        </div>
        <textarea
          id="ck-notes"
          className="h-input h-checkin-notes"
          value={form.notes}
          maxLength={NOTES_MAX}
          rows={2}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      {failed && (
        <p className="h-msg is-warn" role="status">
          {save === "failed" ? "Didn’t save. I’ll retry next time Hearth opens. What you put is still here." : "Didn’t save. What you put is still here."}
        </p>
      )}

      <div className="h-checkin-actions">
        <button type="button" className="h-checkin-go" disabled={!fields} onClick={submit}>
          Check in
        </button>
        {saved ? (
          <button type="button" className="h-checkin-skip" onClick={() => { setForm(toForm(saved)); setMode("saved"); }}>
            cancel
          </button>
        ) : (
          <button type="button" className="h-checkin-skip" onClick={notNow}>
            not now
          </button>
        )}
      </div>
    </section>
  );
}
