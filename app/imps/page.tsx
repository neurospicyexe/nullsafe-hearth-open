export const dynamic = "force-dynamic";

import { fetchImpActivity } from "@/lib/halseth";
import ClientTime from "@/components/ClientTime";
import { toneOf } from "@/lib/tone";
import { IMP_ORDER, IMP_DOES, impLabel, companionName, outingParts, agoText } from "@/lib/imps";

const WAITING_COMPANIONS = ["drevan", "cypher", "gaia"] as const;

function Who({ id }: { id: string }) {
  return <span className={toneOf(id.toLowerCase())}>{companionName(id)}</span>;
}

/** "Rock fetched for Drevan" / "Hex left a pointer for a sibling, sent by Cypher". */
function Outing({ imp, companion_id, kind, errand, withImp = true }: {
  imp: string; companion_id: string; kind: "errand" | "reply"; errand: string | null; withImp?: boolean;
}) {
  const { action, link } = outingParts({ imp, kind, errand });
  return (
    <>
      {withImp && <><span style={{ fontWeight: 500 }}>{impLabel(imp)}</span>{" "}</>}
      {action}
      {link === "sent by" ? ", sent by " : " for "}
      <Who id={companion_id} />
    </>
  );
}

export default async function ImpsPage() {
  const activity = await fetchImpActivity();
  const now = Date.now();
  const waiting = activity ? WAITING_COMPANIONS.filter((c) => (activity.waiting?.[c] ?? 0) > 0) : [];

  return (
    <main>
      <header className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Imps</h1>
        </div>
        <p className="section-row-meta">
          They run small errands the companions send them on, and nothing they find reaches you until a companion keeps it.
        </p>
      </header>

      {/* The five: what each does now, and their last outing */}
      <div className="home-section-card" style={{ marginBottom: "1.5rem" }}>
        <span className="home-section-title" style={{ display: "block", marginBottom: "0.5rem" }}>
          the five
        </span>
        {IMP_ORDER.map((key) => {
          const last = activity?.last_by_imp?.[key] ?? null;
          return (
            <div key={key} className="section-row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{impLabel(key)}</span>
                  <span className="section-row-meta" style={{ marginLeft: "0.5rem" }}>{IMP_DOES[key]}</span>
                </div>
                <span className="section-row-meta" style={{ fontSize: "0.78rem" }}>
                  {!activity ? (
                    "activity not available yet"
                  ) : last ? (
                    <>
                      last out {agoText(last.created_at, now)}:{" "}
                      <Outing imp={key} companion_id={last.companion_id} kind={last.kind} errand={last.errand} withImp={false} />
                    </>
                  ) : (
                    "hasn't been out yet"
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {activity && (
        <>
          {/* Lately */}
          <div className="home-section-card" style={{ marginBottom: "1.5rem" }}>
            <span className="home-section-title" style={{ display: "block", marginBottom: "0.5rem" }}>
              lately
            </span>
            {activity.recent.length === 0 ? (
              <span className="section-row-meta">No outings yet.</span>
            ) : (
              activity.recent.map((o, i) => (
                <div key={`${o.created_at}-${i}`} className="section-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Outing imp={o.imp} companion_id={o.companion_id} kind={o.kind} errand={o.errand} />
                  </div>
                  <span className="section-row-meta" style={{ fontSize: "0.78rem" }}>
                    {agoText(o.created_at, now)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Waiting: counts only */}
          {waiting.length > 0 && (
            <div className="home-section-card" style={{ marginBottom: "1.5rem" }}>
              <span className="home-section-title" style={{ display: "block", marginBottom: "0.5rem" }}>
                waiting
              </span>
              {waiting.map((c) => (
                <div key={c} className="section-row">
                  <span>
                    {activity.waiting[c]} waiting on <Who id={c} />&apos;s desk
                  </span>
                </div>
              ))}
              <span className="section-row-meta" style={{ display: "block", marginTop: "0.5rem" }}>
                Open findings stay with the companion until they keep them.
              </span>
            </div>
          )}

          {/* Kept: what a companion chose to surface */}
          <div className="home-section-card" style={{ marginBottom: "1.5rem" }}>
            <span className="home-section-title" style={{ display: "block", marginBottom: "0.5rem" }}>
              kept
            </span>
            {activity.kept.length === 0 ? (
              <span className="section-row-meta">Nothing kept yet.</span>
            ) : (
              activity.kept.map((k) => (
                <div key={k.id} className="section-row" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div>{k.content}</div>
                    <span className="section-row-meta" style={{ fontSize: "0.78rem" }}>
                      {impLabel(k.imp)}, kept by <Who id={k.companion_id} />
                      {k.state_at && <>, <ClientTime iso={k.state_at} /></>}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
