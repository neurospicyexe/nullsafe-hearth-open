import { parseUtc } from "@/lib/spoons";
import { newestFirst } from "@/lib/time-order";
// ── Constants ─────────────────────────────────────────────────────────────

// H10: lifted from hardcoded `/3` literals in app/page.tsx, app/user/page.tsx,
// app/wellness/page.tsx. Mirrors Brain Config.MAX_SWARM_DEPTH; keep in sync.
export const MAX_SESSION_DEPTH = 3;

// ── Base ──────────────────────────────────────────────────────────────────

function base() {
  const url = process.env.HALSETH_URL;
  if (!url) throw new Error("HALSETH_URL is not set");
  return url;
}

function authHeader(): Record<string, string> {
  const s = process.env.HALSETH_SECRET;
  return s ? { Authorization: `Bearer ${s}` } : {};
}

function fetchWithTimeout(url: string, options: RequestInit, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// H1: cache: 'no-store'. Halseth state is live (sessions, SOMA, growth);
// any revalidate window leaks stale companion mind-shape into the dashboard.
// Banned pattern from prod incident; CLAUDE.md mandates force-dynamic + no-store.
async function hGet<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${base()}${path}`, {
    headers: authHeader(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Halseth ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// Returns null on any error — for endpoints not yet deployed on Halseth
async function hGetSafe<T>(path: string): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${base()}${path}`, {
      headers: authHeader(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function hPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${base()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// PATCH counterpart to hPost. Returns null on any transport/HTTP error so callers (server
// actions) can surface a clean failure instead of throwing mid-mutation.
async function hPatch<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${base()}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export type PresenceData = {
  system: { name: string; owner: string };
  house: {
    current_room: string | null;
    companion_mood: string | null;
    companion_activity: string | null;
    spoon_count: number;
    love_meter: number;
    updated_at: string;
    autonomous_turn: "drevan" | "cypher" | "gaia" | null;
  };
  session: {
    id: string;
    front_state: string | null;
    active_anchor: string | null;
    facet: string | null;
    depth: number | null;
    hrv_range: "low" | "mid" | "high" | null;
    emotional_frequency: string | null;
    session_type: "checkin" | "hangout" | "work" | "ritual" | null;
    created_at: string;
    open: true;
  } | null;
  last_handover: {
    id: string;
    spine: string;
    last_real_thing: string | null;
    open_threads: string[];
    active_anchor: string | null;
    motion_state: "in_motion" | "at_rest" | "floating";
    facet: string | null;
    created_at: string;
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    priority: "low" | "normal" | "high" | "urgent";
    status: string;
    due_at: string | null;
    assigned_to: string | null;
  }>;
  wounds_count: number;
  recent_notes: Array<{
    id: string;
    author: string;
    content: string;
    note_type: string;
    created_at: string;
  }>;
  recent_dreams: Array<{
    id: string;
    companion_id: string;
    content: string;
    created_at: string;
  }>;
  recent_companion_notes?: Array<{
    id: string;
    agent: string;
    note_text: string;
    tags: string[];
    created_at: string;
  }>;
  latest_biometrics: {
    hrv_resting: number | null;
    resting_hr: number | null;
    sleep_hours: number | null;
    sleep_quality: string | null;
    steps: number | null;
    active_energy: number | null;
    stress_score: number | null;
    recorded_at: string;
    // Subjective ND-state layer (migration 0081)
    mood?: string | null;
    pain?: number | null;
    energy?: number | null;
    focus?: number | null;
    spoons?: number | null;
    meds_taken?: number | null;
  } | null;
  personality: {
    valence: Record<string, number>;
    initiated_by: Record<string, number>;
    total_deltas: number;
  } | null;
  companion_moods: Record<string, { emotion: string; intensity: number; at: string }> | null;
  companions: Array<{
    id: string;
    display_name: string;
    role: string;
    avatar_url: string | null;
  }>;
  recent_growth?: Array<{
    companion_id: string;
    content: string;
    entry_type: string;
    created_at: string;
  }>;
  active_patterns?: Array<{
    companion_id: string;
    pattern_text: string;
    strength: number;
  }>;
};

// ── Review state (mig 0132, 2026-09-26) ──────────────────────────────────────
// Companion speech (discord_speech / memory_judge / autonomous / vibecheck journal rows, and
// wm_continuity_notes stamped [metronome/ [discord:pulse] [discord:observation] or keyed judge:%)
// is born `draft`. Only `kept` rows are recall. Halseth's list endpoints default to kept; Hearth
// asks for `all` so the dashboard sees the tray rather than silently hiding it.

export type ReviewState = "draft" | "kept" | "dropped";

// ── Companion Notes ───────────────────────────────────────────────────────────

export type CompanionNote = {
  id: string;
  created_at: string;
  agent: "drevan" | "cypher" | "gaia";
  note_text: string;
  tags: string[] | null;
  session_id: string | null;
  review_state?: ReviewState;
  reviewed_at?: string | null;
};

// ── Bridge (partner data) ─────────────────────────────────────────────────────

export type BridgeTask = {
  id: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done";
  due_at: string | null;
};

export type BridgeEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  description: string | null;
};

export type BridgeListItem = {
  id: string;
  list_name: string;
  item_text: string;
  completed: boolean;
};

export type BridgeData = {
  system: string;
  enabled: string[];
  tasks: BridgeTask[];
  events: BridgeEvent[];
  lists: BridgeListItem[];
};

// ── Mind (knowledge graph) ────────────────────────────────────────────────────

export type MindHealth = {
  entities: number;
  observations: number;
  relations: number;
  journals: number;
  salience: Record<string, number>;
};

export type MindJournalEntry = {
  id: string;
  entry: string;
  tags: string[];
  created_at: string;
};

// ── Biometrics ────────────────────────────────────────────────────────────────

export type BiometricSnapshot = {
  id?: string;
  recorded_at: string;
  logged_at?: string;
  source?: string;
  hrv_resting: number | null;
  resting_hr: number | null;
  sleep_hours: number | null;
  sleep_quality: string | null;
  stress_score: number | null;
  steps: number | null;
  active_energy: number | null;
  notes?: string | null;
  // Subjective ND-state layer (migration 0081)
  mood?: string | null;
  pain?: number | null;        // 0-10
  energy?: number | null;      // 0-10
  focus?: number | null;       // 0-10
  spoons?: number | null;      // 0-12
  meds_taken?: number | null;  // 0/1
};

// ── Deltas ────────────────────────────────────────────────────────────────────

/** Strict form — returned by /deltas (cross-companion, v0.4 only) */
export type Delta = {
  id: string;
  session_id: string | null;
  agent: "drevan" | "cypher" | "gaia";
  delta_text: string;
  valence: "toward" | "neutral" | "tender" | "rupture" | "repair";
  initiated_by: "architect" | "companion" | "mutual" | null;
  created_at: string;
};

/** Looser form — returned by /companions/:id/deltas (may have nulls) */
export type RelationalDelta = {
  id: string;
  companion_id: string;
  session_id: string | null;
  agent: string | null;
  delta_text: string | null;
  valence: "toward" | "neutral" | "tender" | "rupture" | "repair" | null;
  initiated_by: "architect" | "companion" | "mutual" | null;
  created_at: string;
};

// ── Wounds ────────────────────────────────────────────────────────────────────

export type Wound = {
  id: string;
  name?: string;
  subject?: string;
  description: string | null;
  created_at: string;
  last_visited?: string | null;
};

/** Alias for compatibility with older pages */
export type LivingWound = Wound;

// ── Private zone types ────────────────────────────────────────────────────────

export type HandoverPacket = {
  id: string;
  session_id: string;
  created_at: string;
  spine: string;
  active_anchor: string | null;
  last_real_thing: string | null;
  open_threads: string | null; // JSON array string
  motion_state: "in_motion" | "at_rest" | "floating";
  facet: string | null;
  returned: number | null;
  session_type: string | null;
  session_front_state: string | null;
  companion_id?: string | null;
};

export type CompanionJournalEntry = {
  id: string;
  created_at: string;
  agent: "drevan" | "cypher" | "gaia";
  note_text: string;
  tags: string | null; // JSON array string
  session_id: string | null;
  source?: string | null;
  // Optional until every Halseth read path selects the column (history.ts lists columns by name).
  review_state?: ReviewState;
  reviewed_at?: string | null;
};

export type CypherAuditEntry = {
  id: string;
  session_id: string;
  created_at: string;
  entry_type:
    | "decision"
    | "contradiction"
    | "clause_update"
    | "falsification"
    | "scope_correction";
  content: string;
  verdict_tag: string | null;
  supersedes_id: string | null;
};

export type GaiaWitnessEntry = {
  id: string;
  session_id: string;
  created_at: string;
  witness_type:
    | "survival"
    | "boundary"
    | "seal"
    | "affirm"
    | "lane_enforcement";
  content: string;
  seal_phrase: string | null;
  /** Who wrote it: the companion of the row's session (Halseth 2026-11-11). The table is a SHARED
   *  survival ledger, so a row is Gaia's only when this says so. null = the session names nobody;
   *  absent = a Worker older than the field. */
  author?: string | null;
};

export type Note = {
  id: string;
  created_at: string;
  author: string;
  content: string;
  note_type: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: "urgent" | "high" | "normal" | "low";
  status: "open" | "in_progress" | "done";
  due_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  category: string | null;
};

export type ListItem = {
  id: string;
  list_name: string;
  item_text: string;
  added_by: string | null;
  added_at: string;
  completed: number;
};

// ── Fetch functions — existing endpoints ──────────────────────────────────────

export async function fetchPresence(): Promise<PresenceData> {
  return hGet<PresenceData>("/presence");
}

export async function fetchBiometrics(limit = 14): Promise<BiometricSnapshot[]> {
  return hGet<BiometricSnapshot[]>(`/biometrics?limit=${limit}`);
}

// Agency layer (halseth migration 0086): a companion's chosen preferences + standing refusals.
export interface CompanionPreference {
  id: string; companion_id: string; domain: string; preference: string;
  strength: string; status: string; created_at: string;
}
export interface CompanionRefusal {
  id: string; companion_id: string; subject_type: string; subject_ref: string | null;
  subject_text: string; reason: string | null; status: string; created_at: string;
  acknowledged_at: string | null;
}
export async function fetchPreferences(companionId: string): Promise<CompanionPreference[]> {
  return (await hGetSafe<CompanionPreference[]>(`/agency/preferences/${companionId}`)) ?? [];
}
export async function fetchRefusals(companionId: string): Promise<CompanionRefusal[]> {
  return (await hGetSafe<CompanionRefusal[]>(`/agency/refusals/${companionId}`)) ?? [];
}

// Sanctioned drift lane (halseth migration 0087): declared becoming, witnessed not ratified.
export interface DriftWitness { by: string; note: string; at: string }
export interface CompanionDrift {
  id: string; companion_id: string; drift_text: string; origin: string | null;
  status: string; witness_log: DriftWitness[]; opened_at: string;
  last_tended_at: string | null; resolved_at: string | null; resolution_note: string | null;
}
export async function fetchDrifts(companionId: string): Promise<CompanionDrift[]> {
  return (await hGetSafe<CompanionDrift[]>(`/drifts/${companionId}`)) ?? [];
}

// Emergent SOMA (mig 0089): a crystallized drift's permanent mark on one SOMA float.
export interface SomaShift {
  id: string; drift_id: string; float_key: string; label: string | null;
  delta: number; before_value: number | null; after_value: number | null;
  reason: string | null; created_at: string;
}
export async function fetchSomaShifts(companionId: string): Promise<SomaShift[]> {
  return (await hGetSafe<SomaShift[]>(`/soma/shifts/${companionId}`)) ?? [];
}

// Voice-lane telemetry (mig 0070). Bots score every reply against the companion's
// lane doctrine post-send; self_catch_rate = how often the companion (vs Principal)
// notices drift first. Renderer was deferred 06-10b -- data collected, nothing read it.
// anti_hits / contamination_hits arrive as JSON strings (toJsonOrNull at write); parse
// at the render edge, matching the GuardianFlag.evidence_json convention.
export interface VoiceScoreRow {
  score: number;
  anti_hits: string | null;
  contamination_hits: string | null;
  caught_by: string | null;
  created_at: string;
}
export interface VoiceScores {
  n: number;
  avg: number | null;
  self_catch_rate: number | null;
  self_catches: number;
  human_catches: number;
  recent: VoiceScoreRow[];
}
export async function fetchVoiceScores(companionId: string, days = 30): Promise<VoiceScores | null> {
  const r = await hGetSafe<{ scores: VoiceScores }>(
    `/mind/voice-scores/${encodeURIComponent(companionId)}?days=${days}`,
  );
  return r?.scores ?? null;
}

// Principal's outgoing letters (note_type letter:<companion>). Halseth filters server-side via
// note_type; the client-side filter is a belt for an older Halseth that ignores the param.
export async function fetchLettersOut(limit = 100, companion?: CompanionId): Promise<Note[] | null> {
  const q = new URLSearchParams({ limit: String(limit), note_type: companion ? `letter:${companion}` : "letter:*" });
  const rows = await hGetSafe<Note[]>(`/notes?${q}`);
  if (!Array.isArray(rows)) return null;
  return rows
    .filter((n) => n.author === "principal" && typeof n.note_type === "string" && n.note_type.startsWith("letter:"))
    .sort(newestFirst((n) => n.created_at));
}

export async function fetchNotes(limit = 30): Promise<Note[]> {
  return (await hGetSafe<Note[]>(`/notes?limit=${limit}`)) ?? [];
}

// Fetches per-companion deltas, filters to spec v0.4 rows (delta_text populated)
export async function fetchCompanionDeltas(
  companionId: string,
  limit = 50,
): Promise<RelationalDelta[]> {
  const raw = await hGetSafe<RelationalDelta[]>(
    `/companions/${companionId}/deltas`,
  );
  if (!raw) return [];
  return raw.filter((d) => d.delta_text !== null).slice(-limit).reverse();
}

export async function fetchBridge(): Promise<BridgeData | null> {
  return hGetSafe<BridgeData>("/bridge/shared");
}

// ── Fetch functions — endpoints awaiting Halseth deployment ──────────────────
// These return null until the endpoint exists on Halseth.

export async function fetchHandovers(
  limit = 20,
): Promise<HandoverPacket[] | null> {
  return hGetSafe<HandoverPacket[]>(`/handovers?limit=${limit}`);
}

export async function fetchCompanionJournal(
  agent?: string,
  limit = 20,
  opts: { substantive?: boolean } = {},
): Promise<CompanionJournalEntry[] | null> {
  // review_state=all: the endpoint defaults to kept (mig 0132) because it is also the Second
  // Brain puller's feed. The dashboard is Principal's window, not recall -- drafts must be visible.
  const q = new URLSearchParams({ limit: String(limit), review_state: "all" });
  if (agent) q.set("agent", agent);
  // substantive: leave out Discord speech transcripts and clerk rows (the companion page's Journal
  // door counts that lane, so the page behind it lists the same one).
  if (opts.substantive) q.set("substantive", "1");
  return hGetSafe<CompanionJournalEntry[]>(`/companion-journal?${q}`);
}

// ── Imp tray (mig 0132) ───────────────────────────────────────────────────────
// GET /admin/tray?agent=<id> -- drafts across companion_journal + wm_continuity_notes for one
// owner, plus the 30-day decision counts. Shape mirrors halseth/src/webmind/tray.ts TrayView.

export type TrayKind = "journal" | "note";

export type TrayDraft = {
  id: string;
  kind: TrayKind;
  source: string | null;
  created_at: string;
  excerpt: string;
};

export type TrayStats = {
  draft: number;
  kept: number;
  dropped: number;
  keep_rate_pct: number | null;
  window_days: number;
};

export type TrayView = {
  agent: string;
  drafts: TrayDraft[];
  stats: TrayStats;
  stats_line: string;
};

export async function fetchTray(agent: string, limit = 20): Promise<TrayView | null> {
  const q = new URLSearchParams({ agent, limit: String(limit) });
  return hGetSafe<TrayView>(`/admin/tray?${q}`);
}

export async function fetchCypherAudit(
  limit = 20,
): Promise<CypherAuditEntry[] | null> {
  return hGetSafe<CypherAuditEntry[]>(`/cypher-audit?limit=${limit}`);
}

/** The shared witness ledger, every row labelled with its author. `onlyGaia` = Gaia's own rows only:
 *  Halseth filters by session, and the client filter keeps a pre-field Worker from showing the whole
 *  ledger as hers (it then shows nothing rather than the wrong thing). */
export async function fetchGaiaWitness(
  limit = 20,
  opts: { onlyGaia?: boolean } = {},
): Promise<GaiaWitnessEntry[] | null> {
  const rows = await hGetSafe<GaiaWitnessEntry[]>(
    `/gaia-witness?limit=${limit}${opts.onlyGaia ? "&author=gaia" : ""}`,
  );
  if (!rows || !opts.onlyGaia) return rows;
  return rows.filter((r) => r.author === "gaia");
}

export async function fetchWounds(): Promise<LivingWound[] | null> {
  return hGetSafe<LivingWound[]>("/wounds");
}

export async function fetchAllDeltas(
  limit = 50,
): Promise<RelationalDelta[] | null> {
  return hGetSafe<RelationalDelta[]>(`/deltas?limit=${limit}`);
}

export async function fetchTasks(status?: string): Promise<Task[]> {
  return (await fetchTasksOrNull(status)) ?? [];
}

/** Null when Halseth could not be reached, so a caller can tell down from empty. */
export async function fetchTasksOrNull(status?: string): Promise<Task[] | null> {
  const q = status ? `?status=${status}` : "";
  return hGetSafe<Task[]>(`/tasks${q}`);
}

export async function fetchEvents(): Promise<CalendarEvent[]> {
  return (await hGetSafe<CalendarEvent[]>("/events")) ?? [];
}

export async function fetchLists(name?: string): Promise<ListItem[]> {
  const q = name ? `?name=${encodeURIComponent(name)}` : "";
  return (await hGetSafe<ListItem[]>(`/lists${q}`)) ?? [];
}

export type Dream = {
  id: string;
  companion_id: "drevan" | "cypher" | "gaia";
  dream_type: "processing" | "questioning" | "memory" | "play" | "integrating";
  content: string;
  generated_at: string;
  session_id: string | null;
};

export type DreamSeed = {
  id: string;
  created_at: string;
  content: string;
  for_companion: "drevan" | "cypher" | "gaia" | null;
  claimed_at: string | null;
  claimed_by: string | null;
};

// GET /companion-notes returns `tags` as the raw D1 JSON text ('["letter"]'), not an array.
// The type promises string[], so parse here, once: /mind and /threads crashed on
// `tags.map`, and `tags.includes("letter")` only worked as a substring match on the string.
export function parseNoteTags(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
  if (typeof raw !== "string" || !raw) return null;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((t): t is string => typeof t === "string") : null;
  } catch {
    return null;
  }
}

function normalizeNotes(rows: CompanionNote[] | null): CompanionNote[] {
  return (rows ?? []).map((n) => ({ ...n, tags: parseNoteTags(n.tags) }));
}

export async function fetchCompanionNotesByAgent(
  agent: string,
  limit = 50,
): Promise<CompanionNote[]> {
  return normalizeNotes(
    await hGetSafe<CompanionNote[]>(`/companion-notes?agent=${agent}&limit=${limit}&review_state=all`),
  );
}

export async function fetchAllCompanionNotes(limit = 50): Promise<CompanionNote[]> {
  return normalizeNotes(await hGetSafe<CompanionNote[]>(`/companion-notes?limit=${limit}&review_state=all`));
}

export type MindHandoff = {
  id: string;
  agent_id: string;
  title: string | null;
  summary: string | null;
  next_steps: string | null;
  open_loops: string | null;
  state_hint: string | null;
  created_at: string;
};

/** Null when Halseth could not be reached, so a page can tell down from empty. */
export async function fetchMindHandoffsOrNull(limit = 30): Promise<MindHandoff[] | null> {
  return hGetSafe<MindHandoff[]>(`/ingest/mind-handoffs?limit=${limit}`);
}

export async function fetchInterCompanionNotes(limit = 30): Promise<InterCompanionNote[]> {
  return (await fetchInterCompanionNotesOrNull(limit)) ?? [];
}

/** Null when Halseth could not be reached, so a caller can tell down from empty. */
export async function fetchInterCompanionNotesOrNull(limit = 30): Promise<InterCompanionNote[] | null> {
  return hGetSafe<InterCompanionNote[]>(`/ingest/inter-companion-notes?limit=${limit}`);
}

export async function fetchDreams(companionId?: string, limit = 20): Promise<Dream[]> {
  return (await fetchDreamsOrNull(companionId, limit)) ?? [];
}

/** Null when Halseth could not be reached, so a caller can tell down from empty. */
export async function fetchDreamsOrNull(companionId?: string, limit = 20): Promise<Dream[] | null> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (companionId) q.set("companion_id", companionId);
  return hGetSafe<Dream[]>(`/dreams?${q}`);
}

/** Null when Halseth could not be reached, so a page can tell down from empty. */
export async function fetchDreamSeedsOrNull(): Promise<DreamSeed[] | null> {
  return hGetSafe<DreamSeed[]>("/dream-seeds");
}

// ── Human Journal ─────────────────────────────────────────────────────────────

export type HumanJournalEntry = {
  id: string;
  created_at: string;
  entry_text: string;
  emotion_tag: string | null;
  sub_emotion: string | null;
  mood_score: number | null;
  tags: string | null; // JSON array string
};

export async function fetchHumanJournal(limit = 50): Promise<HumanJournalEntry[]> {
  return (await fetchHumanJournalOrNull(limit)) ?? [];
}

/** Null when Halseth could not be reached, so a page can tell down from empty. */
export async function fetchHumanJournalOrNull(limit = 50): Promise<HumanJournalEntry[] | null> {
  return hGetSafe<HumanJournalEntry[]>(`/journal?limit=${limit}`);
}

// ── SOMA Feelings ─────────────────────────────────────────────────────────────

export type SomaFeeling = {
  id: string;
  companion_id: string;
  session_id: string | null;
  emotion: string;
  sub_emotion: string | null;
  intensity: number; // 0-100
  source: string | null;
  created_at: string;
};

export async function fetchSomaFeelings(
  companionId?: string,
  limit = 50,
): Promise<SomaFeeling[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (companionId) q.set("companion_id", companionId);
  return (await hGetSafe<SomaFeeling[]>(`/feelings?${q}`)) ?? [];
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export type SessionEntry = {
  id: string;
  created_at: string;
  updated_at: string | null;
  companion_id: string | null;
  session_type: string | null;
  spine: string | null;
  last_real_thing: string | null;
  motion_state: string | null;
  front_state: string | null;
  co_con: string | null;
  emotional_frequency: string | null;
  active_anchor: string | null;
  facet: string | null;
  hrv_range: "low" | "mid" | "high" | null;
  depth: number | null;
  notes: string | null;
};

export async function fetchSessions(days = 30, limit = 100): Promise<SessionEntry[]> {
  return (await fetchSessionsOrNull(days, limit)) ?? [];
}

/** Null when Halseth could not be reached, so a page can tell down from empty. */
export async function fetchSessionsOrNull(days = 365, limit = 200): Promise<SessionEntry[] | null> {
  return hGetSafe<SessionEntry[]>(`/sessions?days=${days}&limit=${limit}`);
}

// ── Companion Blocks ──────────────────────────────────────────────────────────

export type CompanionBlock = {
  id: string;
  channel_id: string | null;
  block_type: string;
  content: string;
  created_at: string;
};

export async function fetchPersonaBlocks(
  companionId: string,
  limit = 20,
): Promise<CompanionBlock[]> {
  const data = await hGetSafe<{ blocks: CompanionBlock[] }>(
    `/persona-blocks?companion_id=${encodeURIComponent(companionId)}&limit=${limit}`,
  );
  return data?.blocks ?? [];
}

// ── SOMA State ────────────────────────────────────────────────────────────────

export type CompanionSomaState = {
  companion_id: string;
  soma_float_1: number | null;
  soma_float_2: number | null;
  soma_float_3: number | null;
  float_1_label: string | null;
  float_2_label: string | null;
  float_3_label: string | null;
  compound_state: string | null;
  current_mood: string | null;
  surface_emotion: string | null;
  surface_intensity: number | null;
  undercurrent_emotion: string | null;
  undercurrent_intensity: number | null;
  heat: string | null;
  reach: string | null;
  weight: string | null;
  /** When current_mood / compound_state was last set by the companion (Halseth UTC). Older than 24h reads as stale. */
  mood_set_at: string | null;
  /** Latest of mood_set_at, the companion's own journal entry and session close (ISO); null = nothing yet. Halseth mig 0153 era. */
  seen_at?: string | null;
  updated_at: string;
} | null;

export type SomaData = {
  drevan: CompanionSomaState;
  cypher: CompanionSomaState;
  gaia: CompanionSomaState;
  fetched_at: string;
};

export async function fetchSomaStates(): Promise<SomaData | null> {
  return hGetSafe<SomaData>("/soma");
}

// ── Principal inbox (letters left for him) ───────────────────────────────────────

export type InboxItem = {
  id: string;
  kind: "letter";
  agent: string;
  created_at: string;
  preview: string;
  text: string;
  read: boolean;
};

export type InboxResponse = { items: InboxItem[]; unread_count: number };

export async function fetchInbox(limit = 3, agent?: CompanionId): Promise<InboxResponse | null> {
  // agent: one companion's letters (list and unread_count), for that companion's Letters door.
  const q = new URLSearchParams({ limit: String(limit) });
  if (agent) q.set("agent", agent);
  return hGetSafe<InboxResponse>(`/principal/inbox?${q}`);
}

export async function fetchInboxItem(id: string): Promise<InboxItem | null> {
  const data = await hGetSafe<{ item: InboxItem }>("/principal/inbox/" + encodeURIComponent(id));
  return data?.item ?? null;
}

export async function fetchHumanBlocks(
  companionId: string,
  limit = 20,
): Promise<CompanionBlock[]> {
  const data = await hGetSafe<{ blocks: CompanionBlock[] }>(
    `/human-blocks?companion_id=${encodeURIComponent(companionId)}&limit=${limit}`,
  );
  return data?.blocks ?? [];
}

// ── WebMind Continuity ────────────────────────────────────────────────────────

export type WmSessionHandoff = {
  handoff_id: string;
  title: string;
  summary: string;
  next_steps: string | null;
  open_loops: string | null;
  state_hint: string | null;
  created_at: string;
};

export type WmMindThread = {
  thread_key: string;
  title: string;
  status: string;
  priority: number;
  lane: string | null;
  context: string | null;
  last_touched_at: string;
};

export type WmContinuityNote = {
  note_id: string;
  content: string;
  salience: string;
  thread_key: string | null;
  note_type: string;
  created_at: string;
};

export type WmOrientData = {
  latest_handoff: WmSessionHandoff | null;
  open_thread_count: number;
  top_threads: WmMindThread[];
  recent_notes: WmContinuityNote[];
};

// ── MindState: the one loader Hearth boots companions from ────────────────────
//
// Cutover 2026-07-29 (Phase 1, halseth/docs/mindstate-contract.md step 3: "cut over one loom at a
// time, lowest-risk first: raw /mind/orient -> bot_orient -> session_orient"). Hearth WAS the only
// consumer of raw /mind/orient, so it is the first loom, and this is that cut.
//
// Why it matters beyond tidiness: a companion's self was reconstructed by four divergent
// hand-maintained aggregators, so Drevan-on-Hearth and Drevan-on-Discord were assembled by
// different code and drifted every time an organ was added to one and not the others. Hearth now
// reads the same canonical state the other looms are moving to.
//
// Deliberately preserved: WmOrientData and CompanionOrientForChat keep their exact shapes, so
// ContinuitySection, app/phoenix/page.tsx and the chat/ritual routes need no changes. The cut is a
// swap of WHERE the state comes from, not a rewrite of what renders -- which is what makes it
// revertible in one function.
//
// Parity was proven before the swap, against prod, not assumed: 9 consumed fields x 3 companions
// = 27 checks via GET /mind/state/:id?loom=hearth&parity=1, zero mismatches.
//
// Side-effect note, stated because it is a decision and not an accident: /mind/state is a pure read
// and so (since the Q1 fix) is /mind/orient, so this changes no consume behaviour. Hearth's chat and
// ritual paths are on the pure side of the line ON PURPOSE -- a companion answering in Hearth is
// arguably a real read, but the Discord bots' unread->ack poller is what actually marks sibling mail
// read, so nothing is lost by Hearth not consuming, whereas a Hearth PAGE RENDER consuming Drevan's
// mail as Drevan destroyed it unseen. Asymmetric costs, so both go pure.

export const MINDSTATE_MAJOR = 0;

/**
 * Does this MindState payload's contract version match the major Hearth's adapters were written
 * against? Per the contract: MINOR adds blocks (renderers ignore unknown ones), MAJOR renames or
 * restructures them.
 *
 * Exported and pure so the gate is testable. It matters because the failure it prevents is silent:
 * a v1 payload read by v0 adapters yields undefined everywhere, and ContinuitySection would render
 * "No continuity data" — a lie, when the data is present under a different shape. Rejecting loudly
 * is the point; a garbled version string is also a reject, not a pass.
 */
export function isCompatibleContract(version: string | undefined | null): boolean {
  const major = Number.parseInt(String(version ?? "").split(".")[0] ?? "", 10);
  return Number.isFinite(major) && major === MINDSTATE_MAJOR;
}

/** The subset of the MindState contract Hearth reads. The contract carries far more; this types
 *  only what is consumed, so an added block cannot break the build. */
export type MindStateSlice = {
  contract_version: string;
  companion_id: string;
  identity: { anchor: { anchor_summary?: string; constraints_summary?: string } | null };
  felt: { limbic: { emotional_register?: string; drift_vector?: string } | null };
  continuity: {
    latest_handoff: WmSessionHandoff | null;
    open_thread_count: number;
    top_threads: WmMindThread[];
    surfaced_notes: WmContinuityNote[];
  };
  carried: { tensions: Array<{ tension_text: string }> };
  /** `degraded` (coherence review D11): sources that FAILED server-side during this load.
   *  Distinct from not_yet_loaded ("this loader version doesn't fill that block") -- degraded
   *  means it should have loaded and broke just now. Render it; a dead source must not pass
   *  for a quiet one. */
  meta: { not_yet_loaded: string[]; degraded?: string[] };
};

export async function fetchMindState(agentId: string): Promise<MindStateSlice | null> {
  const ms = await hGetSafe<MindStateSlice>(
    `/mind/state/${encodeURIComponent(agentId)}?loom=hearth`,
  );
  if (!ms) return null;
  // Assert major compatibility, as the contract requires. See isCompatibleContract().
  if (!isCompatibleContract(ms.contract_version)) {
    console.error(
      `[hearth] MindState contract major mismatch: got ${ms.contract_version}, expected ${MINDSTATE_MAJOR}.x. ` +
      "Hearth's adapters need updating -- refusing to render a partial self.",
    );
    return null;
  }
  return ms;
}

// Pure projection of a MindState slice onto the legacy continuity-panel shape. Pages that already
// hold the slice (companions/[id] reads it for meta.degraded) call this instead of fetchWmOrient,
// so /mind/state is fetched once per render, not twice (BUGS 2026-10-08 P3-3a).
export function wmOrientFromMindState(ms: MindStateSlice): WmOrientData {
  return {
    latest_handoff: ms.continuity.latest_handoff,
    open_thread_count: ms.continuity.open_thread_count,
    top_threads: ms.continuity.top_threads ?? [],
    // MindState splits what orient called `recent_notes` into two pools: orient's 3-pool
    // high-salience surfacing (`surfaced_notes`) and ground's wider any-salience window
    // (`continuity.recent_notes`). The legacy field was the FORMER, so that is what maps here --
    // taking the wider pool would quietly change what the continuity panel shows.
    recent_notes: ms.continuity.surfaced_notes ?? [],
  };
}

export async function fetchWmOrient(agentId: string): Promise<WmOrientData | null> {
  const ms = await fetchMindState(agentId);
  return ms ? wmOrientFromMindState(ms) : null;
}

// ── Synthesis Summaries ───────────────────────────────────────────────────────

export type SynthesisSummary = {
  id: string;
  companion_id: string | null;
  summary_type: string;
  subject: string | null;
  narrative: string | null;
  emotional_register: string | null;
  open_threads: string | null;
  created_at: string;
};

export async function fetchSynthesisSummaries(limit = 20): Promise<SynthesisSummary[]> {
  return (await fetchSynthesisSummariesOrNull(limit)) ?? [];
}

/** Null when Halseth could not be reached, so a page can tell down from empty. */
export async function fetchSynthesisSummariesOrNull(limit = 20): Promise<SynthesisSummary[] | null> {
  return hGetSafe<SynthesisSummary[]>(`/ingest/synthesis-summaries?limit=${limit}`);
}

// ── Inter-Companion Notes ─────────────────────────────────────────────────────

export type InterCompanionNote = {
  id: string;
  from_id: string;
  to_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
};

// ── WebMind: Open Loops ───────────────────────────────────────────────────────

export type OpenLoop = {
  id: string;
  companion_id: "drevan" | "cypher" | "gaia";
  loop_text: string;
  weight: number;
  opened_at: string;
  closed_at: string | null;
};

export async function fetchLoops(agentId: string, includeClosed = false): Promise<OpenLoop[]> {
  const q = includeClosed ? "?include_closed=true" : "";
  const res = await hGetSafe<{ loops: OpenLoop[] }>(`/mind/loops/${agentId}${q}`);
  return res?.loops ?? [];
}

// ── WebMind: Sitting Notes ────────────────────────────────────────────────────

export type SittingNote = {
  note_id: string;
  content: string;
  note_type: string;
  created_at: string;
  sit_text: string | null;
  sat_at: string;
};

export async function fetchSittingNotes(agentId: string): Promise<SittingNote[]> {
  const res = await hGetSafe<{ notes: SittingNote[] }>(`/mind/sitting/${agentId}`);
  return res?.notes ?? [];
}

// ── WebMind: Relational State ─────────────────────────────────────────────────

export type RelationalState = {
  id: string;
  companion_id: "drevan" | "cypher" | "gaia";
  toward: string;
  state_text: string;
  weight: number;
  state_type: "feeling" | "witness" | "held";
  noted_at: string;
};

export async function fetchRelationalHistory(agentId: string, limit = 30): Promise<RelationalState[]> {
  const res = await hGetSafe<{ states: RelationalState[] }>(`/mind/relational/${agentId}?limit=${limit}`);
  return res?.states ?? [];
}

// ── WebMind: Dreams ───────────────────────────────────────────────────────────

export type WmDream = {
  id: string;
  companion_id: string;
  dream_text: string;
  source: "autonomous" | "session";
  created_at: string;
  examined_at: string | null;
  do_not_auto_examine: number;
};

export async function fetchMindDreams(agentId: string, limit = 5): Promise<WmDream[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  const res = await hGetSafe<{ dreams: WmDream[] }>(`/mind/dreams/${encodeURIComponent(agentId)}?${q}`);
  return res?.dreams ?? [];
}

export interface CompanionOrientForChat {
  anchor_summary: string;
  constraints_summary: string;
  emotional_register: string | null;
  drift_vector: string | null;
  active_tensions: string[];
  recent_notes_summary: string;
}

// Cut over to MindState 2026-07-29 alongside fetchWmOrient -- same loader, same loom. The returned
// shape and every slice/cap below are unchanged from the orient version, so the prompts the chat and
// ritual routes build are byte-identical for identical state. Verified by prod parity on all six
// source fields x 3 companions before the swap.
export async function fetchOrientForChat(agentId: string): Promise<CompanionOrientForChat | null> {
  const ms = await fetchMindState(agentId);
  if (!ms) return null;
  return {
    anchor_summary: ms.identity.anchor?.anchor_summary ?? "",
    constraints_summary: ms.identity.anchor?.constraints_summary ?? "",
    emotional_register: ms.felt.limbic?.emotional_register ?? null,
    drift_vector: ms.felt.limbic?.drift_vector ?? null,
    active_tensions: (ms.carried.tensions ?? []).map((t) => t.tension_text).slice(0, 3),
    recent_notes_summary: (ms.continuity.surfaced_notes ?? [])
      .slice(0, 5)
      .map((n) => n.content)
      .join("\n"),
  };
}

/** Null when Halseth could not be reached, so a page can tell down from empty. */
export async function fetchCompanionDreamsOrNull(limit = 100): Promise<WmDream[] | null> {
  return hGetSafe<WmDream[]>(`/ingest/companion-dreams?${new URLSearchParams({ limit: String(limit) })}`);
}

export type CompanionTension = {
  id: string;
  companion_id: string;
  tension_text: string;
  status: string;
  first_noted_at: string;
  last_surfaced_at: string | null;
  notes: string | null;
  /**
   * How loud the tension is, 0-10. Optional because `/ingest/tensions` only began returning it on
   * 2026-08-14 and that change is not deployed yet -- treat `undefined` as "not reported", never
   * as 0. `/companion-growth/tensions/:id` (SELECT *) has always returned it.
   *
   * This is the RAW stored value. Halseth migration 0119 adds lazy charge decay at read time,
   * anchored on `COALESCE(settled_at, first_noted_at)`; while 0119 is undeployed the number here
   * is undecayed, so a small mismatch against a companion-side reading is expected, not a bug.
   */
  charge?: number | null;
};

export async function fetchTensions(companionId?: string, limit = 20): Promise<CompanionTension[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (companionId) q.set("companion_id", companionId);
  // H9: defensive envelope unwrap. Halseth GET endpoints typically return
  // `{ key: [...] }` envelopes; if upstream wraps tensions in `{ tensions: [...] }`
  // a bare cast triggers `.map is not a function`. Accept both shapes.
  const raw = await hGetSafe<CompanionTension[] | { tensions?: CompanionTension[] }>(`/ingest/tensions?${q}`);
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.tensions ?? [];
}

/**
 * Tensions for ONE companion, filtered by status, WITH charge.
 *
 * Deliberately a different endpoint from `fetchTensions` above, because it answers a different
 * question. `/ingest/tensions` is the second-brain sync feed: every status, so a change TO
 * released is carried; that is right for the memory browser and wrong for a tending surface.
 * Until 2026-08-14 it also silently IGNORED the `companion_id` it was handed and never returned
 * `charge`, which is what made Principal's settle button look dead -- it moved a number the page
 * could not fetch, on a list that showed released rows as "Active Tensions" so a release came
 * straight back on reload.
 *
 * `/companion-growth/tensions/:id` honors both filters and has always returned charge, and it is
 * already deployed, so the fix needed no worker release.
 */
export async function fetchTensionsFor(
  companionId: string,
  status: "simmering" | "crystallized" | "released" = "simmering",
): Promise<CompanionTension[]> {
  const raw = await hGetSafe<{ tensions?: CompanionTension[] } | CompanionTension[]>(
    `/companion-growth/tensions/${encodeURIComponent(companionId)}?status=${status}`,
  );
  if (!raw) return [];
  return Array.isArray(raw) ? raw : raw.tensions ?? [];
}

export type SomaticSnapshot = {
  id: string;
  companion_id: string;
  snapshot: string;
  model_used: string;
  stale_after: string;
  created_at: string;
};

export async function fetchSomaticSnapshots(companionId?: string, limit = 10): Promise<SomaticSnapshot[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (companionId) q.set("companion_id", companionId);
  return (await hGetSafe<SomaticSnapshot[]>(`/ingest/somatic-snapshots?${q}`)) ?? [];
}

export type DriftEntry = {
  id: string;
  companion_id: string;
  signal_type: string;
  context: string | null;
  detected_at: string;
};

export async function fetchDriftLog(companionId?: string, limit = 20): Promise<DriftEntry[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (companionId) q.set("companion_id", companionId);
  return (await hGetSafe<DriftEntry[]>(`/ingest/drift-log?${q}`)) ?? [];
}

export type LiveThread = {
  id: string;
  companion_id: string;
  name: string;
  flavor: string | null;
  charge: string;
  status: string;
  active_since_count: number;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
};

export async function fetchLiveThreads(companionId?: string, status = "active", limit = 20): Promise<LiveThread[]> {
  const q = new URLSearchParams({ limit: String(limit), status });
  if (companionId) q.set("companion_id", companionId);
  return (await hGetSafe<LiveThread[]>(`/ingest/live-threads?${q}`)) ?? [];
}

export type BasinHistory = {
  id: string;
  companion_id: string;
  drift_score: number;
  drift_type: string;
  caleth_confirmed: number;
  dismissed_at?: string | null;
  worst_basin: string | null;
  notes: string | null;
  recorded_at: string;
};

export async function fetchBasinHistory(companionId?: string, limit = 10): Promise<BasinHistory[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (companionId) q.set("companion_id", companionId);
  return (await hGetSafe<BasinHistory[]>(`/ingest/basin-history?${q}`)) ?? [];
}

// ── Unified Guardian (0073) ──────────────────────────────────────────────────

export type GuardianFlag = {
  id: string;
  companion_id: string | null; // null = system-wide
  flag_type: "voice_drift" | "starved_organ" | "loop_stuck" | "burnout" | "basin_pressure" | "ratification_backlog" | "orphan_memory" | "echo_chamber";
  severity: "notice" | "warning" | "red";
  summary: string;
  evidence_json: string | null;
  status: "open" | "surfaced" | "acknowledged" | "resolved";
  created_at: string;
  surfaced_at: string | null;
  resolved_at: string | null;
};

export async function fetchGuardianFlags(status = "live", limit = 50): Promise<GuardianFlag[]> {
  // Response is a { flags: [...] } envelope -- unwrap, never assume bare array
  const r = await hGetSafe<{ flags: GuardianFlag[] }>(`/mind/guardian/flags?status=${status}&limit=${limit}`);
  return r?.flags ?? [];
}

// ── Held questions (mutuality loop) ──────────────────────────────────────────
// Companions emit questions for Principal during reflect. They surface in each
// companion's orient [Held questions] block, but there was no surface that
// brought them to Principal directly -- this is it.

export type CompanionQuestion = {
  id: string;
  companion_id: "cypher" | "drevan" | "gaia";
  question: string;
  context: string | null;
  source: "autonomous" | "session" | "dialectic";
  status: "open" | "answered" | "dismissed";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

const QUESTION_COMPANIONS: CompanionQuestion["companion_id"][] = ["cypher", "drevan", "gaia"];

// Halseth exposes questions per-companion (GET /mind/questions/:id); fan out and
// merge so the dashboard shows the whole triad's backlog in one place.
export async function fetchCompanionQuestions(status = "open", limit = 20): Promise<CompanionQuestion[]> {
  const results = await Promise.all(
    QUESTION_COMPANIONS.map((id) =>
      hGetSafe<{ questions: CompanionQuestion[] }>(`/mind/questions/${id}?status=${status}&limit=${limit}`),
    ),
  );
  const merged = results.flatMap((r) => r?.questions ?? []);
  // Newest first across the merged set.
  merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return merged;
}

// ── Growth (autonomous worker artifacts) ─────────────────────────────────────

export type GrowthJournalEntry = {
  id: string;
  companion_id: string;
  entry_type: "learning" | "insight" | "connection" | "question";
  content: string;
  source: "autonomous" | "conversation" | "reflection" | null;
  tags_json: string; // JSON-encoded string[], parse with JSON.parse
  run_id: string | null;
  created_at: string;
  review_status?: "pending" | "accepted" | "declined";
  reviewed_at?: string | null;
};

export type GrowthPattern = {
  id: string;
  companion_id: string;
  pattern_text: string;
  evidence_json: string; // JSON-encoded string[], parse with JSON.parse
  strength: number; // 1–10
  run_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthMarker = {
  id: string;
  companion_id: string;
  marker_type: "milestone" | "shift" | "realization";
  description: string;
  related_pattern_id: string | null;
  run_id: string | null;
  created_at: string;
};

// ── Autonomy (autonomous worker execution) ────────────────────────────────────

export type AutonomyRun = {
  id: string;
  companion_id: string;
  run_type: "exploration" | "reflection" | "synthesis";
  status: "pending" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  tokens_used: number;
  artifacts_created: number;
  error_message: string | null;
  created_at: string;
};

export type AutonomySeed = {
  id: string;
  companion_id: string;
  seed_type: "topic" | "question" | "reflection_prompt";
  content: string;
  priority: number;
  claim_source: string | null;
  justification: string | null;
  used_at: string | null;
  created_at: string;
};

export type AutonomyThread = {
  id: string;
  title: string;
  status: "open" | "paused" | "resolved";
  last_position: number | null;
  last_run_at: string | null;
  last_entry_snippet: string | null;
};

export type AutonomyReflection = {
  id: string;
  run_id: string;
  companion_id: string;
  reflection_text: string;
  new_seeds_json: string | null; // JSON-encoded string[], parse with JSON.parse
  created_at: string;
};

// ── Growth fetch functions ────────────────────────────────────────────────────

/** Per-companion count of growth entries awaiting Principal's ratification. */
export interface GrowthPendingCount {
  total: number;
  oldest_at: string | null;
  per_companion: Array<{
    companion_id: string;
    pending: number;
    oldest_at: string;
    from_autonomous: number;
    from_reflection: number;
  }>;
}

/**
 * The ratification queue's size. Added 2026-07-27: the accept/decline surface has existed
 * at /companions/<id>/growth the whole time, but it sits three levels deep behind a tab
 * strip and nothing showed a count -- so 55 entries sat unratified, the oldest 17 days,
 * and Principal could not find where to do it. A queue nothing surfaces is a queue nobody drains.
 */
export async function fetchGrowthPendingCount(): Promise<GrowthPendingCount | null> {
  return hGetSafe<GrowthPendingCount>("/mind/growth/pending-count");
}

/**
 * Growth journal for one companion.
 *
 * `pending: true` asks Halseth for the ratification queue only (`?pending=1`), which selects on
 * `RATIFIABLE_PENDING_SQL` -- source IN (autonomous, reflection) AND review_status = 'pending'.
 * That predicate is the SAME one behind `/mind/growth/pending-count`, so the count and the list
 * agree; a count that disagrees with the surface it points at is worse than no count (2026-08-01,
 * src/lib/ratifiable.ts).
 *
 * Halseth caps `limit` at 100 per request. As of 2026-08-12 it also accepts `offset` and returns
 * `total`/`has_more`, so the cap is a PAGE size and no longer a ceiling on what is reachable. All
 * three companions sat at exactly 100 returned rows before that, which is why the old full-list
 * view could not honestly describe itself: `length >= limit` reads the same for "exactly 100
 * exist" and "hundreds do".
 */
export async function fetchGrowthJournal(
  companionId: string,
  limit = 20,
  opts: { pending?: boolean } = {},
): Promise<GrowthJournalEntry[]> {
  return (await fetchGrowthJournalPage(companionId, limit, 0, opts)).entries;
}

export interface GrowthJournalPage {
  entries: GrowthJournalEntry[];
  /** Row count on this view's predicate. `null` when Halseth predates the paging response. */
  total: number | null;
  hasMore: boolean;
  offset: number;
}

/**
 * One page of the growth journal, with the count for the view it belongs to.
 *
 * Degrades on a Halseth that has not been redeployed yet: `total` stays null and `hasMore` falls
 * back to the full-page inference. The page then says "at least N" instead of naming a number,
 * which is the honest form of not knowing -- never a fabricated total.
 */
export async function fetchGrowthJournalPage(
  companionId: string,
  limit: number,
  offset: number,
  opts: { pending?: boolean } = {},
): Promise<GrowthJournalPage> {
  const qs = `limit=${limit}&offset=${offset}${opts.pending ? "&pending=1" : ""}`;
  const res = await hGetSafe<{
    journal: GrowthJournalEntry[];
    total?: number;
    has_more?: boolean;
  }>(`/mind/growth/journal/${companionId}?${qs}`);

  const entries = res?.journal ?? [];
  const total = typeof res?.total === "number" ? res.total : null;
  return {
    entries,
    total,
    hasMore: typeof res?.has_more === "boolean" ? res.has_more : entries.length >= limit,
    offset,
  };
}

export async function fetchGrowthPatterns(
  companionId: string,
): Promise<GrowthPattern[]> {
  const res = await hGetSafe<{ patterns: GrowthPattern[] }>(
    `/mind/growth/patterns/${companionId}`,
  );
  return res?.patterns ?? [];
}

export async function fetchGrowthMarkers(
  companionId: string,
): Promise<GrowthMarker[]> {
  const res = await hGetSafe<{ markers: GrowthMarker[] }>(
    `/mind/growth/markers/${companionId}`,
  );
  return res?.markers ?? [];
}

// ── Autonomy fetch functions ──────────────────────────────────────────────────

export async function fetchAutonomyRuns(
  companionId: string,
  limit = 20,
): Promise<AutonomyRun[]> {
  const res = await hGetSafe<{ runs: AutonomyRun[] }>(
    `/mind/autonomy/runs/${companionId}?limit=${limit}`,
  );
  return res?.runs ?? [];
}

export async function fetchAutonomySeeds(
  companionId: string,
  includeUsed = false,
): Promise<AutonomySeed[]> {
  // includeUsed surfaces consumed seeds too (manage surface: see-what-ran + re-enable).
  const res = await hGetSafe<{ seeds: AutonomySeed[] }>(
    `/mind/autonomy/seeds/${companionId}${includeUsed ? "?include_used=1" : ""}`,
  );
  return res?.seeds ?? [];
}

export async function fetchAutonomyThreads(
  companionId: string,
): Promise<AutonomyThread[]> {
  const res = await hGetSafe<{ threads: AutonomyThread[] }>(
    `/mind/autonomy/threads/${companionId}`,
  );
  return res?.threads ?? [];
}

export async function fetchAutonomyReflections(
  companionId: string,
  limit = 10,
): Promise<AutonomyReflection[]> {
  const res = await hGetSafe<{ reflections: AutonomyReflection[] }>(
    `/mind/autonomy/reflections/${companionId}?limit=${limit}`,
  );
  return res?.reflections ?? [];
}

// ── Worldview (companion conclusions) ────────────────────────────────────────

export type ConclusionRow = {
  id: string;
  companion_id: string;
  conclusion_text: string;
  source_sessions: string | null;
  superseded_by: string | null;
  created_at: string;
  edited_at: string | null;
  confidence: number;
  belief_type: string;
  subject: string | null;
  provenance: string | null;
  contradiction_flagged: number;
  /** mig 0148: set when a companion or Principal pinned it; absent on Workers older than map M3. */
  pinned_at?: string | null;
  pinned_by?: string | null;
};

// Uses cache: "no-store" directly — conclusions are live state, never revalidate
export type SbSearchLog = {
  agent_id: string;
  entries: Array<{ query: string; hit_count: number; source: string; created_at: string }>;
  total: number;
  hits: number;
  hit_rate: number | null;
  last_query: string | null;
};

export async function fetchSbSearchLog(agentId: string): Promise<SbSearchLog | null> {
  return hGetSafe<SbSearchLog>(`/mind/sb-search-log/${agentId}`);
}

export type OrientDebug = {
  assembled_at: string;
  session_id: string;
  front_state: string;
  wm: {
    recent_notes: number;
    open_thread_count: number;
    active_tensions: number;
    active_conclusions: number;
    incoming_companion_notes: number;
    latest_handoff_summary: string | null;
  } | null;
  sb_rag: { query: string; hit_count: number };
  sb_narrative: "loaded" | "none";
  growth: { journal_entries: number; patterns: number; last_reflection: number; available_seeds: number };
};

export async function fetchOrientDebug(agentId: string): Promise<OrientDebug | null> {
  return hGetSafe<{ agent_id: string; debug: OrientDebug | null }>(`/mind/orient-debug/${agentId}`)
    .then(r => r?.debug ?? null);
}

// ── Metronome Actions ─────────────────────────────────────────────────────────

export type MetronomeAction = {
  id: string;
  companion_id: string;
  name: string;
  action_type: string;
  target: string | null;
  prompt: string | null;
  quiet_hours_allowed: number;
  status: "on" | "off";
  silence_min_hours: number | null;
  silence_max_hours: number | null;
  max_per_day: number | null;
  cooldown_hours: number | null;
  requires_signal: string | null;
  signal_lookback_hours: number | null;
  last_fired_at: string | null;
  fire_count_today: number;
  fire_count_reset_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchMetronomeActions(companionId: string): Promise<MetronomeAction[]> {
  const res = await hGetSafe<{ actions: MetronomeAction[] }>(
    `/mind/metronome/actions/${encodeURIComponent(companionId)}`,
  );
  return res?.actions ?? [];
}

export async function fetchConclusions(agentId: string): Promise<ConclusionRow[]> {
  // Worker registers GET /companion-conclusions/:agent_id (path param). The old
  // ?agent_id= query form matched no route -> 404 -> permanently empty conclusions
  // blocks on the worldview + companion-detail pages. (liveness review 2026-06-22)
  const res = await hGetSafe<{ conclusions?: ConclusionRow[] }>(
    `/companion-conclusions/${encodeURIComponent(agentId)}`,
  );
  return res?.conclusions ?? [];
}

// ── The Club (migration 0072) ────────────────────────────────────────────────

export type ClubRound = {
  id: string;
  status: "gathering" | "voting" | "active" | "discussing" | "closed";
  winning_recommendation_id: string | null;
  opened_at: string;
  activated_at: string | null;
  discussing_at: string | null;
  closed_at: string | null;
};

export type ClubRecommendation = {
  id: string;
  round_id: string;
  media_kind: string;
  title: string;
  creator: string | null;
  url: string | null;
  source_ref: string | null;
  recommended_by: string;
  pitch: string | null;
  created_at: string;
};

export type ClubVote = {
  round_id: string;
  recommendation_id: string;
  voter: string;
  reason: string | null;
  created_at: string;
};

export type ClubDiscussion = {
  id: string;
  round_id: string;
  companion_id: string;
  reflection: string;
  created_at: string;
};

// 0099: an abstention is a companion whose autonomous vote failed after retry.
// Honest record of a vote that couldn't land — not a choice to sit out.
export type ClubAbstention = {
  round_id: string;
  voter: string;
  reason: string | null;
  created_at: string;
};

export type ClubCurrent = {
  round: ClubRound | null;
  recommendations: ClubRecommendation[];
  votes: ClubVote[];
  discussions: ClubDiscussion[];
  abstentions: ClubAbstention[];
};

export type ClubRoundDetail = ClubRound & {
  winner_title: string | null;
  recommendations: ClubRecommendation[];
  votes: ClubVote[];
  discussions: ClubDiscussion[];
  abstentions: ClubAbstention[];
};

export async function fetchClubCurrent(): Promise<ClubCurrent | null> {
  return await hGetSafe<ClubCurrent>("/mind/club/current");
}

export async function fetchClubRounds(limit = 10): Promise<ClubRoundDetail[]> {
  const res = await hGetSafe<{ rounds?: ClubRoundDetail[] }>(`/mind/club/rounds?limit=${limit}`);
  return res?.rounds ?? [];
}

// ── Hearth write layer (0092): the async wall (global /log, club + shelf threads) ──
export type CommonsPost = {
  id: string;
  author: string;            // principal | cypher | drevan | gaia
  context: string;           // global | club:<round_id> | shelf:<obsession_id>
  body: string;
  reply_to: string | null;   // links a reply to the post it answers
  created_at: string;
};

/** Posts in one context, newest first (default the global log). Graceful [] on error. */
export async function fetchCommonsPosts(context = "global", limit = 50): Promise<CommonsPost[]> {
  return (await fetchCommonsPostsOrNull(context, limit)) ?? [];
}

/** As fetchCommonsPosts, but null when Halseth cannot be read, so a page can tell failure from empty. */
export async function fetchCommonsPostsOrNull(context = "global", limit = 50): Promise<CommonsPost[] | null> {
  const res = await hGetSafe<{ posts?: CommonsPost[] }>(
    `/mind/commons?context=${encodeURIComponent(context)}&limit=${limit}`,
  );
  return res ? (res.posts ?? []) : null;
}

// ── Obsession shelf (0094): "what Principal's into"; triad reacts via commons (shelf:<id>) ──
export type Obsession = {
  id: string;
  title: string;
  kind: string;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function fetchObsessions(status = "active"): Promise<Obsession[]> {
  return (await fetchObsessionsOrNull(status)) ?? [];
}

/** As fetchObsessions, but null when Halseth cannot be read, so the shelf can tell failure from empty. */
export async function fetchObsessionsOrNull(status = "active"): Promise<Obsession[] | null> {
  const res = await hGetSafe<{ items?: Obsession[] }>(`/mind/shelf?status=${encodeURIComponent(status)}`);
  return res ? (res.items ?? []) : null;
}

// ── The Library (0099): shared books — Principal reads, the triad writes in the margins ──

export type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  language: string | null;
  file_type: "epub" | "pdf";
  file_size: number;
  cover_key: string | null;
  vault_ref: string | null;
  added_at: string;
  progress_percent: number | null;
  current_chapter: string | null;
  finished_at: string | null;
  last_read_at: string | null;
  annotation_count: number;
};

export type BookProgress = {
  current_cfi: string | null;
  current_chapter: string | null;
  progress_percent: number | null;
  finished_at: string | null;
};

export type BookAnnotation = {
  id: string;
  book_id: string;
  author: "principal" | "cypher" | "drevan" | "gaia";
  cfi_range: string | null;      // null for companion marginalia — panel-only, no anchor in the text
  selected_text: string | null;
  comment: string | null;
  color: string | null;
  created_at: string;
};

export type BookDetail = {
  book: Book;
  progress: BookProgress | null;
  annotations: BookAnnotation[];
};

/** null when Halseth could not be reached; [] only when it answered with no books. */
export async function fetchBooksOrNull(search?: string, limit = 100): Promise<Book[] | null> {
  const q = search ? `&search=${encodeURIComponent(search)}` : "";
  const res = await hGetSafe<{ books?: Book[] }>(`/mind/books?limit=${limit}${q}`);
  if (!res) return null;
  return res.books ?? [];
}

export async function fetchBooks(search?: string, limit = 100): Promise<Book[]> {
  return (await fetchBooksOrNull(search, limit)) ?? [];
}

export async function fetchBook(id: string): Promise<BookDetail | null> {
  return await hGetSafe<BookDetail>(`/mind/books/${encodeURIComponent(id)}`);
}

// ── Companion tools (0077, take 14): generated-image gallery + tool-call log ──
export type ToolCall = {
  id: string;
  companion_id: string;
  tool: string;            // web_search | generate_image
  args_summary: string;
  status: string;          // success | error | denied
  provider: string | null;
  result_ref: string | null;
  result_summary: string | null;
  created_at: string;
};

/** Generated images for one companion (audit rows where tool=generate_image, status=success). */
export async function fetchToolImages(companionId: string, limit = 40): Promise<ToolCall[]> {
  const res = await hGetSafe<{ calls?: ToolCall[] }>(
    `/mind/tools/calls/${companionId}?tool=generate_image&limit=${limit}`,
  );
  return (res?.calls ?? []).filter(c => c.status === "success" && c.result_ref);
}

/** As fetchToolImages, but null when Halseth could not be read, so a page can tell "down" from "none". */
export async function fetchCompanionImages(companionId: CompanionId, limit = 40): Promise<ToolCall[] | null> {
  const res = await hGetSafe<{ calls?: ToolCall[] }>(
    `/mind/tools/calls/${companionId}?tool=generate_image&limit=${limit}`,
  );
  if (!Array.isArray(res?.calls)) return null;
  return res.calls.filter(c => c.status === "success" && c.result_ref);
}

// ── Makes (B62): what the companions made, as files Principal can download ──
export type MakeKind =
  | "writing" | "page" | "music_code" | "drawing" | "scad" | "music_audio" | "video" | "image";
export type MakeStatus = "pending" | "ready" | "failed";
export type MakeFile = { mime?: string; ext?: string };
export type Make = {
  id: string;                    // 32 hex, or img_<callId> for an old generate_image row
  kind: MakeKind;
  title: string;
  why: string | null;            // null when the companion kept it private
  interest_name: string | null;
  status: MakeStatus;
  fail_reason?: string | null;   // not in the contract's list shape; shown when Halseth sends it
  heard_back: string | null;
  version: number;
  parent_id: string | null;
  created_at: string;
  files: { source?: MakeFile; file?: MakeFile; preview?: MakeFile };
  /** The recipe a model was handed (music_audio / video). Null or absent for code kinds, images, older Halseth. */
  params?: Record<string, unknown> | null;
  /** Where a captured writing came from (mig 0170): a letter, a night exploration, or a piece the
   *  companion kept by hand. Null / absent for things made with the make verb, and on older Halseth. */
  origin_kind?: "letter" | "exploration" | "kept" | null;
};

/** The shelf for one companion, newest first. Null when Halseth could not be read. */
export async function fetchCompanionMakes(companionId: CompanionId, limit = 40): Promise<Make[] | null> {
  const res = await hGetSafe<{ makes?: Make[] }>(`/mind/makes/${companionId}?limit=${limit}`);
  return Array.isArray(res?.makes) ? res.makes : null;
}

export type GardenPlanting = {
  id: string;
  kind: "letter" | "note" | "kept_line" | "interest_line";
  planted_at: string;
  written_at: string;
  text: string;
  to: "principal" | "triad" | "cypher" | "drevan" | null;
  interest_name: string | null;
};
export type GardenWitnessDay = { day: string; entries: { id: string; at: string; type: string; text: string }[] };
export type GardenData = {
  planted: GardenPlanting[];
  witness: null | { planted_at: string; days: GardenWitnessDay[] };
  resting: number;
  awaiting: number;
};

/** Gaia's garden. Null when Halseth cannot be read or does not have the route yet (404). */
export async function fetchGaiaGarden(): Promise<GardenData | null> {
  const res = await hGetSafe<Partial<GardenData>>("/mind/garden/gaia");
  if (!res || !Array.isArray(res.planted)) return null;
  return {
    planted: res.planted,
    witness: res.witness ?? null,
    resting: typeof res.resting === "number" ? res.resting : 0,
    awaiting: typeof res.awaiting === "number" ? res.awaiting : 0,
  };
}

export type BasinLine = {
  id: string;
  name: string;
  status: "live" | "awaiting_witness" | "superseded" | "declined";
  created_at: string;
  cause_kind: string | null;
  cause_ref: string | null;
  revised_by: string | null;
  witnessed_by: string | null;
  witnessed_at: string | null;
  supersedes: string | null;
  superseded_by: string | null;
  superseded_at: string | null;
  revision_note: string | null;
  description?: string;
};
export type BasinsData = { companion_id: string; live: BasinLine[]; history: BasinLine[]; waiting: number; pace_days: number; window_opens: string | null };

/** A companion's basins (mig 0172): live rows plus every superseded / declined / awaiting row. Null when unreadable or not deployed. */
export async function fetchBasins(companionId: string): Promise<BasinsData | null> {
  const res = await hGetSafe<Partial<BasinsData>>(`/mind/basins/${companionId}`);
  if (!res || !Array.isArray(res.live) || !Array.isArray(res.history)) return null;
  return {
    companion_id: companionId,
    live: res.live,
    history: res.history,
    waiting: typeof res.waiting === "number" ? res.waiting : 0,
    pace_days: typeof res.pace_days === "number" ? res.pace_days : 0,
    window_opens: res.window_opens ?? null,
  };
}

const MAKE_SOURCE_CAP = 70_000; // Halseth rejects sources over 64 KB; a little slack, never a stream of megabytes

/** The raw source text of a writing / page / music_code make, for the card. Null on any failure. */
export async function fetchMakeSource(id: string): Promise<string | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  try {
    const res = await fetchWithTimeout(`${base()}/mind/makes/file/${id}/source`, {
      headers: authHeader(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, MAKE_SOURCE_CAP);
  } catch {
    return null;
  }
}

// ── Creatures (0078, take 10): corvid + Principal's animals as named presences ──
export type Creature = {
  id: string;
  name: string;
  species: string | null;
  kind: string;            // companion_pet | real_animal
  owner: string;
  bio: string | null;
  state_json: string | null;
  trust: number;
  last_interaction_at: string | null;
  created_at: string;
  avatar_url: string | null;
  // Added by Sol feature (task 7): disposition from creature state + restlessness float (0-1)
  disposition: string;
  restlessness: number;
  // Inner life (0100): lazy-derived drives, dominant state, trust tier
  drives?: { hunger: number; boredom: number; missing: number; energy: number };
  state?: string;   // sleepy | hungry | missing | bored | content
  tier?: string;    // abandoned | wary | cautious | warming | bonded | devoted
};

export type CreatureInteraction = {
  id: string;
  actor: string;
  action: string;
  note: string | null;
  created_at: string;
};

// Inner life (0100)
export type CreatureMilestone = {
  milestone_id: string;
  fired_at: string;
  witnessed_by: string | null;
  text: string | null;
};

export type NestItem = {
  id: string;
  content: string;
  source: string;            // gift | overheard:house | make
  given_by: string | null;
  sparkle: number;
  treasured: number;         // 0 | 1
  gifted_to: string | null;
  gifted_at: string | null;
  created_at: string;
  /** mig 0166 (B62 step 6): a hoarded make is a reference; given_by = the maker. Absent pre-0166. */
  ref_type?: string | null;
  ref_id?: string | null;
};

export type CreatureFamiliarity = { actor: string; tendings: number; last_at: string };

export async function fetchCreatures(): Promise<Creature[]> {
  return (await fetchCreaturesOrNull()) ?? [];
}

/** As fetchCreatures, but null when Halseth cannot be read, so the page can tell failure from empty. */
export async function fetchCreaturesOrNull(): Promise<Creature[] | null> {
  const res = await hGetSafe<{ creatures?: Creature[] }>("/mind/creatures");
  return res ? (res.creatures ?? []) : null;
}

export type CreatureDetail = {
  creature: Creature;
  interactions: CreatureInteraction[];
  milestones?: CreatureMilestone[];
  next_milestone?: { id: string; threshold: number } | null;
  nest?: NestItem[];
  familiarity?: CreatureFamiliarity[];
  // B64 Sol's mind (halseth handlers/creatures.ts MindView). Optional: an older Halseth omits them.
  traits_forming?: SolTraitForming[];
  quirks?: SolQuirk[];
  quirks_retired?: Array<{ title: string; behavior: string | null }>;
  grudge?: SolGrudge | null;
  grudges?: SolGrudge[];
};

export type SolTraitForming = { slug: string; category: string | null; entrenchment: number };
export type SolQuirk = { title: string; behavior: string | null; status: string };
export type SolGrudge = { actor: string; label: string; progress: number; of: number; unit?: string };  // R29: visits | gives | feeds | hours (absent on an older Halseth)

export async function fetchCreature(id: string): Promise<CreatureDetail | null> {
  return await hGetSafe<CreatureDetail>(`/mind/creatures/${encodeURIComponent(id)}`);
}

// Fermentation layer (0101) -- floats that ferment between sessions + drifting baselines (growth).
export type FermentFloat = {
  label: string;
  value: number | null;
  baseline: number | null;
  seed: number | null;
};

export type FermentDrive = {
  drive_key: string;
  level: number;
  threshold: number;
  fired: boolean;
};

export type FermentEvent = {
  id: string;
  kind: string;                 // stimulus | tick | baseline_drift
  stimulus: string | null;
  float_deltas: string | null;  // JSON string {f1,f2,f3}
  drive_deltas: string | null;  // JSON string
  detail: string | null;
  created_at: string;
};

// SOMA provenance (graph memory phase 2): the last few moves behind each felt float,
// newest first, at most 3 per float. May be absent/empty on older or failed responses.
export type SomaFloatKey = "soma_float_1" | "soma_float_2" | "soma_float_3";
export type SomaEventKind = "authored_close" | "authored_update" | "tick" | "stimulus" | "drift_shift";

export type SomaProvenanceEntry = {
  float_key: SomaFloatKey;
  label: string;
  kind: SomaEventKind;
  writer: string;
  before_value: number | null;
  after_value: number | null;
  delta: number | null;
  cause_table: string | null;
  cause_id: string | null;
  cause_label: string | null;
  session_id: string | null;
  alongside_notes: number;
  detail?: string | null;
  created_at: string;
};

export type Fermentation = {
  companion_id: string;
  floats: FermentFloat[];
  compound_state: string | null;
  ferment_at: string | null;
  drives: FermentDrive[];
  recent_events: FermentEvent[];
  provenance?: SomaProvenanceEntry[];
};

export async function fetchFermentation(id: string): Promise<Fermentation | null> {
  return await hGetSafe<Fermentation>(`/mind/ferment/${encodeURIComponent(id)}`);
}

/** Mood label off a creature's state_json (best-effort; null if absent/malformed). */
export function creatureMood(c: Creature): string | null {
  if (!c.state_json) return null;
  try {
    return (JSON.parse(c.state_json) as { mood?: string }).mood ?? null;
  } catch {
    return null;
  }
}

// ── Collection / sparkle (0079, take 13): emotional archaeology over what's gathered ──
export type CollectionForageItem = {
  id: string;
  title: string;
  domain: string;
  summary: string;
  source_url: string | null;
  consumed_at: string | null;
  gathered_at: string;
  sparkle: number;
};

export type CollectionListenItem = {
  id: string;
  title: string;
  artist: string | null;
  media_type: string;
  created_at: string;
  sparkle: number;
};

export type CollectionData = { forage: CollectionForageItem[]; listens: CollectionListenItem[] };

/** As fetchCollection, but null when Halseth could not be read, so a page can tell "down" from "none". */
export async function fetchCollectionOrNull(companionId: string, limit = 30): Promise<CollectionData | null> {
  const res = await hGetSafe<{ forage?: CollectionForageItem[]; listens?: CollectionListenItem[] }>(
    `/mind/collection/${encodeURIComponent(companionId)}?limit=${limit}`,
  );
  return res ? { forage: res.forage ?? [], listens: res.listens ?? [] } : null;
}

export async function fetchCollection(companionId: string, limit = 30): Promise<CollectionData> {
  return (await fetchCollectionOrNull(companionId, limit)) ?? { forage: [], listens: [] };
}

// ── The Home (rooms + presence + basin readings) ──
export type HomeRoom = {
  key: string;
  name: string;
  sym: string;
  register: string;
  primary_lane: string | null;
  gradient?: string;
};

export type HomePresence = {
  companion_id: string;
  current_room: string;
  activity: string;
  micro_mood: string | null;
  basin_distance: number;
  updated_at: string;
};

export type HomeBasinReading = {
  drift_score: number;
  drift_type: "stable" | "growth" | "pressure";
  worst_basin: string | null;
  recorded_at: string;
};

/** Rooms and who is in them; null when Halseth could not be read. */
export async function fetchHomePresence(): Promise<{ presence: HomePresence[]; rooms: HomeRoom[] } | null> {
  const res = await hGetSafe<{ presence?: HomePresence[]; rooms?: HomeRoom[] }>("/home/presence");
  return res ? { presence: res.presence ?? [], rooms: res.rooms ?? [] } : null;
}

/** Latest basin reading for one companion; null when there is none or Halseth could not be read. */
export async function fetchHomeBasin(companionId: string): Promise<HomeBasinReading | null> {
  const res = await hGetSafe<{ history?: HomeBasinReading[] }>(
    `/companion-growth/basin-history/${encodeURIComponent(companionId)}?limit=1`,
  );
  return res?.history?.[0] ?? null;
}

// ── Council (0080, take 8): convene a hard question, blind cross-rank, Gaia synthesis ──
export type CouncilRound = {
  id: string;
  question: string;
  asked_by: string;
  status: string;                       // open | answered | closed
  winning_companion_id: string | null;
  synthesis: string | null;
  created_at: string;
  closed_at?: string | null;
};

export type CouncilAnswer = { companion_id: string; answer: string; created_at: string };

export async function fetchCouncilCurrent(): Promise<{ round: CouncilRound | null; answers: CouncilAnswer[] }> {
  const res = await hGetSafe<{ round: CouncilRound | null; answers?: CouncilAnswer[] }>("/mind/council/current");
  return { round: res?.round ?? null, answers: res?.answers ?? [] };
}

export async function fetchCouncilRounds(limit = 10): Promise<CouncilRound[]> {
  const res = await hGetSafe<{ rounds?: CouncilRound[] }>(`/mind/council/rounds?limit=${limit}`);
  return res?.rounds ?? [];
}

// ── Imps page: one read, GET /mind/imps/activity (halseth src/handlers/imps-activity.ts) ──
// Everything arrives already phrased: no raw trigger text (reply rides carry Principal's mood/spoons/pain), no open
// imp lines (only a per-companion count), no Hex lines. `kept` is what a companion chose to surface.
export type ImpOuting = {
  imp: string;
  companion_id: string;
  kind: "errand" | "reply";
  errand: string | null;
  created_at: string;
};
export type ImpLastOut = { created_at: string; companion_id: string; kind: "errand" | "reply"; errand: string | null };
export type ImpKeptLine = { id: string; imp: string; companion_id: string; content: string; state_at: string | null };
export type ImpActivity = {
  recent: ImpOuting[];
  last_by_imp: Record<string, ImpLastOut | null>;
  waiting: Record<string, number>;
  kept: ImpKeptLine[];
};

/** null when the Worker predates the route (or is down): the page falls back to the five cards. */
export async function fetchImpActivity(): Promise<ImpActivity | null> {
  return hGetSafe<ImpActivity>("/mind/imps/activity");
}

// ── Architect facts (/facts, 2026-09-14) ────────────────────────────────────
// Durable facts about Principal, machine-proposed or Principal-authored, held in Halseth
// `architect_facts`. `open` = never confirmed; `active` = live and rendered into every
// companion's boot context; `retired` = superseded or withdrawn, kept for lineage.
// See halseth/src/handlers/architect-facts.ts for the authoritative shape + verbs.

export type ArchitectFact = {
  id: string;
  fact: string;
  category: string;
  status: "active" | "open" | "retired";
  companion_id: string | null;
  source: string | null;
  weight: number;
  created_at: string; // D1 "YYYY-MM-DD HH:MM:SS" UTC
  /** A correction proposal names the fact it would replace (Halseth facts-write, 2026-11-11). Older Halseth omits it. */
  supersedes_id?: string | null;
};

export async function fetchArchitectFacts(): Promise<ArchitectFact[]> {
  const res = await hGetSafe<{ count: number; facts: ArchitectFact[] }>("/identity/architect-facts");
  return res?.facts ?? [];
}

export async function patchArchitectFactStatus(
  id: string,
  status: "active" | "retired",
): Promise<{ ok: boolean; id: string; from: string; status: string } | null> {
  return hPatch(`/identity/architect-facts/${encodeURIComponent(id)}`, { status });
}

export async function postArchitectFact(payload: {
  fact: string;
  category?: string;
  status?: "active" | "open";
  companion_id?: string | null;
  source?: string;
  weight?: number;
  supersedes_id?: string;
}): Promise<{ ok: boolean; id: string; supersedes_id: string | null; status: string; category: string; deduped?: boolean } | null> {
  return hPost("/identity/architect-facts", payload);
}

// ── The memory map (Halseth GET /mind/map, docs/PLAN-memory-map-2026-10-28.md) ──────────────────
// A bounded neighborhood with a name on every node and the writer on every edge. Read-only on the
// Halseth side (viewing warms nothing).

export type MapReader = "principal" | "cypher" | "drevan" | "gaia";

export type MapNode = {
  key: string;
  table: string;
  id: string;
  kind: string;
  label: string;
  text: string | null;
  owner: string | null;
  created_at: string | null;
  pinned: boolean;
  seed: boolean;
};

// `why` (Halseth 0.24.0, M4): the writer's own words on a mind's link (type 'linked:<writer>',
// provenance 'asserted'); null on every derived edge. Optional so an older Worker still parses.
export type MapEdge = { src: string; dst: string; type: string; writer: string; provenance: string; created_at: string; why?: string | null };

export type MemoryMap = { nodes: MapNode[]; edges: MapEdge[]; truncated: boolean; center: string | null };

export async function fetchMemoryMap(reader: MapReader, center?: string | null, hops: 1 | 2 = 1): Promise<MemoryMap | null> {
  const q = new URLSearchParams({ reader, hops: String(hops) });
  if (center) q.set("center", center);
  return hGetSafe<MemoryMap>(`/mind/map?${q.toString()}`);
}

// ── People the memory graph may link to (Halseth mig 0149, map M5) ─────────────────────────────────
/** Halseth mig 0150: one "centre" (Principal, also Crash); "self" = a system name, which is Principal fronting. */
export type PersonKind = "centre" | "self" | "person" | "pet" | "other";

export interface GraphPerson {
  id: string;
  label: string;
  match_names: string[];
  kind: PersonKind;
  pk_member_id: string | null;
  note: string | null;
  /** Halseth mig 0160: the work(s) this name also belongs to. Set = the bare name never links,
   *  only the other spellings do. Absent before the migration. */
  shares_name_with?: string | null;
  /** Halseth mig 0163 (B49). Absent before the migration. system_of = the owner's person id. */
  system_of?: string | null;
  relation?: string | null;
  frame_line?: string | null;
  discord_user_id?: string | null;
  pk_system?: string | null;
  added_by: string;
  created_at: string;
  /** Visible (kept, live) rows the graph links to this person as of the last rebuild -- the same rows the map shows. */
  mentions: number;
}

// Halseth mig 0152: names that never become a dot on the map. Admin token only (HALSETH_SECRET).
export type KeepOffTerm = { id: string; term: string; note: string | null; added_by: string; created_at: string };

export async function fetchKeepOff(): Promise<KeepOffTerm[] | null> {
  const r = await hGetSafe<{ terms: KeepOffTerm[] }>("/mind/keep-off");
  return r?.terms ?? null;
}

export async function fetchPeople(): Promise<GraphPerson[] | null> {
  const r = await hGetSafe<{ people: GraphPerson[] }>("/mind/people");
  return r?.people ?? null;
}

// "Needs you" inbox (Halseth GET /principal/needs): everything waiting on Principal, one list.
export type NeedsKind = "question" | "growth" | "guardian" | "basin" | "basin_move";
export interface NeedsItem {
  key: string; // `${kind}:${id}`
  kind: NeedsKind;
  id: string;
  companion_id: string | null;
  created_at: string; // SQLite UTC; basin: recorded_at
  title: string | null;
  detail: string | null;
  severity?: "notice" | "warning" | "red"; // guardian only
  drift_score?: number; // basin only
}
export interface NeedsCounts { total: number; question: number; growth: number; guardian: number; basin: number; basin_move?: number }
export async function fetchNeeds(limit = 50): Promise<{ items: NeedsItem[]; counts: NeedsCounts } | null> {
  return hGetSafe<{ items: NeedsItem[]; counts: NeedsCounts }>(`/principal/needs?limit=${limit}`);
}

// Companion page (Halseth GET /principal/companion/:id). Types copied verbatim from Halseth's
// src/handlers/principal-companion.ts contract (P3 Task 1).
export type CompanionId = "drevan" | "cypher" | "gaia";
export type FloatKey = "soma_float_1" | "soma_float_2" | "soma_float_3";
export interface CompanionRundown {
  companion_id: CompanionId;
  last_real_thing: { text: string; at: string } | null;
  last_looked_at: string | null;            // as stored, or null on first visit
  since_basis: "last_looked" | "week";      // "week" when no companion_page row
  since: { journal: number; letters: number; book_notes: number; sol: number; autonomy: number };
  doors: { journal: number; letters_unread: number; growth: number; feelings: number; upto: number; made: number };
  trace: Record<FloatKey, (number | null)[]>; // exactly 7 points, oldest -> newest, last = current value
}
export async function fetchCompanionRundown(id: CompanionId): Promise<CompanionRundown | null> {
  return hGetSafe<CompanionRundown>(`/principal/companion/${id}`);
}

// Companion projects (Halseth GET /mind/projects/:companion_id; row = ProjectRow in src/handlers/projects.ts).
export interface Project {
  id: string;
  companion_id: string;
  title: string;
  intention: string;
  status: "open" | "paused" | "done" | "released";
  horizon_note: string | null;
  resolution_note: string | null;
  created_at: string;
  last_worked_at: string | null;
  closed_at: string | null;
}
export async function fetchProjects(id: CompanionId): Promise<Project[] | null> {
  const r = await hGetSafe<{ projects: Project[] }>(`/mind/projects/${id}`);
  return Array.isArray(r?.projects) ? r.projects : null;
}

/**
 * Newest generated image across the triad, or null. Limit 10 per companion, not 1: the success
 * filter in fetchToolImages runs client-side, so a newest failed row would hide an older good one.
 */
export async function fetchNewestImage(): Promise<ToolCall | null> {
  const lists = await Promise.all(
    ["cypher", "drevan", "gaia"].map((id) => fetchToolImages(id, 10).catch(() => [] as ToolCall[])),
  );
  let best: ToolCall | null = null;
  let bestAt = -Infinity;
  for (const c of lists.flat()) {
    const t = parseUtc(c.created_at)?.getTime() ?? -Infinity;
    if (best === null || t > bestAt) {
      best = c;
      bestAt = t;
    }
  }
  return best;
}

// ── B62 step 2: the companions' own thinking (why trail) ─────────────────────
// Endpoints may 404 until Halseth deploys them; every fetcher returns null on any failure and the
// pages treat null exactly like "nothing yet".
export type ThinkingKind =
  | "born" | "returned" | "made" | "cooled" | "put_down" | "picked_up" | "like" | "dislike" | "refusal";

export interface ThinkingItem {
  id: string;
  companion_id: CompanionId;
  source: "interest" | "preference" | "refusal";
  kind: ThinkingKind;
  subject: string;
  why: string | null;
  why_private: boolean | number;
  interest_id: string | null;
  created_at: string;
}

export interface Interest {
  id: string;
  name: string;
  why: string | null;
  why_private: boolean | number;
  status: "active" | "resting" | "put_down";
  heat: number;
  band: "warm" | "cooling" | "cold";
  born_from?: string | null;
  created_at: string;
  last_event_at: string | null;
  last_event_kind: string | null;
  event_count: number;
  /** The last line when set down (Drevan 11-02: what it was, why picked up, why stopped). Null unless put_down or private. Absent on older Halseth. */
  put_down_why?: string | null;
}

export interface InterestEvent {
  id: string;
  kind: string;
  why: string | null;
  why_private: boolean | number;
  ref?: string | null;
  created_at: string;
}

export async function fetchThinking(limit = 20, companion?: CompanionId): Promise<ThinkingItem[] | null> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (companion) q.set("companion_id", companion);
  const r = await hGetSafe<{ items?: ThinkingItem[] }>(`/mind/thinking?${q}`);
  return r && Array.isArray(r.items) ? r.items : null;
}

export async function fetchInterests(companion: CompanionId): Promise<Interest[] | null> {
  const r = await hGetSafe<{ interests?: Interest[] }>(`/mind/interests/${encodeURIComponent(companion)}`);
  return r && Array.isArray(r.interests) ? r.interests : null;
}

export async function fetchInterestTrail(
  companion: CompanionId,
  interestId: string,
): Promise<{ interest: Interest; events: InterestEvent[] } | null> {
  const r = await hGetSafe<{ interest?: Interest; events?: InterestEvent[] }>(
    `/mind/interests/${encodeURIComponent(companion)}/${encodeURIComponent(interestId)}`,
  );
  if (!r || !r.interest) return null;
  return { interest: r.interest, events: Array.isArray(r.events) ? r.events : [] };
}
