export const dynamic = 'force-dynamic';

import { fetchSessions, fetchBiometrics } from "@/lib/halseth";
import WellnessClient from "./WellnessClient";
import { OK, WARN, MUTED } from "@/lib/domain-colors";

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "i","is","it","as","am","are","be","been","was","were","so","my","me",
]);

export type HrvCounts     = { name: string; count: number; color: string }[];
export type DepthCounts   = { name: string; count: number }[];
export type FreqEntry     = { name: string; count: number };
export type HrvBiometricSummary = {
  counts: HrvCounts;
  latestValue: number | null;
  latestDate: string | null;
} | null;

export default async function WellnessPage() {
  const [sessions, biometrics] = await Promise.all([
    fetchSessions(60, 200),
    fetchBiometrics(60),
  ]);

  // ── HRV distribution (real HRV lands in biometric_snapshots via Apple Health,
  // NOT session fields — sessions.hrv_range has been dead since March) ────────
  const hrvSnapshots = biometrics
    .filter(b => b.hrv_resting !== null && b.hrv_resting !== undefined)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

  let hrvBiometrics: HrvBiometricSummary = null;
  if (hrvSnapshots.length > 0) {
    const bands = { low: 0, mid: 0, high: 0 };
    hrvSnapshots.forEach(b => {
      const v = b.hrv_resting as number;
      if (v < 40) bands.low++;
      else if (v <= 60) bands.mid++;
      else bands.high++;
    });
    hrvBiometrics = {
      counts: [
        { name: "low",  count: bands.low,  color: WARN },
        { name: "mid",  count: bands.mid,  color: MUTED },
        { name: "high", count: bands.high, color: OK },
      ],
      latestValue: hrvSnapshots[0].hrv_resting,
      latestDate: hrvSnapshots[0].recorded_at,
    };
  }

  // Secondary line: sessions.hrv_range (dead since March, kept in case it flows again)
  const hrv = { low: 0, mid: 0, high: 0 };
  sessions.forEach(s => {
    if (s.hrv_range === "low")  hrv.low++;
    else if (s.hrv_range === "mid")  hrv.mid++;
    else if (s.hrv_range === "high") hrv.high++;
  });
  const hrvCounts: HrvCounts = [
    { name: "low",  count: hrv.low,  color: WARN },
    { name: "mid",  count: hrv.mid,  color: MUTED },
    { name: "high", count: hrv.high, color: OK },
  ];

  // ── Depth distribution ────────────────────────────────────────────────────
  const depthMap: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
  sessions.forEach(s => {
    if (s.depth !== null && s.depth !== undefined) {
      const k = String(Math.min(3, Math.max(0, Math.round(s.depth))));
      depthMap[k] = (depthMap[k] ?? 0) + 1;
    }
  });
  const depthCounts: DepthCounts = [
    { name: "0", count: depthMap["0"] },
    { name: "1", count: depthMap["1"] },
    { name: "2", count: depthMap["2"] },
    { name: "3", count: depthMap["3"] },
  ];

  // ── Front state frequency ─────────────────────────────────────────────────
  const frontMap: Record<string, number> = {};
  sessions.forEach(s => {
    if (!s.front_state?.trim()) return;
    const key = s.front_state.trim().toLowerCase();
    frontMap[key] = (frontMap[key] ?? 0) + 1;
  });
  const frontStates: FreqEntry[] = Object.entries(frontMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ── Emotional frequency word analysis ────────────────────────────────────
  const wordMap: Record<string, number> = {};
  sessions.forEach(s => {
    if (!s.emotional_frequency) return;
    s.emotional_frequency
      .toLowerCase()
      .split(/[\s,;·\-\/+]+/)
      .map(w => w.replace(/[^a-z]/g, ""))
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
      .forEach(w => { wordMap[w] = (wordMap[w] ?? 0) + 1; });
  });
  const emotionWords: FreqEntry[] = Object.entries(wordMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return (
    <WellnessClient
      sessionCount={sessions.length}
      hrvBiometrics={hrvBiometrics}
      hrvCounts={hrvCounts}
      depthCounts={depthCounts}
      frontStates={frontStates}
      emotionWords={emotionWords}
    />
  );
}
