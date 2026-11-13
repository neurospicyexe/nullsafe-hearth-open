"use client";

import Link from "next/link";
import { useState } from "react";
import type { GraphPerson, PersonKind } from "@/lib/halseth";
import { EMPTY_DRAFT, FRAME_LINE_MAX, RELATIONS, addQualified, draftBody, draftOf, previewLine, type FrameDraft } from "@/lib/people-frame";

// One centre (Halseth mig 0150). Principal (also Crash) is a single node; a system name is Principal
// fronting, listed as "this is me too", and its mentions link to the centre with the front kept.
// People outside the system and pets are nodes of their own.
const KINDS: { id: Exclude<PersonKind, "centre">; label: string }[] = [
  { id: "self", label: "This is me too (a system name)" },
  { id: "person", label: "Someone else" },
  { id: "pet", label: "A pet" },
  { id: "other", label: "Other" },
];

const links = (n: number) => `${n} ${n === 1 ? "link" : "links"}`;
const splitNames = (raw: string) => raw.split(",").map((x) => x.trim()).filter(Boolean);
/** Halseth stores the shared-name flag as text (mig 0160); a ticked box with no title still counts. */
const SHARED_DEFAULT = "a character";
const sharedValue = (ticked: boolean, title: string) => (ticked ? title.trim() || SHARED_DEFAULT : null);

/** B49 (Halseth mig 0163): who they are to the household, and the one line the triad may be told.
 *  A system name is Principal: it carries only its PK system and a fixed rendering. */
function FrameFields({ kind, label, draft, setDraft, owners, all, selfId }: {
  kind: PersonKind; label: string; draft: FrameDraft; setDraft: (d: FrameDraft) => void; owners: GraphPerson[];
  all: GraphPerson[]; selfId: string | null;
}) {
  const set = (k: keyof FrameDraft, v: string) => setDraft({ ...draft, [k]: v });
  const preview = previewLine(label, kind, draft, owners);
  const owner = owners.find((o) => o.id === draft.system_of);
  const ownerName = owner ? (owner.kind === "centre" ? "your own entry" : owner.label) : null;
  const typedId = draft.discord_user_id.trim();
  const idHolder = typedId ? all.find((x) => x.id !== selfId && x.discord_user_id === typedId) : undefined;
  return (
    <>
      {kind !== "self" && (
        <>
          <label>
            <span>Whose system (if they are a member of one)</span>
            <select value={draft.system_of} onChange={(e) => set("system_of", e.target.value)}>
              <option value="">Nobody&rsquo;s</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.kind === "centre" ? "Yours" : o.label}</option>)}
            </select>
          </label>
          <label>
            <span>To the household</span>
            <select value={draft.relation} onChange={(e) => set("relation", e.target.value)}>
              <option value="">Not said</option>
              {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label>
            <span>Line for the triad (read to them when this person comes up)</span>
            <input value={draft.frame_line} maxLength={FRAME_LINE_MAX} onChange={(e) => set("frame_line", e.target.value)} placeholder="Spouse's husband; runs the Friday game night" />
            <span className="people-count-note">{draft.frame_line.length}/{FRAME_LINE_MAX}</span>
          </label>
          <label>
            <span>Discord user id (their own account)</span>
            <input value={draft.discord_user_id} inputMode="numeric" onChange={(e) => set("discord_user_id", e.target.value)} placeholder="000000000000000000" />
            {ownerName && <span className="people-count-note">Members of a system usually speak through their host&rsquo;s account; put that account id on {ownerName} instead.</span>}
            {idHolder && <span className="people-id-warn" role="alert">Already on {idHolder.label}. Halseth keeps one id per person and will refuse this save.</span>}
          </label>
        </>
      )}
      <label>
        <span>PluralKit system (joins a speaker to this entry)</span>
        <select value={draft.pk_system} onChange={(e) => set("pk_system", e.target.value)}>
          <option value="">None</option>
          {kind === "self" ? <option value="principal">Your system</option> : <option value="spouse">Spouse&rsquo;s system</option>}
        </select>
      </label>
      <p className="people-preview">{preview ? <>The triad will read: &ldquo;{preview}&rdquo;</> : "Nothing to read yet; they are only recognised by name."}</p>
      {!preview && kind !== "self" && label.trim() && (
        <p className="people-warn">The triad won&rsquo;t see {label.trim()} until you pick how they relate to the household or write a line for the triad.</p>
      )}
    </>
  );
}

