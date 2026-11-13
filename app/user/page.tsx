import { fetchPresence, fetchBiometrics, fetchNotes, MAX_SESSION_DEPTH } from "@/lib/halseth";
import ClientTime from "@/components/ClientTime";

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sleepBar(hours: number | null) {
  if (hours === null) return null;
  const pct = Math.min((hours / 9) * 100, 100);
  const tone = hours >= 7 ? "is-ok" : hours >= 5 ? "is-mid" : "is-low";
  return (
    <div className="h-sleep-track">
      <div className={`h-sleep-fill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function UserPage() {
  const [presence, biometrics, notes] = await Promise.allSettled([
    fetchPresence(),
    fetchBiometrics(14),
    fetchNotes(50),
  ]);

  const p = presence.status === "fulfilled" ? presence.value : null;
  const bio = biometrics.status === "fulfilled" ? biometrics.value : [];
  const allNotes = notes.status === "fulfilled" ? notes.value : [];

  const session = p?.session ?? null;
  const handover = p?.last_handover ?? null;
  const latest = bio[0] ?? null;

  // Separate notes by type
  const myNotes = allNotes.filter((n) => n.author === "principal" || n.author === "system");
  const threads = handover?.open_threads ?? [];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">You</h1>
        <p className="page-subtitle">your state, biometrics, and threads</p>
      </div>

      {/* Current state */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 className="section-title">Current State</h2>
        <div className="state-grid">
          {session ? (
            <>
              <div className="state-cell">
                <div className="state-cell-label">Fronting</div>
                <div className="state-cell-value">{session.front_state ?? "—"}</div>
              </div>
              {session.emotional_frequency && (
                <div className="state-cell">
                  <div className="state-cell-label">Frequency</div>
                  <div className="state-cell-value" style={{ fontSize: "0.85rem" }}>{session.emotional_frequency}</div>
                </div>
              )}
              {session.hrv_range && (
                <div className="state-cell">
                  <div className="state-cell-label">HRV Range</div>
                  <div className="state-cell-value">{session.hrv_range}</div>
                </div>
              )}
              {session.depth !== null && (
                <div className="state-cell">
                  <div className="state-cell-label">Depth</div>
                  <div className="state-cell-value">{session.depth} / {MAX_SESSION_DEPTH}</div>
                </div>
              )}
            </>
          ) : (
            <div className="state-cell" style={{ gridColumn: "1 / -1" }}>
              <div className="state-cell-label">Status</div>
              <div className="state-cell-value" style={{ color: "var(--h-muted)", fontSize: "0.88rem" }}>No open session</div>
            </div>
          )}

          {latest && (
            <>
              {latest.resting_hr !== null && (
                <div className="state-cell">
                  <div className="state-cell-label">Resting HR</div>
                  <div className="state-cell-value">{latest.resting_hr} bpm</div>
                </div>
              )}
              {latest.hrv_resting !== null && (
                <div className="state-cell">
                  <div className="state-cell-label">HRV</div>
                  <div className="state-cell-value">{latest.hrv_resting} ms</div>
                </div>
              )}
              {latest.steps !== null && (
                <div className="state-cell">
                  <div className="state-cell-label">Steps</div>
                  <div className="state-cell-value">{latest.steps.toLocaleString()}</div>
                </div>
              )}
              {latest.sleep_hours !== null && (
                <div className="state-cell">
                  <div className="state-cell-label">Sleep</div>
                  <div className="state-cell-value">{latest.sleep_hours}h {latest.sleep_quality ?? ""}</div>
                  {sleepBar(latest.sleep_hours)}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Open threads */}
      {threads.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 className="section-title">Open Threads (from last handover)</h2>
          <div className="threads-list">
            {threads.map((t, i) => (
              <div key={i} className="thread-entry">{t}</div>
            ))}
          </div>
        </section>
      )}

      {/* Biometric history */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 className="section-title">Biometric History (14 days)</h2>
        {bio.length === 0 ? (
          <p className="h-empty">No biometric data yet.</p>
        ) : (
          <div className="biometric-scroll">
            <div className="biometric-header">
              <span>Date</span>
              <span>Sleep</span>
              <span>HR</span>
              <span>HRV</span>
              <span>Steps</span>
              <span>Mood</span>
              <span>Energy</span>
              <span>Focus</span>
              <span>Pain</span>
              <span>Spoons</span>
              <span>Meds</span>
            </div>
            <div className="biometric-history">
              {bio.map((b) => (
                <div key={b.id} className="biometric-row">
                  <span className="date-col">{fmtDate(b.recorded_at)}</span>
                  <span className="val">{b.sleep_hours !== null ? `${b.sleep_hours}h` : "—"}</span>
                  <span className="val">{b.resting_hr !== null ? `${b.resting_hr}` : "—"}</span>
                  <span className="val">{b.hrv_resting !== null ? `${b.hrv_resting}` : "—"}</span>
                  <span className="val">{b.steps !== null ? b.steps.toLocaleString() : "—"}</span>
                  <span className="val val-text">{b.mood ?? "—"}</span>
                  <span className="val">{b.energy != null ? b.energy : "—"}</span>
                  <span className="val">{b.focus != null ? b.focus : "—"}</span>
                  <span className="val">{b.pain != null ? b.pain : "—"}</span>
                  <span className="val">{b.spoons != null ? b.spoons : "—"}</span>
                  <span className="val">{b.meds_taken != null ? (b.meds_taken ? "✓" : "✗") : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Notes / journal.
          Renders all of them, not the first 20 of up to 50 fetched: this is Principal's own notes
          page and there was no second page to reach the rest from. */}
      <section>
        <h2 className="section-title">Your Notes</h2>
        {myNotes.length === 0 ? (
          <p className="h-empty">No notes from you yet.</p>
        ) : (
          <div className="full-notes-feed">
            {myNotes.map((n) => (
              <div key={n.id} className="full-note-entry">
                <div className="note-header">
                  <span className="note-author">{n.author}</span>
                  <span className="note-type-badge">{n.note_type}</span>
                  <span className="note-time"><ClientTime iso={n.created_at} /></span>
                </div>
                <div className="note-body">{n.content}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
