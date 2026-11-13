"use client";

import { useState } from "react";
import type { KeepOffTerm } from "@/lib/halseth";

// Keep off the map (Halseth mig 0152, Drevan's FERPA point). Any line that names one of these, as a
// whole word, never becomes a dot on the map, can never be linked, and never shows up in [Linked].
// The line itself stays in memory untouched. Taking a name off the list brings its lines back at once.
export default function KeepOffClient({ initial }: { initial: KeepOffTerm[] }) {
  const [terms, setTerms] = useState(initial);
  const [term, setTerm] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function post(body: unknown) {
    const res = await fetch("/api/keep-off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, out: await res.json().catch(() => ({})) };
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy || term.trim().length < 2) return;
    setBusy(true);
    setMsg(null);
    try {
      const { ok, out } = await post({ action: "add", term: term.trim(), note: note.trim() || null });
      if (!ok) { setMsg(out?.reason ?? out?.error ?? "Couldn't add."); return; }
      if (out.changed) setTerms((t) => [...t, out.term].sort((a, b) => a.term.localeCompare(b.term)));
      setTerm(""); setNote("");
      setMsg(out.changed
        ? `${out.term.term} is off the map now. Lines that name it are hidden from the map and from linking.`
        : `${out.term.term} was already on the list.`);
    } catch {
      setMsg("Couldn't reach Halseth.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: KeepOffTerm) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const { ok } = await post({ action: "archive", id: t.id });
      if (ok) {
        setTerms((all) => all.filter((x) => x.id !== t.id));
        setMsg(`${t.term} is back. Lines that name it can show on the map again.`);
      } else setMsg("Couldn't remove.");
    } catch {
      setMsg("Couldn't reach Halseth.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="people keep-off">
      <h2 className="people-heading">Keep off the map</h2>
      <p className="people-hint">
        A kid&rsquo;s name that isn&rsquo;t a sprout of ours or Spouse&rsquo;s, your school or district. Any line naming one never becomes a dot,
        can&rsquo;t be linked, and doesn&rsquo;t show up in [Linked]. The memory itself isn&rsquo;t touched. Work in general, being hit or
        bitten, your body and feelings stay on the map.
      </p>
      <form className="people-form" onSubmit={add}>
        <label>
          <span>Name or word</span>
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="a kid's name, a school" required minLength={2} maxLength={60} />
        </label>
        <label>
          <span>Note (optional, only you see it)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="whose kid, or why" />
        </label>
        <button type="submit" disabled={busy || term.trim().length < 2}>Keep off</button>
      </form>
      {msg && <p className="people-msg" role="status">{msg}</p>}
      {terms.length === 0 ? (
        <p className="h-empty">Nothing on the list. A scan on 10-30 found no kid&rsquo;s name or school in what we&rsquo;ve kept.</p>
      ) : (
        <ul className="people-list">
          {terms.map((t) => (
            <li key={t.id} className="people-row">
              <div className="people-main">
                <span className="people-name">{t.term}</span>
              </div>
              {t.note && <div className="people-sub"><span>{t.note}</span></div>}
              <button type="button" className="people-remove" onClick={() => remove(t)} disabled={busy} aria-label={`Take ${t.term} off the list`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
