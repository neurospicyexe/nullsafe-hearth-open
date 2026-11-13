"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { HrvCounts, HrvBiometricSummary, DepthCounts, FreqEntry } from "./page";

interface Props {
  sessionCount:  number;
  hrvBiometrics: HrvBiometricSummary;
  hrvCounts:     HrvCounts;
  depthCounts:   DepthCounts;
  frontStates:   FreqEntry[];
  emotionWords:  FreqEntry[];
}

function fmtHrvDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Depth is ordinal: a brightness ramp on kit tokens, not four hues.
const DEPTH_COLORS = ["var(--h-faint)", "var(--h-muted)", "var(--h-ink)", "var(--h-paper)"];

const CHART_STYLE = {
  fontSize: "0.75rem",
  fill:     "var(--h-muted)",
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="home-section-card" style={{ marginBottom: "1rem" }}>
      <div className="home-section-header">
        <span className="home-section-title">{title}</span>
      </div>
      {children}
    </div>
  );
}

// Simple horizontal bar for freq tables -- no Recharts overhead for small lists
function FreqBar({ count, max }: { count: number; max: number }) {
  return (
    <div className="h-freq-track">
      <div className="h-freq-fill" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
    </div>
  );
}

export default function WellnessClient({ sessionCount, hrvBiometrics, hrvCounts, depthCounts, frontStates, emotionWords }: Props) {
  const totalHrv   = hrvCounts.reduce((s, d) => s + d.count, 0);
  const totalHrvBio = hrvBiometrics?.counts.reduce((s, d) => s + d.count, 0) ?? 0;
  const totalDepth = depthCounts.reduce((s, d) => s + d.count, 0);
  const maxFront   = frontStates[0]?.count ?? 1;
  const maxEmotion = emotionWords[0]?.count ?? 1;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Wellness</h1>
        <p className="page-subtitle">
          patterns across {sessionCount} session{sessionCount !== 1 ? "s" : ""} · last 60 days
        </p>
      </div>

      {/* HRV + Depth side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

        <SectionCard title="HRV Range">
          {hrvBiometrics && totalHrvBio > 0 ? (
            <>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", opacity: 0.55 }}>
                bands: low &lt;40ms · mid 40–60ms · high &gt;60ms
              </p>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={hrvBiometrics.counts} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={CHART_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ background: "var(--h-surface)", border: "1px solid var(--h-line)", borderRadius: "6px", fontSize: "0.8rem" }}
                    cursor={{ fill: "var(--h-line)", opacity: 0.3 }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {hrvBiometrics.counts.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {hrvBiometrics.latestValue !== null && (
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", opacity: 0.7 }}>
                  latest: {hrvBiometrics.latestValue}ms
                  {hrvBiometrics.latestDate && ` · ${fmtHrvDate(hrvBiometrics.latestDate)}`}
                </p>
              )}
              {totalHrv > 0 && (
                <p style={{ margin: "0.3rem 0 0", fontSize: "0.72rem", opacity: 0.45 }}>
                  session hrv_range: {hrvCounts.map(h => `${h.name} ${h.count}`).join(" · ")}
                </p>
              )}
            </>
          ) : (
            <p className="h-empty" style={{ margin: 0 }}>No HRV data recorded.</p>
          )}
        </SectionCard>

        <SectionCard title="Session Depth">
          {totalDepth === 0 ? (
            <p className="h-empty" style={{ margin: 0 }}>No depth data recorded — recorded at session open when a companion notes it.</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={depthCounts} barCategoryGap="30%">
                <XAxis dataKey="name" tick={CHART_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  contentStyle={{ background: "var(--h-surface)", border: "1px solid var(--h-line)", borderRadius: "6px", fontSize: "0.8rem" }}
                  cursor={{ fill: "var(--h-line)", opacity: 0.3 }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {depthCounts.map((_, i) => (
                    <Cell key={i} fill={DEPTH_COLORS[i] ?? "var(--h-muted)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Front state frequency */}
      <SectionCard title="Front State Frequency">
        {frontStates.length === 0 ? (
          <p className="h-empty" style={{ margin: 0 }}>No front state data recorded.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {frontStates.map(({ name, count }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem" }}>
                <span style={{ width: "9rem", flexShrink: 0, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
                <FreqBar count={count} max={maxFront} />
                <span style={{ opacity: 0.45, fontSize: "0.75rem", flexShrink: 0, width: "2rem", textAlign: "right" }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Emotional frequency word display */}
      <SectionCard title="Emotional Frequency">
        {emotionWords.length === 0 ? (
          <p className="h-empty" style={{ margin: 0 }}>No emotional frequency data recorded — recorded at session open when a companion notes it.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 0.75rem", lineHeight: 1.4 }}>
            {emotionWords.map(({ name, count }) => {
              const scale = 0.75 + (count / maxEmotion) * 0.85;
              const opacity = 0.4 + (count / maxEmotion) * 0.6;
              return (
                <span
                  key={name}
                  className="h-emotion-word"
                  title={`${count} session${count !== 1 ? "s" : ""}`}
                  style={{
                    fontSize:  `${scale}rem`,
                    opacity,
                    cursor:    "default",
                    fontWeight: count === maxEmotion ? 600 : 400,
                  }}
                >
                  {name}
                </span>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}
