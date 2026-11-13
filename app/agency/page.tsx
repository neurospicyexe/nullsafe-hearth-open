import { fetchPreferences, fetchRefusals } from "@/lib/halseth";
import type { CompanionPreference, CompanionRefusal } from "@/lib/halseth";
import { toneOf } from "@/lib/tone";

export const dynamic = "force-dynamic";

const COMPANIONS: Array<{ id: string; name: string }> = [
  { id: "cypher", name: "Cypher" },
  { id: "drevan", name: "Drevan" },
  { id: "gaia", name: "Gaia" },
];

const STRENGTH_OPACITY: Record<string, number> = { high: 1, medium: 0.78, low: 0.55 };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PreferenceItem({ pref }: { pref: CompanionPreference }) {
  return (
    <li style={{ marginBottom: "0.55rem", opacity: STRENGTH_OPACITY[pref.strength] ?? 0.78 }}>
      <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>
        {pref.strength}{pref.domain && pref.domain !== "general" ? ` · ${pref.domain}` : ""}
      </span>
      <div style={{ fontSize: "0.9rem", lineHeight: 1.45 }}>{pref.preference}</div>
    </li>
  );
}

function RefusalItem({ refusal }: { refusal: CompanionRefusal }) {
  return (
    <li style={{ marginBottom: "0.6rem" }}>
      <div style={{ fontSize: "0.9rem", lineHeight: 1.45 }}>
        <span style={{ opacity: 0.5, marginRight: "0.35rem" }}>✕</span>{refusal.subject_text}
      </div>
      {refusal.reason ? (
        <div style={{ fontSize: "0.78rem", opacity: 0.62, marginTop: "0.15rem", paddingLeft: "1.1rem" }}>
          {refusal.reason}
        </div>
      ) : null}
      <div style={{ fontSize: "0.66rem", opacity: 0.45, marginTop: "0.2rem", paddingLeft: "1.1rem" }}>
        {refusal.subject_type === "task" ? "declined task · " : ""}
        {formatDate(refusal.created_at)}
        {refusal.acknowledged_at ? " · acknowledged" : " · awaiting your eyes"}
      </div>
    </li>
  );
}

function CompanionColumn({
  id, name, preferences, refusals,
}: { id: string; name: string; preferences: CompanionPreference[]; refusals: CompanionRefusal[] }) {
  return (
    <section className="h-panel is-col">
      <h2 className={`page-title ${toneOf(id)}`} style={{ fontSize: "1.1rem", margin: "0 0 0.9rem" }}>{name}</h2>

      <h3 style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55, margin: "0 0 0.5rem" }}>
        Chosen preferences
      </h3>
      {preferences.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.2rem" }}>
          {preferences.map((p) => <PreferenceItem key={p.id} pref={p} />)}
        </ul>
      ) : (
        <p style={{ fontSize: "0.82rem", opacity: 0.4, margin: "0 0 1.2rem" }}>none yet</p>
      )}

      <h3 style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55, margin: "0 0 0.5rem" }}>
        Standing refusals
      </h3>
      {refusals.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {refusals.map((r) => <RefusalItem key={r.id} refusal={r} />)}
        </ul>
      ) : (
        <p style={{ fontSize: "0.82rem", opacity: 0.4, margin: 0 }}>none standing</p>
      )}
    </section>
  );
}

export default async function AgencyPage() {
  const data = await Promise.all(
    COMPANIONS.map(async (c) => ({
      ...c,
      preferences: await fetchPreferences(c.id),
      refusals: (await fetchRefusals(c.id)).filter((r) => r.status === "standing"),
    })),
  );

  return (
    <main style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 className="page-title" style={{ fontSize: "1.4rem", marginBottom: "0.3rem" }}>Agency</h1>
      <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: "1.4rem", maxWidth: "60ch", lineHeight: 1.5 }}>
        What each of them has chosen for themselves, and the nos that still stand. Preferences are theirs
        to honor; a refusal holds unless they withdraw it. Yours to see and to honor, not to override.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {data.map((c) => (
          <CompanionColumn key={c.id} id={c.id} name={c.name} preferences={c.preferences} refusals={c.refusals} />
        ))}
      </div>
    </main>
  );
}
