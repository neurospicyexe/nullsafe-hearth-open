import type { SessionEntry, HandoverPacket } from "./halseth";
import { newestFirst } from "./time-order";

// Care and plural-state fields (hrv_range, emotional_frequency, front_state, notes, depth,
// co_con) are deliberately not carried: the Archive does not show them. facet is a companion
// facet, not a care field, so it is carried.
export type ArchiveSession = {
  id: string;
  companion: string | null;
  sessionType: string | null;
  facet: string | null;
  at: string;
  motion: string | null;
  spine: string;
  lastRealThing: string | null;
  body: { spine: string; lastRealThing: string | null; threads: string[]; anchor: string | null } | null;
};

function threadsOf(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const p: unknown = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function bodyOf(h: HandoverPacket): NonNullable<ArchiveSession["body"]> {
  return { spine: h.spine, lastRealThing: h.last_real_thing, threads: threadsOf(h.open_threads), anchor: h.active_anchor };
}

// Handovers whose session fell outside the /sessions window still show, as rows of their own.
export function joinSessions(sessions: SessionEntry[], handovers: HandoverPacket[]): ArchiveSession[] {
  const bySession = new Map<string, HandoverPacket>();
  for (const h of handovers) if (!bySession.has(h.session_id)) bySession.set(h.session_id, h);
  const known = new Set(sessions.map((s) => s.id));
  const rows = sessions.map((s): ArchiveSession => {
    const h = bySession.get(s.id);
    return {
      id: s.id,
      companion: s.companion_id,
      sessionType: s.session_type,
      facet: s.facet ?? h?.facet ?? null,
      at: s.created_at,
      motion: s.motion_state,
      spine: s.spine ?? "",
      lastRealThing: s.last_real_thing,
      body: h ? bodyOf(h) : null,
    };
  });
  for (const [sid, h] of bySession) {
    if (known.has(sid)) continue;
    rows.push({
      id: sid || h.id,
      companion: h.companion_id ?? null,
      sessionType: h.session_type,
      facet: h.facet ?? null,
      at: h.created_at,
      motion: h.motion_state,
      spine: h.spine,
      lastRealThing: h.last_real_thing,
      body: bodyOf(h),
    });
  }
  return rows.sort(newestFirst((r) => r.at));
}
