import PersonalityCard from "@/components/PersonalityCard";
import { fetchPresence, fetchCompanionNotesByAgent, type Delta, type Wound, type CompanionNote } from "@/lib/halseth";

export const dynamic = 'force-dynamic';

async function fetchDeltas(): Promise<Delta[]> {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return [];
  try {
    const res = await fetch(`${base}/deltas?limit=10`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchWounds(): Promise<Wound[]> {
  const base = process.env.HALSETH_URL;
  const secret = process.env.HALSETH_SECRET;
  if (!base) return [];
  try {
    const res = await fetch(`${base}/wounds`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// Through the lib fetcher, not a raw fetch: it parses `tags` (raw JSON text on the wire; the
// page 500'd on `tags.map`) and passes review_state=all so drafts aren't silently hidden.
async function fetchGaiaNotes(): Promise<CompanionNote[]> {
  return fetchCompanionNotesByAgent("gaia", 20);
}

import ClientTime from "@/components/ClientTime";

// ── Emotional Landscape ───────────────────────────────────────────────────────

function EmotionalLandscape({ deltas }: { deltas: Delta[] }) {
  const counts: Record<string, number> = {};
  for (const d of deltas) {
    counts[d.valence] = (counts[d.valence] ?? 0) + 1;
  }

  const order = ["toward", "tender", "neutral", "repair", "rupture"] as const;
  const max = Math.max(...Object.values(counts), 1);

  return (
    <div className="card">
      <div className="card-title">Emotional Landscape</div>
      <div className="valence-bars">
        {order.map((v) => {
          const count = counts[v] ?? 0;
          return (
            <div key={v} className="valence-row">
              <span className="valence-label">{v}</span>
              <div className="valence-track">
                <div
                  className={`valence-fill ${v}`}
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </div>
              <span className="valence-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recent Deltas ─────────────────────────────────────────────────────────────

function RecentDeltas({ deltas }: { deltas: Delta[] }) {
  if (deltas.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Recent Moments</div>
        <p className="h-empty">No relational moments logged yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Recent Moments</div>
      <div className="delta-feed">
        {deltas.map((d) => (
          <div key={d.id} className={`delta-entry ${d.valence}`}>
            <div className="delta-text">{d.delta_text}</div>
            <div className="delta-meta">
              <span className={`valence-badge ${d.valence}`}>{d.valence}</span>
              <span className={`agent-badge ${d.agent}`}>{d.agent}</span>
              {d.initiated_by && (
                <span className="delta-time">via {d.initiated_by}</span>
              )}
              <span className="delta-time ml-auto">
                <ClientTime iso={d.created_at} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gaia Panel ────────────────────────────────────────────────────────────────

function GaiaPanel({ wounds, notes }: { wounds: Wound[]; notes: CompanionNote[] }) {
  return (
    <div className="card gaia-card">
      <div className="card-title cc-gaia">
        Gaia&rsquo;s Record
      </div>

      {wounds.length > 0 && (
        <div style={{ marginBottom: notes.length > 0 ? "0.85rem" : 0 }}>
          <div className="subsection-label">
            Living Wounds
          </div>
          {wounds.map((w) => (
            <div key={w.id} className="gaia-wound-row">
              <div className="gaia-wound-subject">{w.subject}</div>
              {w.description && <div className="gaia-wound-desc">{w.description}</div>}
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <div className="subsection-label">
            Gaia&rsquo;s Notes
          </div>
          {notes.map((n) => (
            <div
              key={n.id}
              className="companion-note-card"
            >
              <div className="companion-note-text">{n.note_text}</div>
              <div className="companion-note-meta">
                {/* tags exists on companion_notes but not on inter_companion_notes;
                    if the data source ever switches, remove this block entirely */}
                {n.tags?.map((tag) => (
                  <span key={tag} className="companion-note-tag">{tag}</span>
                ))}
                <span className="companion-note-time"><ClientTime iso={n.created_at} /></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {wounds.length === 0 && notes.length === 0 && (
        <p className="h-empty">Gaia has not written here.</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ThreadsPage() {
  const [presence, deltas, wounds, gaiaNotes] = await Promise.all([
    fetchPresence().catch(() => null),
    fetchDeltas(),
    fetchWounds(),
    fetchGaiaNotes(),
  ]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Threads</h1>
        <p className="page-subtitle">emotional landscape — relational moments and personality over time</p>
      </div>
      <EmotionalLandscape deltas={deltas} />
      <RecentDeltas deltas={deltas} />
      {presence?.personality && <PersonalityCard personality={presence.personality} />}
      <GaiaPanel wounds={wounds} notes={gaiaNotes} />
    </>
  );
}
