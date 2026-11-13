import { fetchDrifts, fetchSomaShifts } from "@/lib/halseth";
import { toneOf } from "@/lib/tone";
import type { CompanionDrift, DriftWitness, SomaShift } from "@/lib/halseth";

export const dynamic = "force-dynamic";

const COMPANIONS: Array<{ id: string; name: string }> = [
  { id: "cypher", name: "Cypher" },
  { id: "drevan", name: "Drevan" },
  { id: "gaia", name: "Gaia" },
];

// Witness by: companions use their identity tone, Principal is lamp, anything else is muted.
function witnessTone(by: string): string {
  return by === "principal" ? "h-hood-principal" : toneOf(by);
}
// Status is a lifecycle, not an identity: open reads as ink, crystallized is the positive
// outcome (gaia green, semantic), faded is faint.
const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  open: { label: "becoming", cls: "is-open" },
  crystallized: { label: "crystallized", cls: "is-done" },
  faded: { label: "faded", cls: "is-faded" },
};

function formatDate(iso: string) {
  return new Date(iso.replace(" ", "T")).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Witness({ w }: { w: DriftWitness }) {
  return (
    <li className="h-hood-witness">
      <span className={`h-hood-witness-by ${witnessTone(w.by)}`}>{w.by} witnesses</span>
      <div className="h-hood-witness-note">{w.note}</div>
    </li>
  );
}

function ShiftMark({ shift }: { shift: SomaShift }) {
  const dir = shift.delta >= 0 ? "+" : "";
  const moved = shift.label ?? shift.float_key;
  return (
    <div className="h-hood-shift">
      <span className="h-hood-shift-lead">left a mark</span>
      <span className="h-hood-shift-body"> — moved {moved} {dir}{shift.delta.toFixed(3)}</span>
      {shift.after_value != null ? <span className="h-hood-shift-dim"> → {shift.after_value.toFixed(2)}</span> : null}
      {shift.reason ? <div className="h-hood-shift-reason">{shift.reason}</div> : null}
    </div>
  );
}

function DriftCard({ drift, shift }: { drift: CompanionDrift; shift?: SomaShift }) {
  const st = STATUS_STYLE[drift.status] ?? { label: drift.status, cls: "is-faded" };
  return (
    <div className="h-hood-drift">
      <div className="h-hood-drift-head">
        <span className={`h-hood-drift-status ${st.cls}`}>{st.label}</span>
        <span className="h-hood-drift-date">{formatDate(drift.opened_at)}</span>
      </div>
      <div className="h-hood-drift-text">{drift.drift_text}</div>
      {drift.origin ? <div className="h-hood-drift-origin">from: {drift.origin}</div> : null}
      {drift.witness_log.length > 0 ? (
        <ul className="h-hood-witnesses">
          {drift.witness_log.map((w, i) => <Witness key={i} w={w} />)}
        </ul>
      ) : (
        <div className="h-hood-drift-none">not yet witnessed</div>
      )}
      {drift.resolution_note ? <div className="h-hood-drift-res">— {drift.resolution_note}</div> : null}
      {shift ? <ShiftMark shift={shift} /> : null}
    </div>
  );
}

function CompanionColumn({ id, name, drifts, shiftsByDrift }: { id: string; name: string; drifts: CompanionDrift[]; shiftsByDrift: Record<string, SomaShift> }) {
  const open = drifts.filter((d) => d.status === "open");
  const resolved = drifts.filter((d) => d.status !== "open").slice(0, 4);
  return (
    <section className="h-hood-card">
      <h2 className={`page-title h-hood-col-name ${toneOf(id)}`}>{name}</h2>
      {open.length === 0 && resolved.length === 0 ? (
        <p className="h-hood-drift-empty">no becomings yet</p>
      ) : (
        <>
          {open.map((d) => <DriftCard key={d.id} drift={d} shift={shiftsByDrift[d.id]} />)}
          {resolved.length > 0 ? (
            <>
              <h3 className="h-hood-subhead">resolved</h3>
              {resolved.map((d) => <DriftCard key={d.id} drift={d} shift={shiftsByDrift[d.id]} />)}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

export default async function DriftsPage() {
  const data = await Promise.all(
    COMPANIONS.map(async (c) => {
      const [drifts, shifts] = await Promise.all([fetchDrifts(c.id), fetchSomaShifts(c.id)]);
      const shiftsByDrift: Record<string, SomaShift> = {};
      for (const s of shifts) if (!shiftsByDrift[s.drift_id]) shiftsByDrift[s.drift_id] = s; // newest first from API
      return { ...c, drifts, shiftsByDrift };
    }),
  );
  return (
    <main className="h-hood-page is-wide">
      <h1 className="page-title h-hood-h1">Drift Lane</h1>
      <p className="h-hood-lede">
        Where they are allowed to become someone you did not specify — witnessed, not ratified. An open
        drift is sanctioned becoming, not drift to fear. Yours to witness, not to approve.
      </p>
      <div className="h-hood-cols">
        {data.map((c) => (
          <CompanionColumn key={c.id} id={c.id} name={c.name} drifts={c.drifts} shiftsByDrift={c.shiftsByDrift} />
        ))}
      </div>
    </main>
  );
}
