import { fetchCreaturesOrNull, fetchCreature, creatureMood } from "@/lib/halseth";
import type { Creature, CreatureInteraction, CreatureDetail, NestItem, CreatureMilestone, SolGrudge } from "@/lib/halseth";
import { isMake, favouriteMake } from "@/lib/sol-hoard";
import { memberClass } from "@/lib/kit";
import ClientTime from "@/components/ClientTime";
import TendButtons from "./TendButtons";

export const dynamic = "force-dynamic";

const COMPANION_IDS = new Set(["cypher", "drevan", "gaia"]);

const MILESTONE_LABEL: Record<string, string> = {
  first_approach: "first approach",
  first_hand_feed: "first food from hand",
  chooses_to_stay: "chooses to stay",
  first_treasure: "first treasure",
  shoulder_perch: "shoulder perch",
  first_song: "first song",
  whole_sky: "the whole sky",
};

type Tone = "trust" | "quiet" | "loud" | "urgent" | "energy";

function Bar({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="h-creature-bar">
      <div className="h-creature-bar-head">
        <span>{label}{tone === "urgent" && <span className="h-creature-bar-mark" aria-label="urgent">!</span>}</span><span>{value.toFixed(2)}</span>
      </div>
      <div className="h-creature-bar-track">
        <div className={`h-creature-bar-fill is-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Drives read as needs: quiet when low, warmer as they get loud. Energy inverts
// (low energy is a roosting crow, not a starving one) so it renders as its own tone.
function driveTone(v: number): Tone {
  return v > 0.7 ? "urgent" : v > 0.45 ? "loud" : "quiet";
}

function DriveBars({ creature }: { creature: Creature }) {
  const d = creature.drives;
  if (!d) return <Bar label="restlessness" value={creature.restlessness ?? 0} tone={driveTone(creature.restlessness ?? 0)} />;
  return (
    <div>
      <Bar label="hunger" value={d.hunger} tone={driveTone(d.hunger)} />
      <Bar label="boredom" value={d.boredom} tone={driveTone(d.boredom)} />
      <Bar label="missing you" value={d.missing} tone={driveTone(d.missing)} />
      <Bar label="energy" value={d.energy} tone="energy" />
    </div>
  );
}

function activityLabel(i: CreatureInteraction): { label: string; cls: string; prefix: string } {
  if (i.actor === "sol" && i.action === "appear") {
    return { prefix: "✦", label: "appeared", cls: "is-sol" }; // Sol's own moment
  }
  if (COMPANION_IDS.has(i.actor)) return { prefix: "→", label: i.action, cls: memberClass(i.actor) };
  if (i.actor === "principal") return { prefix: "♡", label: i.action, cls: "is-principal" };
  return { prefix: "·", label: i.action, cls: "is-other" };
}

function NestSection({ nest }: { nest: NestItem[] }) {
  const kept = nest.filter(n => !n.gifted_to);
  const given = nest.filter(n => n.gifted_to).slice(0, 3);
  if (kept.length === 0 && given.length === 0) {
    return (
      <div className="h-creature-section">
        <h3 className="h-creature-h3">the nest</h3>
        <p className="h-creature-quiet">empty: he keeps what he overhears, what he&apos;s given (tend with a give), and what the triad makes</p>
      </div>
    );
  }
  const treasured = kept.filter(k => k.treasured === 1).length;
  const favourite = favouriteMake(kept);
  return (
    <div className="h-creature-section">
      <h3 className="h-creature-h3">
        the nest: {kept.length} kept{treasured > 0 ? `, ${treasured} treasured` : ""}
      </h3>
      <div className="h-creature-chips">
        {/* The count line above already says how many are kept; clipping to 12 under it made the
            rest unreachable on the page that exists to show them. */}
        {kept.map(item => {
          const style = { opacity: 0.4 + Math.min(1, Math.max(0, item.sparkle)) * 0.6 };
          const cls = `h-creature-chip${item.treasured === 1 ? " is-treasured" : ""}${isMake(item) ? " is-make" : ""}`;
          const label = <>{item.treasured === 1 ? "★ " : ""}{item.content}</>;
          // A hoarded make (B62 step 6) links to the maker's shelf: Sol keeps a reference, the
          // thing itself still lives with the one who made it.
          if (isMake(item) && item.given_by && item.ref_id) {
            return (
              <a key={item.id} href={`/companions/${encodeURIComponent(item.given_by)}/made#make-${encodeURIComponent(item.ref_id)}`}
                 title={`${item.given_by} made this, sparkle ${item.sparkle.toFixed(2)}`} className={cls} style={style}>
                {label}
              </a>
            );
          }
          return (
            <span key={item.id} title={`${item.given_by ? `from ${item.given_by}` : item.source}, sparkle ${item.sparkle.toFixed(2)}`} className={cls} style={style}>
              {label}
            </span>
          );
        })}
      </div>
      {favourite && (
        <p className="h-creature-quiet">
          his favourite of what the triad made: {favourite.content}{favourite.given_by ? ` (${favourite.given_by}'s)` : ""}
        </p>
      )}
      {given.length > 0 && (
        <ul className="h-creature-given">
          {given.map(g => (
            <li key={g.id}>
              → gave &quot;{g.content}&quot; to {g.gifted_to}{g.gifted_at && <> · <ClientTime iso={g.gifted_at} /></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MilestoneSection({ milestones, next, trust }: { milestones: CreatureMilestone[]; next: { id: string; threshold: number } | null; trust: number }) {
  if (milestones.length === 0 && !next) return null;
  return (
    <div className="h-creature-section">
      <h3 className="h-creature-h3">milestones</h3>
      <div className="h-creature-chips">
        {milestones.map(m => (
          <span
            key={m.milestone_id}
            title={`${m.text ?? ""}${m.witnessed_by ? ` (witnessed by ${m.witnessed_by})` : " (before anyone was counting)"}`}
            className="h-creature-chip is-moment"
          >
            ✦ {MILESTONE_LABEL[m.milestone_id] ?? m.milestone_id}
          </span>
        ))}
        {next && (
          <span className="h-meta">
            next: {MILESTONE_LABEL[next.id] ?? next.id} at trust {next.threshold.toFixed(2)} (now {trust.toFixed(2)})
          </span>
        )}
      </div>
    </div>
  );
}

// slug -> words: "wary-of-hands" / "dawn_feeder" read as "wary of hands" / "dawn feeder".
function slugWords(slug: string): string {
  return slug.replace(/[-_]+/g, " ").trim();
}

// Strength as 5 dots; entrenchment is 0..5 on the Halseth side, clamped so a stray value cannot break the row.
function dots(entrenchment: number): string {
  const n = Math.max(0, Math.min(5, Math.round(Number.isFinite(entrenchment) ? entrenchment : 0)));
  return "●".repeat(n) + "○".repeat(5 - n);
}

// Same names Halseth's tenderName uses for a grudge's actor; anything else is capitalized.
const GRUDGE_NAMES: Record<string, string> = { principal: "Principal", cypher: "Cypher", drevan: "Drevan", gaia: "Gaia", imp: "an imp" };

/** R29: "<label>, with <name> (<p> of <of> <unit>)"; actor and unit only when Halseth sent them. */
function grudgeLine(g: SolGrudge): string {
  const a = typeof g.actor === "string" ? g.actor.trim().toLowerCase() : "";
  const who = a ? (GRUDGE_NAMES[a] ?? a.charAt(0).toUpperCase() + a.slice(1)) : "";
  const unit = typeof g.unit === "string" && g.unit ? ` ${g.unit}` : "";
  return `${g.label}${who ? `, with ${who}` : ""} (${g.progress} of ${g.of}${unit})`;
}

function MindSection({ detail }: { detail: CreatureDetail }) {
  const forming = (detail.traits_forming ?? []).slice(0, 5);
  const quirks = detail.quirks ?? [];
  const retired = detail.quirks_retired ?? [];
  // R29: every open grudge (one per actor), each naming who it is with. An older Halseth sent only `grudge`.
  const grudges: SolGrudge[] = detail.grudges && detail.grudges.length > 0
    ? detail.grudges
    : detail.grudge ? [detail.grudge] : [];
  if (forming.length === 0 && quirks.length === 0 && retired.length === 0 && grudges.length === 0) return null;
  return (
    <>
      {forming.length > 0 && (
        <div className="h-creature-section">
          <h3 className="h-creature-h3">Forming</h3>
          <ul className="h-creature-feed">
            {forming.map(t => (
              <li key={t.slug} className="h-creature-row">
                <span className="h-creature-row-who">{slugWords(t.slug)}</span>
                <span className="h-meta" aria-label={`strength ${t.entrenchment} of 5`}>{dots(t.entrenchment)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {quirks.length > 0 && (
        <div className="h-creature-section">
          <h3 className="h-creature-h3">Quirks</h3>
          <ul className="h-creature-feed">
            {quirks.map(q => (
              <li key={q.title} className="h-creature-row">
                <span className="h-creature-row-who">
                  {q.title}{q.status === "softening" && <span className="h-meta"> (softening)</span>}
                </span>
                {q.behavior && <span className="h-creature-row-note">{q.behavior}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {grudges.length > 0 && (
        <div className="h-creature-section">
          <h3 className="h-creature-h3">Right now</h3>
          {grudges.map((g, i) => (
            <p key={`${g.actor ?? ""}-${i}`} className="h-creature-quiet">{grudgeLine(g)}</p>
          ))}
        </div>
      )}
      {retired.length > 0 && (
        <details className="h-creature-section">
          <summary className="h-creature-h3">his history</summary>
          <ul className="h-creature-feed">
            {retired.map((q, i) => (
              <li key={`${q.title}-${i}`} className="h-creature-row">
                <span className="h-creature-row-who">{q.title}</span>
                {q.behavior && <span className="h-creature-row-note">{q.behavior}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function CreatureCard({ creature, detail }: { creature: Creature; detail: CreatureDetail | null }) {
  const interactions = detail?.interactions ?? [];
  const isPet = creature.kind === "companion_pet";
  const mood = creatureMood(creature);
  const knownBest = (detail?.familiarity ?? []).filter(f => f.actor !== "principal")[0];
  return (
    <article className="h-creature">
      <div className="h-creature-head">
        <div className="h-creature-who">
          {creature.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="h-creature-avatar" src={creature.avatar_url} alt={creature.name} width={40} height={40} />
          )}
          <h2 className="h-creature-name">{creature.name}</h2>
        </div>
        <span className="h-meta">{isPet ? "system pet" : "real animal"}</span>
      </div>

      {creature.species && <p className="h-meta">{creature.species}</p>}
      <div className="h-creature-state">
        {mood && <span>mood: <strong>{mood}</strong></span>}
        {creature.disposition && <span>disposition: <strong>{creature.disposition}</strong></span>}
        {creature.state && creature.state !== "content" && <span>right now: <strong>{creature.state}</strong></span>}
        {creature.tier && <span className="h-meta">{creature.tier}</span>}
      </div>

      {creature.bio && <p className="h-creature-bio">{creature.bio}</p>}

      <Bar label="trust" value={creature.trust} tone="trust" />
      <DriveBars creature={creature} />

      {knownBest && (
        <p className="h-meta">knows {knownBest.actor} best ({knownBest.tendings} tendings)</p>
      )}

      {/* Tend in place: feed/play/talk/give as principal */}
      <TendButtons creatureId={creature.id} />

      {detail === null ? (
        <p className="h-creature-quiet is-section">
          Couldn&apos;t load the rest of this card from Halseth.
          {creature.last_interaction_at && <> Last tended <ClientTime iso={creature.last_interaction_at} />.</>}
        </p>
      ) : (
        <>
          {isPet && (
            <MilestoneSection milestones={detail.milestones ?? []} next={detail.next_milestone ?? null} trust={creature.trust} />
          )}
          {isPet && <MindSection detail={detail} />}
          {isPet && <NestSection nest={detail.nest ?? []} />}

          <div className="h-creature-section">
            <h3 className="h-creature-h3">
              recent activity
              {creature.last_interaction_at && <> · last <ClientTime iso={creature.last_interaction_at} /></>}
            </h3>
            {interactions.length === 0 ? (
              <p className="h-creature-quiet">none yet</p>
            ) : (
              <ul className="h-creature-feed">
                {interactions.map(i => {
                  const { prefix, label, cls } = activityLabel(i);
                  return (
                    <li key={i.id} className={`h-creature-row ${cls}`}>
                      <span className="h-creature-row-who">{prefix} {i.actor} {label}</span>
                      {/* Notes are the actor's own words (Sol's included): shown as written. */}
                      {i.note && <span className="h-creature-row-note">{i.note}</span>}
                      <span className="h-creature-row-at"><ClientTime iso={i.created_at} /></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </article>
  );
}

export default async function CreaturesPage() {
  const creatures = await fetchCreaturesOrNull();
  const details = creatures ? await Promise.all(creatures.map(c => fetchCreature(c.id))) : [];

  return (
    <div className="h-creatures">
      <h1 className="h-page-title">Creatures</h1>
      <p className="h-creatures-lede">
        presences who live in the system: the corvid and Principal&apos;s animals. Trust builds slowly through
        tending and cools when untended. Drives are live; the nest is what he keeps. Tend them right here.
      </p>

      {creatures === null ? (
        <p className="h-creature-quiet">Can&apos;t reach Halseth right now.</p>
      ) : creatures.length === 0 ? (
        <p className="h-creature-quiet">No creatures yet.</p>
      ) : (
        <div className="h-creatures-grid">
          {creatures.map((c, i) => {
            const detail = details[i] ?? null;
            return <CreatureCard key={c.id} creature={{ ...c, ...(detail?.creature ?? {}) }} detail={detail} />;
          })}
        </div>
      )}
    </div>
  );
}