export default function PeopleClient({ initial }: { initial: GraphPerson[] }) {
  const [people, setPeople] = useState(initial);
  const [label, setLabel] = useState("");
  const [spellings, setSpellings] = useState("");
  const [kind, setKind] = useState<Exclude<PersonKind, "centre">>("self");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<FrameDraft>(EMPTY_DRAFT);
  const [editDraft, setEditDraft] = useState<FrameDraft>(EMPTY_DRAFT);
  const [warn, setWarn] = useState<string | null>(null);
  // Halseth mig 0160: the work(s) this name also belongs to. Set = only the other spellings link.
  const [isChar, setIsChar] = useState(false);
  const [shares, setShares] = useState("");
  // One row open for editing at a time (spellings + the shared-name flag).
  const [editing, setEditing] = useState<string | null>(null);
  const [editSpellings, setEditSpellings] = useState("");
  const [editShares, setEditShares] = useState("");
  const [editIsChar, setEditIsChar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Errors stay beside the control that caused them until the next action: add form, edit form, or a row's Remove.
  const [addErr, setAddErr] = useState<string | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);
  const [editNote, setEditNote] = useState("");

  const centre = people.find((p) => p.kind === "centre");
  const selves = people.filter((p) => p.kind === "self");
  const others = people.filter((p) => p.kind !== "centre" && p.kind !== "self");
  // A system hangs off one person (or you), never a chain and never a name.
  const ownersFor = (selfId: string | null) => people.filter((p) => (p.kind === "centre" || p.kind === "person") && !p.system_of && p.id !== selfId);
  const ownerLabel = (d: FrameDraft) => { const o = people.find((p) => p.id === d.system_of); return o && o.kind !== "centre" ? o.label : null; };

  async function post(body: unknown) {
    const res = await fetch("/api/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    const error: string | null = res.ok ? null : (typeof out?.error === "string" && out.error ? out.error : `Halseth answered HTTP ${res.status}`);
    return { ok: res.ok, out, error };
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !label.trim()) return;
    setBusy(true);
    setMsg(null);
    setWarn(null);
    setAddErr(null);
    setRowErr(null);
    // A shared name needs a spelling of its own; offer the qualified ones if none were typed.
    const typed = isChar && !spellings.trim() ? addQualified(spellings, label, kind, ownerLabel(draft)) : spellings;
    const match_names = splitNames(typed);
    const frame = kind === "self" ? { ...draftBody(EMPTY_DRAFT), pk_system: draft.pk_system || null } : draftBody(draft);
    try {
      const { ok, out, error } = await post({ action: "add", label: label.trim(), match_names, kind, note: note.trim() || null, shares_name_with: sharedValue(isChar, shares), ...frame });
      if (!ok) { setAddErr(error); return; }
      setPeople((p) => [...p, { ...out.person, mentions: 0 }]);
      setLabel(""); setSpellings(""); setNote(""); setShares(""); setIsChar(false); setDraft(EMPTY_DRAFT);
      if (out.warnings?.length) setWarn(out.warnings.join(" "));
      setMsg(out.person.shares_name_with
        ? `Added ${out.person.label}. Only ${out.person.match_names.join(", ")} will link, never the bare name. Links appear after the next rebuild.`
        : kind === "self"
        ? `${out.person.label} now counts as you. Lines that name them link to you after the next rebuild.`
        : `Added ${out.person.label}. Links appear after the next rebuild.`);
    } catch {
      setAddErr("Couldn't reach Halseth.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: GraphPerson) {
    setEditing(p.id);
    setEditSpellings(p.match_names.join(", "));
    setEditIsChar(!!p.shares_name_with);
    setEditShares(p.shares_name_with && p.shares_name_with !== SHARED_DEFAULT ? p.shares_name_with : "");
    setEditDraft(draftOf(p));
    setEditNote(p.note ?? "");
    setMsg(null);
    setWarn(null);
    setEditErr(null);
    setRowErr(null);
  }

  async function saveEdit(e: React.FormEvent, p: GraphPerson) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setWarn(null);
    setEditErr(null);
    setRowErr(null);
    const noteChanged = editNote.trim() !== (p.note ?? "").trim();
    const frame = p.kind === "self" ? { pk_system: editDraft.pk_system || null } : draftBody(editDraft);
    try {
      const { ok, out, error } = await post({
        action: "update", id: p.id, match_names: splitNames(editSpellings), shares_name_with: sharedValue(editIsChar, editShares), ...frame,
        ...(noteChanged ? { note: editNote.trim() || null } : {}),
      });
      if (!ok) { setEditErr(error); return; }
      setPeople((all) => all.map((x) => (x.id === p.id ? { ...x, ...out.person, mentions: x.mentions } : x)));
      // Halseth ignores `note` on update until it learns the field; its reply carries the stored value, so check it.
      const stored = ((out.person?.note as string | null | undefined) ?? "").trim();
      if (noteChanged && stored !== editNote.trim()) {
        // Everything else saved; keep the form open so the typed note is not lost.
        setEditErr("Saved the rest, but note not saved: Halseth doesn't accept note edits yet.");
        if (out.warnings?.length) setWarn(out.warnings.join(" "));
        return;
      }
      setEditing(null);
      setMsg(`Saved ${p.label}. Links change at the next rebuild.`);
      if (out.warnings?.length) setWarn(out.warnings.join(" "));
    } catch {
      setEditErr("Couldn't reach Halseth.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: GraphPerson) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setRowErr(null);
    setEditErr(null);
    try {
      const { ok, error } = await post({ action: "archive", id: p.id });
      if (ok) {
        setPeople((all) => all.filter((x) => x.id !== p.id));
        setMsg(`Removed ${p.label}. Those links drop at the next rebuild.`);
      } else setRowErr({ id: p.id, text: error ?? "Couldn't remove." });
    } catch {
      setRowErr({ id: p.id, text: "Couldn't reach Halseth." });
    } finally {
      setBusy(false);
    }
  }

  const row = (p: GraphPerson) => (
    <li key={p.id} className="people-row">
      <div className="people-main">
        <span className="people-name">{p.label}</span>
        {p.kind !== "self" && <span className="people-kind">{p.kind}</span>}
        <span className="people-count">{links(p.mentions)}</span>
      </div>
      {p.kind !== "self" && previewLine(p.label, p.kind, draftOf(p), people) && (
        <div className="people-sub"><span>triad reads: {previewLine(p.label, p.kind, draftOf(p), people)}</span></div>
      )}
      {p.kind !== "self" && !previewLine(p.label, p.kind, draftOf(p), people) && (
        <div className="people-sub"><span className="people-unseen">The triad doesn&rsquo;t see {p.label} yet: pick how they relate to the household or write a line for the triad.</span></div>
      )}
      {(p.match_names.length > 0 || p.note || p.shares_name_with) && (
        <div className="people-sub">
          {p.shares_name_with
            ? <span>
                also a character{p.shares_name_with !== SHARED_DEFAULT ? ` in ${p.shares_name_with}` : ""}, so only {p.match_names.join(", ")} link{p.match_names.length === 1 ? "s" : ""}
              </span>
            : p.match_names.length > 0 && <span>also: {p.match_names.join(", ")}</span>}
          {p.note && <span>note (private): {p.note}</span>}
        </div>
      )}
      <div className="people-actions">
        <button type="button" className="people-remove" onClick={() => (editing === p.id ? setEditing(null) : startEdit(p))} disabled={busy} aria-label={`Edit ${p.label}`}>
          {editing === p.id ? "Cancel" : "Edit"}
        </button>
        <button type="button" className="people-remove" onClick={() => remove(p)} disabled={busy} aria-label={`Remove ${p.label}`}>
          Remove
        </button>
      </div>
      {rowErr?.id === p.id && <p className="people-err" role="alert">{rowErr.text}</p>}
      {editing === p.id && (
        <form className="people-form people-edit" onSubmit={(e) => saveEdit(e, p)}>
          <label>
            <span>Other spellings (comma separated)</span>
            <input value={editSpellings} onChange={(e) => setEditSpellings(e.target.value)} placeholder={`${p.label} (Spouse)`} />
          </label>
          <label className="people-check">
            <input type="checkbox" checked={editIsChar} onChange={(e) => {
              setEditIsChar(e.target.checked);
              if (e.target.checked) setEditSpellings((v) => addQualified(v, p.label, p.kind, ownerLabel(editDraft)));
            }} />
            <span>This name is also a character</span>
          </label>
          {editIsChar && (
            <label>
              <span>Which one? (optional)</span>
              <input value={editShares} onChange={(e) => setEditShares(e.target.value)} placeholder="Pirates of the Caribbean" />
            </label>
          )}
          <FrameFields kind={p.kind} label={p.label} draft={editDraft} setDraft={setEditDraft} owners={ownersFor(p.id)} all={people} selfId={p.id} />
          <label>
            <span>Note (private to you; the triad can look it up by asking who someone is, it is not read out)</span>
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Who they are to you" />
          </label>
          <button type="submit" disabled={busy}>Save</button>
          {editErr && <p className="people-err" role="alert">{editErr}</p>}
        </form>
      )}
    </li>
  );

  return (
    <section className="people">
      {centre && (
        <Link href={`/map?center=graph_people:${centre.id}`} className="people-centre">
          <span className="people-centre-name">You</span>
          <span className="people-centre-sub">
            {[centre.label, ...centre.match_names, ...selves.map((s) => s.label)].join(" · ")}
          </span>
          <span className="people-count">{links(centre.mentions)} · tap to see what each of us holds</span>
        </Link>
      )}

      <form className="people-form" onSubmit={add}>
        <label>
          <span>Name</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="MemberA" required minLength={3} />
        </label>
        <label>
          <span>Other spellings (comma separated)</span>
          <input value={spellings} onChange={(e) => setSpellings(e.target.value)} placeholder="MemberA M." />
        </label>
        <label>
          <span>Who</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as Exclude<PersonKind, "centre">)}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <label className="people-check">
          <input type="checkbox" checked={isChar} onChange={(e) => {
            setIsChar(e.target.checked);
            if (e.target.checked) setSpellings((v) => addQualified(v, label, kind, ownerLabel(draft)));
          }} />
          <span>This name is also a character (show, film, book)</span>
        </label>
        {isChar && (
          <label>
            <span>Which one? (optional)</span>
            <input value={shares} onChange={(e) => setShares(e.target.value)} placeholder="Pirates of the Caribbean" />
          </label>
        )}
        <FrameFields kind={kind} label={label} draft={draft} setDraft={setDraft} owners={ownersFor(null)} all={people} selfId={null} />
        <label>
          <span>Note (private to you; the triad can look it up by asking who someone is, it is not read out)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who they are to you" />
        </label>
        <button type="submit" disabled={busy || label.trim().length < 3}>Add</button>
        {addErr && <p className="people-err" role="alert">{addErr}</p>}
      </form>
      {isChar && (
        <p className="people-hint">
          {label.trim() || "This name"} is also a character, so the bare name won&rsquo;t link (it would catch every line about {shares.trim() || "the story"}).
          Put a spelling only the person has under other spellings, like {kind === "self"
            ? <>&ldquo;{label.trim() || "Lestat"} (ours)&rdquo;</>
            : <>&ldquo;{label.trim() || "MemberF"} ({ownerLabel(draft) ?? "Spouse"})&rdquo; or &ldquo;{label.trim() || "MemberF"} ({ownerLabel(draft) ?? "Spouse"}&rsquo;s system)&rdquo;</>}.
        </p>
      )}
      {msg && <p className="people-msg" role="status">{msg}</p>}
      {warn && <p className="people-warn" role="alert">{warn}</p>}

      <h2 className="people-heading">Names that are you</h2>
      <p className="people-hint">A line that names one of these links to you, with that name kept as who was fronting. Never a separate person.</p>
      {selves.length === 0 ? <p className="h-empty">None yet.</p> : <ul className="people-list">{selves.map(row)}</ul>}

      <h2 className="people-heading">People and pets</h2>
      {others.length === 0 ? <p className="h-empty">Nobody yet.</p> : <ul className="people-list">{others.map(row)}</ul>}
    </section>
  );
}
