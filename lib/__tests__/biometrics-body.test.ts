import { describe, it, expect } from "vitest";
import { biometricsPostBody, biometricsPatchBody } from "../biometrics-body";

const NOW = () => new Date("2026-10-30T03:00:00.000Z");

describe("biometricsPostBody", () => {
  it("forwards the client's recorded_at (tap time), else stamps now", () => {
    expect(biometricsPostBody({ spoons: 4, recorded_at: "2026-10-29T22:15:00.000Z" }, NOW).recorded_at).toBe("2026-10-29T22:15:00.000Z");
    expect(biometricsPostBody({ spoons: 4 }, NOW).recorded_at).toBe("2026-10-30T03:00:00.000Z");
  });

  it("forwards a well-formed client id and drops a malformed one", () => {
    const uuid = "0b7c6f1e-3a2d-4c5b-9e8f-1a2b3c4d5e6f";
    expect(biometricsPostBody({ id: uuid, spoons: 4 }, NOW).id).toBe(uuid);
    for (const id of ["short", "x".repeat(65), "has space x", 12345678, null]) {
      expect("id" in biometricsPostBody({ id, spoons: 4 }, NOW), String(id)).toBe(false);
    }
  });

  it("keeps the allowlist: unknown fields never reach Halseth", () => {
    const b = biometricsPostBody({ spoons: 4, mood: "foggy", energy: 3, evil: "x" }, NOW) as Record<string, unknown>;
    expect(b.spoons).toBe(4);
    expect(b.mood).toBe("foggy");
    expect(b.energy).toBe(3);
    expect("evil" in b).toBe(false);
  });
});

describe("biometricsPostBody check-in fields", () => {
  it("forwards pain and a trimmed pain_where, empty becomes null", () => {
    const b = biometricsPostBody({ spoons: 5, pain: 4, pain_where: "  hips " }, NOW);
    expect(b.pain).toBe(4);
    expect(b.pain_where).toBe("hips");
    expect(biometricsPostBody({ pain_where: "   " }, NOW).pain_where).toBeNull();
    expect(biometricsPostBody({}, NOW).pain_where).toBeNull();
  });
  it("caps pain_where at 120 and notes at 2000", () => {
    expect(biometricsPostBody({ pain_where: "x".repeat(300) }, NOW).pain_where).toHaveLength(120);
    expect(biometricsPostBody({ notes: "y".repeat(5000) }, NOW).notes).toHaveLength(2000);
  });
});

describe("biometricsPatchBody", () => {
  it("forwards the old fields as before", () => {
    expect(biometricsPatchBody({ spoons: 4, mood: "foggy", energy: 3 })).toEqual({ spoons: 4, mood: "foggy", energy: 3 });
  });
  it("forwards pain, pain_where and notes", () => {
    expect(biometricsPatchBody({ pain: 4, pain_where: " hips ", notes: " tired " })).toEqual({ pain: 4, pain_where: "hips", notes: "tired" });
  });
  it("null and empty string clear a field", () => {
    expect(biometricsPatchBody({ pain: null, pain_where: null, notes: null })).toEqual({ pain: null, pain_where: null, notes: null });
    expect(biometricsPatchBody({ pain_where: "", notes: "" })).toEqual({ pain_where: "", notes: "" });
  });
  it("never forwards a value Halseth would 400 on", () => {
    expect(biometricsPatchBody({ pain: 11 })).toEqual({});
    expect(biometricsPatchBody({ pain: -1 })).toEqual({});
    expect(biometricsPatchBody({ pain: 2.5 })).toEqual({});
    expect(biometricsPatchBody({ pain: "4", energy: 1.5, spoons: NaN })).toEqual({});
  });
  it("caps lengths and drops unknown keys", () => {
    const b = biometricsPatchBody({ pain_where: "x".repeat(300), notes: "y".repeat(5000), evil: 1 });
    expect(b.pain_where).toHaveLength(120);
    expect(b.notes).toHaveLength(2000);
    expect("evil" in b).toBe(false);
  });
  it("omits keys the caller did not send", () => {
    expect(biometricsPatchBody({})).toEqual({});
  });
});
