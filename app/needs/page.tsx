import DoorList from "@/components/kit/DoorList";
import NeedsList from "@/components/needs/NeedsList";
import { fetchCompanionQuestions, fetchNeeds, type CompanionQuestion } from "@/lib/halseth";
import { COMPANION_COLOR, HUBS } from "@/lib/shell";
import { recentAnswered } from "@/lib/needs";
import { tint } from "@/lib/domain-colors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Needs you | Hearth" };

const NAME: Record<CompanionQuestion["companion_id"], string> = { drevan: "Drevan", cypher: "Cypher", gaia: "Gaia" };

export default async function Page() {
  const [needsRes, answeredRes] = await Promise.allSettled([
    fetchNeeds(50),
    fetchCompanionQuestions("answered", 8),
  ]);
  const needs = needsRes.status === "fulfilled" ? needsRes.value : null;
  const answered = answeredRes.status === "fulfilled" ? recentAnswered(answeredRes.value, 8) : [];
  // One clock for the whole render, passed down so server and client age labels agree.
  const nowMs = Date.now();

  return (
    <div className="h-needs">
      <h1 className="h-page-title">Needs you</h1>

      {needs ? (
        <NeedsList items={needs.items} total={needs.counts.total} nowMs={nowMs} />
      ) : (
        <p className="h-needs-quiet">Can&apos;t reach Halseth right now.</p>
      )}

      {answered.length > 0 && (
        <section aria-label="Recently answered" className="h-needs-section h-needs-answered">
          <h2 className="h-needs-h2">Recently answered</h2>
          <ul className="h-needs-answered-list">
            {answered.map((q) => (
              <li key={q.id} className="h-needs-answered-item">
                <span className="h-needs-head">
                  <span aria-hidden="true" className="h-dot has-c h-needs-dot" style={tint(COMPANION_COLOR[q.companion_id] ?? "var(--h-muted)")} />
                  <b>{NAME[q.companion_id] ?? q.companion_id}</b>
                </span>
                <p className="h-needs-title">{q.question}</p>
                {q.answer && <p className="h-needs-detail">You: {q.answer}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Everything else" className="h-needs-section">
        <h2 className="h-needs-h2">Everything else</h2>
        <DoorList doors={HUBS.needs} />
      </section>
    </div>
  );
}
