// Allowlist for POST /api/biometrics -> Halseth POST /biometrics. Pure: only known fields cross.

/** Same rule as Halseth: a client-generated row id is 8..64 chars of [A-Za-z0-9_-]. */
export const ROW_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Where the pain is, or what kind: trimmed, 120 chars at most, empty is null. Same rule as Halseth. */
export const PAIN_WHERE_MAX = 120;
/** "How it is": a word or a few sentences. Same cap as Halseth's notes. */
export const NOTES_MAX = 2000;

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export function biometricsPostBody(r: Record<string, unknown>, now: () => Date = () => new Date()) {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const bool = (v: unknown) => (typeof v === "boolean" ? v : v === 1 ? true : v === 0 ? false : null);
  const id = typeof r["id"] === "string" && ROW_ID_RE.test(r["id"]) ? r["id"] : undefined;
  return {
    // Client id: a retried POST of the same check-in is a no-op upstream instead of a second row.
    ...(id !== undefined ? { id } : {}),
    // Tap time from the client, so a write retried on a later visit lands when it was tapped.
    recorded_at:   typeof r["recorded_at"] === "string" ? r["recorded_at"] : now().toISOString(),
    source:        str(r["source"]),
    hrv_resting:   num(r["hrv_resting"]),
    resting_hr:    num(r["resting_hr"]),
    sleep_hours:   num(r["sleep_hours"]),
    sleep_quality: str(r["sleep_quality"]),
    stress_score:  num(r["stress_score"]),
    steps:         num(r["steps"]),
    active_energy: num(r["active_energy"]),
    notes:         text(r["notes"], NOTES_MAX),
    pain_where:    text(r["pain_where"], PAIN_WHERE_MAX),
    // Subjective ND-state layer (migration 0081)
    mood:          str(r["mood"]),
    pain:          num(r["pain"]),
    energy:        num(r["energy"]),
    focus:         num(r["focus"]),
    spoons:        num(r["spoons"]),
    meds_taken:    bool(r["meds_taken"]),
  };
}

/**
 * Allowlist for PATCH /api/biometrics/:id -> Halseth PATCH /biometrics/:id: the fields a check-in can be
 * amended with. Halseth's PATCH is strict (a bad value is a 400, never rewritten), so only well-formed
 * values cross: spoons a finite number, mood <= 80 chars, energy and pain integers (pain 0-10 or null to
 * clear), pain_where and notes strings ("" clears; capped). A key the caller did not send is not sent.
 */
export function biometricsPatchBody(r: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (typeof r["spoons"] === "number" && Number.isFinite(r["spoons"])) body.spoons = r["spoons"];
  if (typeof r["mood"] === "string") body.mood = r["mood"].slice(0, 80);
  if (typeof r["energy"] === "number" && Number.isInteger(r["energy"])) body.energy = r["energy"];
  if (r["pain"] === null || (typeof r["pain"] === "number" && Number.isInteger(r["pain"]) && r["pain"] >= 0 && r["pain"] <= 10)) {
    if ("pain" in r) body.pain = r["pain"];
  }
  if (r["pain_where"] === null) body.pain_where = null;
  else if (typeof r["pain_where"] === "string") body.pain_where = r["pain_where"].trim().slice(0, PAIN_WHERE_MAX);
  if (r["notes"] === null) body.notes = null;
  else if (typeof r["notes"] === "string") body.notes = r["notes"].trim().slice(0, NOTES_MAX);
  return body;
}
