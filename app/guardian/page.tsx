export const dynamic = "force-dynamic";

import { fetchGuardianFlags } from "@/lib/halseth";
import type { GuardianFlag } from "@/lib/halseth";
import ClientTime from "@/components/ClientTime";
import FlagActions from "./FlagActions";
import { tint, WARN, ATTN, INK, MUTED, QUIET } from "@/lib/domain-colors";

const SEVERITY_COLOR: Record<GuardianFlag["severity"], string> = {
  red:     WARN,
  warning: ATTN,
  notice:  MUTED,
};

const STATUS_COLOR: Record<GuardianFlag["status"], string> = {
  open:         WARN,
  surfaced:     ATTN,
  acknowledged: INK,
  resolved:     QUIET,
};

const SEVERITY_ORDER: GuardianFlag["severity"][] = ["red", "warning", "notice"];

export default async function GuardianPage() {
  const [liveRes, resolvedRes] = await Promise.allSettled([
    fetchGuardianFlags("live", 50),
    fetchGuardianFlags("resolved", 10),
  ]);
  const live = liveRes.status === "fulfilled" ? liveRes.value : [];
  const resolved = resolvedRes.status === "fulfilled" ? resolvedRes.value : [];

  const bySeverity = SEVERITY_ORDER.map(sev => ({
    sev,
    flags: live.filter(f => f.severity === sev),
  })).filter(g => g.flags.length > 0);

  return (
    <main>
      <header className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Guardian</h1>
        </div>
        <p className="section-row-meta">
          Meta-observer over the self-monitoring feeds. {live.length} live flag{live.length === 1 ? "" : "s"}.
        </p>
      </header>

      {live.length === 0 && (
        <div className="home-section-card" style={{ marginBottom: "1.5rem" }}>
          <span className="section-row-meta">No live flags. The organs are feeding each other.</span>
        </div>
      )}

      {bySeverity.map(({ sev, flags }) => (
        <div key={sev} className="home-section-card" style={{ marginBottom: "1.5rem" }}>
          <span
            className="home-section-title h-cmp-tint"
            style={{ display: "block", marginBottom: "0.5rem", ...tint(SEVERITY_COLOR[sev]) }}
          >
            {sev} ({flags.length})
          </span>
          {flags.map(f => (
            <div key={f.id} className="section-row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div>{f.summary}</div>
                <span className="section-row-meta" style={{ fontSize: "0.78rem" }}>
                  {f.flag_type}
                  {f.companion_id ? ` · ${f.companion_id}` : " · system"}
                  {" · "}
                  <ClientTime iso={f.created_at} />
                </span>
              </div>
              <span
                className="section-row-meta h-cmp-tint"
                style={{ fontSize: "0.78rem", whiteSpace: "nowrap", marginRight: "0.6rem", ...tint(STATUS_COLOR[f.status]) }}
              >
                {f.status}
              </span>
              <FlagActions id={f.id} status={f.status} />
            </div>
          ))}
        </div>
      ))}

      {resolved.length > 0 && (
        <div className="home-section-card" style={{ marginBottom: "1.5rem", opacity: 0.7 }}>
          <span className="home-section-title" style={{ display: "block", marginBottom: "0.5rem" }}>
            recently resolved
          </span>
          {resolved.map(f => (
            <div key={f.id} className="section-row">
              <span className="section-row-meta">{f.summary}</span>
            </div>
          ))}
        </div>
      )}

      <p className="section-row-meta" style={{ fontSize: "0.78rem" }}>
        The Guardian is an instrument, not a judge. Cards resolve themselves when the condition clears,
        or acknowledge/resolve them right here.
      </p>
    </main>
  );
}
