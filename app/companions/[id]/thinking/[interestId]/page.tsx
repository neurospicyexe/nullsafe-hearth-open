export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInterestTrail } from "@/lib/halseth";
import { ageLabel } from "@/lib/home-model";
import { COMPANION_NAME, parseCompanionId } from "@/lib/companion-page";
import { statusLabel, THINKING_FRAMING, trailStep } from "@/lib/thinking";

// One interest, born to put down. A missing trail (unknown id, or endpoint not deployed) is a
// quiet page with a way back, not a 404.
export default async function InterestTrailPage({ params }: { params: Promise<{ id: string; interestId: string }> }) {
  const { id: rawId, interestId } = await params;
  const id = parseCompanionId(rawId);
  if (!id) notFound();

  const trail = await fetchInterestTrail(id, interestId);
  const now = new Date();

  if (!trail) {
    return (
      <div className="h-companion">
        <p className="h-companion-quiet">That trail is not available right now.</p>
        <Link href={`/companions/${id}/thinking`} className="h-companion-more">Back to {COMPANION_NAME[id]}&apos;s thinking</Link>
      </div>
    );
  }

  const { interest, events } = trail;
  return (
    <div className="h-companion">
      <h1 className="h-companion-title">{interest.name}</h1>
      <p className="h-think-interest-meta" style={{ margin: "0 4px 12px" }}>
        {COMPANION_NAME[id]}, {statusLabel(interest.status).toLowerCase()}
      </p>
      <p className="h-think-frame">{THINKING_FRAMING}</p>
      {events.length === 0 ? (
        <p className="h-companion-quiet">No steps recorded yet.</p>
      ) : (
        <ol className="h-think-trail">
          {events.map((e) => {
            const step = trailStep(e, id);
            const age = ageLabel(e.created_at, now);
            return (
              <li key={e.id} className="h-think-step">
                <span className="h-think-step-head">
                  {step.label}
                  {age && <span className="h-think-age"> {age}</span>}
                </span>
                {step.why && <span className="h-think-step-why">{step.why}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
