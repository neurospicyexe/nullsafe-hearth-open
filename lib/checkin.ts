// One-tap spoons check-in: which write goes to the queue for a tap, an undo or a word.
// Pure: no React, no window. The component is wiring; every decision lives here.
//
// The row id is generated HERE at tap time and sent with the POST (Halseth stores it and treats a
// repeat POST of the same id as a no-op), so the id is known before any answer comes back:
// undo = DELETE that id, a word = PATCH that id. A DELETE or PATCH must still wait for its POST to
// land, because Halseth answers 404 for an id it has not inserted yet and the queue drops 404s.
import type { Pending, QueuedWrite } from "./write-queue";

export type CheckinQueue = { submit(w: QueuedWrite): Pending; discard(key: string): void };
/**
 * What a check-in can carry besides the first spoon count. `pain`, `pain_where` and `notes` ("how it is")
 * are the Home check-in card's fields; `spoons` here is an edit of the count. null/"" clears on a PATCH.
 */
export type Extra = {
  mood?: string;
  energy?: number;
  spoons?: number;
  pain?: number | null;
  pain_where?: string | null;
  notes?: string | null;
};
/** landed: saved. failed: kept, retried next time Hearth opens. dropped: refused, nothing will retry it. */
export type Outcome = "landed" | "failed" | "dropped";
/** The word's own save state: shown as "Saving word…" until its write answers. */
export type WordState = "saving" | "saved" | "failed" | "dropped";

export const POST_KEY = "spoons";
export const undoKey = (id: string) => `spoons-undo-${id}`;
export const wordKey = (id: string) => `spoons-word-${id}`;
const rowUrl = (id: string) => `/api/biometrics/${encodeURIComponent(id)}`;

type Current = {
  id: string;
  /** null: the check-in has no spoon count (pain or a word on its own is enough). */
  spoons: number | null;
  recordedAt: string;
  extra: Extra;
  pending: Pending;
  outcome: "pending" | "landed" | "failed";
  /** "riding": the word travels in the POST; "patch": in its own PATCH (wordKey). */
  word: { state: WordState; via: "riding" | "patch" } | null;
};

