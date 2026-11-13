import { describe, it, expect } from "vitest";
import { joinSessions } from "../sessions-model";
import type { SessionEntry, HandoverPacket } from "../halseth";

const sess = (o: Partial<SessionEntry> & { id: string }): SessionEntry =>
  ({
    created_at: "2026-10-30 10:00:00", updated_at: null, companion_id: "cypher", session_type: "work",
    spine: "the spine", last_real_thing: "last", motion_state: "at_rest", front_state: null, co_con: null,
    emotional_frequency: null, active_anchor: null, facet: null, hrv_range: null, depth: null, notes: null, ...o,
  }) as SessionEntry;
const ho = (o: Partial<HandoverPacket> & { session_id: string }): HandoverPacket =>
  ({
    id: "h-" + o.session_id, created_at: "2026-10-30 11:00:00", spine: "hs", active_anchor: null,
    last_real_thing: "hl", open_threads: null, motion_state: "at_rest", facet: null, returned: null,
    session_type: null, session_front_state: null, ...o,
  }) as HandoverPacket;

describe("joinSessions", () => {
  it("attaches the matching handover as body", () => {
    const [r] = joinSessions([sess({ id: "a" })], [ho({ session_id: "a", open_threads: '["x","y"]', active_anchor: "truck" })]);
    expect(r.body).toEqual({ spine: "hs", lastRealThing: "hl", threads: ["x", "y"], anchor: "truck" });
  });
  it("gives null body when the handover is outside the window, keeping spine", () => {
    const r = joinSessions([sess({ id: "a" })], [ho({ session_id: "zzz" })]).find((x) => x.id === "a")!;
    expect(r.body).toBeNull();
    expect(r.spine).toBe("the spine");
  });
  it("uses the first (newest) of two handovers", () => {
    const [r] = joinSessions([sess({ id: "a" })], [ho({ session_id: "a", spine: "new", id: "1" }), ho({ session_id: "a", spine: "old", id: "2" })]);
    expect(r.body?.spine).toBe("new");
  });
  it("bad or non-array open_threads gives []", () => {
    const s = [sess({ id: "a" }), sess({ id: "b" })];
    const out = joinSessions(s, [ho({ session_id: "a", open_threads: "{nope" }), ho({ session_id: "b", open_threads: '{"a":1}' })]);
    expect(out.map((r) => r.body?.threads)).toEqual([[], []]);
  });
  it("sorts newest first across timestamp formats", () => {
    const out = joinSessions(
      [sess({ id: "old", created_at: "2026-10-30 10:00:00" }), sess({ id: "new", created_at: "2026-10-30T12:00:00.000Z" })],
      [],
    );
    expect(out.map((r) => r.id)).toEqual(["new", "old"]);
  });
  it("never carries care or plural-state fields", () => {
    const out = joinSessions(
      [sess({ id: "a", hrv_range: "low", emotional_frequency: "ef", front_state: "fs", notes: "nn", depth: 2, co_con: "cc" })],
      [ho({ session_id: "a", session_front_state: "sfs" })],
    );
    const s = JSON.stringify(out);
    for (const k of ["hrv_range", "emotional_frequency", "front_state", "notes", "depth", "co_con", "low", "sfs", "nn"]) expect(s).not.toContain(k);
  });
  it("keeps a handover whose session is outside the window as its own row", () => {
    const out = joinSessions(
      [sess({ id: "a", created_at: "2026-10-30 10:00:00" })],
      [ho({ session_id: "gone", id: "hg", spine: "orphan spine", created_at: "2026-10-31 09:00:00", companion_id: "gaia", session_type: "work", motion_state: "floating", open_threads: '["t"]' })],
    );
    expect(out.map((r) => r.id)).toEqual(["gone", "a"]);
    expect(out[0]).toMatchObject({ companion: "gaia", sessionType: "work", motion: "floating", spine: "orphan spine", at: "2026-10-31 09:00:00" });
    expect(out[0].body?.threads).toEqual(["t"]);
  });
  it("one orphan row per session_id (newest handover wins)", () => {
    const out = joinSessions([], [ho({ session_id: "g", id: "1", spine: "new" }), ho({ session_id: "g", id: "2", spine: "old" })]);
    expect(out).toHaveLength(1);
    expect(out[0].spine).toBe("new");
  });
  it("orphan rows carry no care or plural fields", () => {
    const out = joinSessions([], [ho({ session_id: "g", session_front_state: "sfs" })]);
    expect(JSON.stringify(out)).not.toContain("sfs");
  });
});