export function createCheckin(
  queue: CheckinQueue,
  deps: { newId(): string; now(): Date },
  onOutcome: (o: Outcome) => void,
  onWord: (w: WordState) => void = () => {},
) {
  let cur: Current | null = null;

  function setWord(c: Current, state: WordState, via: "riding" | "patch"): void {
    c.word = { state, via };
    if (cur === c) onWord(state);
  }

  function patchWord(c: Current, extra: Extra): void {
    setWord(c, "saving", "patch");
    const p = queue.submit({ key: wordKey(c.id), url: rowUrl(c.id), method: "PATCH", body: extra });
    void p.done.then((r) => {
      if (r === "undone" || c.word?.via !== "patch") return;
      setWord(c, r.ok ? "saved" : r.dropped ? "dropped" : "failed", "patch");
    });
  }

  function submitPost(c: Current): void {
    const p = queue.submit({
      key: POST_KEY,
      url: "/api/biometrics",
      method: "POST",
      body: {
        id: c.id,
        recorded_at: c.recordedAt,
        source: "hearth-quick",
        ...(c.spoons !== null ? { spoons: c.spoons } : {}),
        ...c.extra,
      },
    });
    c.pending = p;
    c.outcome = "pending";
    void p.done.then((r) => {
      if (r === "undone" || c.pending !== p) return; // replaced by a newer intent for this same row
      c.outcome = r.ok ? "landed" : "failed";
      const o: Outcome = r.ok ? "landed" : r.dropped ? "dropped" : "failed";
      if (cur === c) onOutcome(o);
      if (c.word?.via === "riding" && c.word.state === "saving") setWord(c, o === "landed" ? "saved" : o, "riding");
    });
  }

  function deleteRow(id: string): void {
    queue.submit({ key: undoKey(id), url: rowUrl(id), method: "DELETE" });
  }

  /** Walk away from a check-in (undone, or superseded before it landed) leaving no row behind. */
  function retire(c: Current): void {
    if (c.outcome === "landed") {
      queue.discard(wordKey(c.id));
      deleteRow(c.id);
    } else if (c.outcome === "failed") {
      // Forget the stored retry, and DELETE by the client id in case the POST was saved but its answer
      // was lost (a 404 for a row that never landed is dropped by the queue as non-retryable).
      queue.discard(POST_KEY);
      deleteRow(c.id);
    } else if (c.pending.waiting()) {
      c.pending.undo(); // still in grace: nothing was ever sent
    } else {
      // In flight: only a POST that lands leaves a row to delete.
      void c.pending.done.then((r) => {
        if (r !== "undone" && r.ok) deleteRow(c.id);
      });
    }
  }

  return {
    /** "same": the answer changed inside the grace window (same row). "new": a new row was started. */
    tap(spoons: number): "same" | "new" {
      const c0 = cur;
      if (c0 && c0.outcome === "pending" && c0.pending.waiting()) {
        // Same check-in, changed answer: the resubmit replaces the waiting POST (same id).
        c0.spoons = spoons;
        c0.recordedAt = deps.now().toISOString();
        submitPost(c0);
        return "same";
      }
      // A landed check-in stays (a new tap is a new log). One that has not landed is superseded.
      if (c0 && c0.outcome !== "landed") retire(c0);
      const c: Current = {
        id: deps.newId(),
        spoons,
        recordedAt: deps.now().toISOString(),
        extra: {},
        pending: null as unknown as Pending, // set by submitPost
        outcome: "pending",
        word: null,
      };
      cur = c;
      submitPost(c);
      return "new";
    },

    /** Add a word / energy to the current check-in. False when there is nothing to attach it to. */
    saveWord(extra: Extra): boolean {
      const c = cur;
      if (!c || Object.keys(extra).length === 0) return false;
      Object.assign(c.extra, extra);
      if (typeof extra.spoons === "number") c.spoons = extra.spoons;
      if (c.outcome === "landed") {
        patchWord(c, extra);
      } else if (c.outcome === "failed" || c.pending.waiting()) {
        setWord(c, "saving", "riding");
        submitPost(c); // one request carries everything; for a failed one the stored retry now does
      } else {
        // In flight: PATCH once it lands; if it fails, the retry POST carries the word.
        setWord(c, "saving", "patch");
        const p = c.pending;
        void p.done.then((r) => {
          if (r === "undone" || cur !== c || c.pending !== p) return;
          if (r.ok) patchWord(c, extra);
          else {
            setWord(c, "saving", "riding");
            submitPost(c);
          }
        });
      }
      return true;
    },

    /**
     * The Home check-in card's Save. Any ONE field is enough. No row yet: one POST carries everything
     * (a new row). A row already there (landed, in grace, or failed): the fields amend that same row
     * (PATCH, or ride the waiting/retried POST), so an edit never becomes a second row.
     * False when there is nothing to save.
     */
    save(fields: Extra): boolean {
      const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
      if (entries.length === 0) return false;
      const clean = Object.fromEntries(entries) as Extra;
      if (!cur) {
        const { spoons, ...rest } = clean;
        const c: Current = {
          id: deps.newId(),
          spoons: typeof spoons === "number" ? spoons : null,
          recordedAt: deps.now().toISOString(),
          extra: rest,
          pending: null as unknown as Pending, // set by submitPost
          outcome: "pending",
          word: null,
        };
        cur = c;
        submitPost(c);
        return true;
      }
      return this.saveWord(clean);
    },

    /** Bind the card to a row that already exists today (found on load), so Save edits it in place. */
    adopt(id: string): void {
      const settled: Pending = { undo() {}, waiting: () => false, done: Promise.resolve({ ok: true, status: 200, json: null }) };
      cur = { id, spoons: null, recordedAt: deps.now().toISOString(), extra: {}, pending: settled, outcome: "landed", word: null };
    },

    /** Queue keys whose failure the strip is showing right now (the app-wide line leaves those out). */
    owned(): string[] {
      const c = cur;
      if (!c) return [];
      const keys: string[] = [];
      if (c.outcome === "failed") keys.push(POST_KEY);
      if (c.word?.via === "patch" && c.word.state === "failed") keys.push(wordKey(c.id));
      return keys;
    },

    undo(): void {
      const c = cur;
      if (!c) return;
      cur = null;
      retire(c);
    },
  };
}

// ---- the Home check-in card: pure helpers (no React, no window) ----

export const SPOON_MAX = 12;
export const PAIN_MAX = 10;
export const PAIN_WHERE_MAX = 120;
export const NOTES_MAX = 2000;

/** What the card's inputs hold. null / "" = not filled in. */
export type FormState = { spoons: number | null; pain: number | null; painWhere: string; notes: string };
/** The check-in row as the card knows it (today's row, from Halseth). */
export type SavedCheckin = {
  id: string;
  spoons: number | null;
  pain: number | null;
  pain_where: string | null;
  notes: string | null;
};

/**
 * The fields to save from the form; null when there is nothing to save. Zero is an answer (0 spoons,
 * 0 pain). With a saved row (an edit), a field the saved row had and the form now leaves empty is
 * sent as a clear (pain null, "" for text); a spoon count cannot be cleared.
 */
export function fieldsFromForm(f: FormState, saved: SavedCheckin | null): Extra | null {
  const out: Extra = {};
  if (f.spoons !== null) out.spoons = f.spoons;
  if (f.pain !== null) out.pain = f.pain;
  else if (saved && saved.pain !== null) out.pain = null;
  const where = f.painWhere.trim().slice(0, PAIN_WHERE_MAX);
  if (where !== "") out.pain_where = where;
  else if (saved && (saved.pain_where ?? "") !== "") out.pain_where = "";
  const notes = f.notes.trim().slice(0, NOTES_MAX);
  if (notes !== "") out.notes = notes;
  else if (saved && (saved.notes ?? "") !== "") out.notes = "";
  const filled = f.spoons !== null || f.pain !== null || where !== "" || notes !== "";
  return filled || (saved !== null && Object.keys(out).length > 0) ? out : null;
}

const NOTE_SHOWN = 24;

/** The parts of the one-line summary, in order, only what was given: "5 spoons", "4 pain", "hips", the word in quotes. */
export function summaryParts(c: Pick<SavedCheckin, "spoons" | "pain" | "pain_where" | "notes">): string[] {
  const parts: string[] = [];
  if (c.spoons !== null) parts.push(`${c.spoons} ${c.spoons === 1 ? "spoon" : "spoons"}`);
  if (c.pain !== null) parts.push(`${c.pain} pain`);
  const where = (c.pain_where ?? "").trim();
  if (where !== "") parts.push(where);
  const note = (c.notes ?? "").replace(/\s+/g, " ").trim();
  if (note !== "") {
    const chars = Array.from(note);
    const shown = chars.length > NOTE_SHOWN ? chars.slice(0, NOTE_SHOWN).join("").trimEnd() + "…" : note;
    parts.push(`“${shown}”`);
  }
  return parts;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Halseth stores UTC as "YYYY-MM-DD HH:MM:SS" or ISO; both read as UTC when no zone is given. */
function parseStored(s: string): Date | null {
  let t = s.trim().replace(" ", "T");
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(t)) t += "Z";
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Today's check-in from GET /api/biometrics (newest first): a Hearth row from today's local day that
 * has a spoon count, pain, or a word. Wearable rows never count. Null when Halseth did not answer
 * with a list.
 */
export function todaysCheckin(rows: unknown, now: Date): SavedCheckin | null {
  if (!Array.isArray(rows)) return null;
  const today = localDayKey(now);
  for (const raw of rows) {
    const r = raw as Record<string, unknown> | null;
    if (!r || typeof r["id"] !== "string" || typeof r["source"] !== "string" || !r["source"].startsWith("hearth")) continue;
    const at = typeof r["recorded_at"] === "string" ? parseStored(r["recorded_at"]) : null;
    if (!at || localDayKey(at) !== today) continue;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
    const found: SavedCheckin = {
      id: r["id"],
      spoons: num(r["spoons"]),
      pain: num(r["pain"]),
      pain_where: str(r["pain_where"]),
      // The old quick path kept its word in mood; "how it is" is notes.
      notes: str(r["notes"]) ?? str(r["mood"]),
    };
    if (found.spoons !== null || found.pain !== null || found.notes !== null) return found;
  }
  return null;
}

/** "Not now" is remembered as today's local date; it folds the card until the date changes. */
export const FOLD_KEY = "hearth:checkin-folded";
export function foldMarker(now: Date): string {
  return localDayKey(now);
}
export function foldedUntilTomorrow(marker: string | null, now: Date): boolean {
  return marker !== null && marker === localDayKey(now);
}
