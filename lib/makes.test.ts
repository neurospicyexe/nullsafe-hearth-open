import { describe, it, expect } from "vitest";
import type { Make } from "./halseth";
import { isMakeId, isMakeWhich, makeLinks, inlineImage, needsSource, makeRecipe, recentMakes } from "./makes";

const ID = "0123456789abcdef0123456789abcdef";
const m = (over: Partial<Make>): Make => ({
  id: ID, kind: "drawing", title: "t", why: null, interest_name: null, status: "ready", heard_back: null,
  version: 1, parent_id: null, created_at: "2026-11-02T10:00:00Z", files: {}, ...over,
});

describe("ids and which", () => {
  it("accepts 32 hex with an optional img_ prefix only", () => {
    expect(isMakeId(ID)).toBe(true);
    expect(isMakeId("img_" + ID)).toBe(true);
    for (const bad of ["", ID.slice(1), ID + "a", "img_" + ID.slice(1), "img-" + ID, ID.replace("0", "g"), ID + "\n"]) {
      expect(isMakeId(bad)).toBe(false);
    }
  });
  it("which is an allowlist", () => {
    for (const ok of ["source", "file", "preview"]) expect(isMakeWhich(ok)).toBe(true);
    for (const bad of ["", "File", "__proto__", "toString", "source "]) expect(isMakeWhich(bad)).toBe(false);
  });
});

describe("links", () => {
  it("not ready means no links and no inline media", () => {
    for (const status of ["pending", "failed"] as const) {
      const x = m({ status, files: { source: {}, file: {}, preview: {} } });
      expect(makeLinks(x)).toEqual({ download: null, source: null });
      expect(inlineImage(x)).toBeNull();
      expect(needsSource(m({ status, kind: "writing" }))).toBe(false);
    }
  });
  it("source-only kinds download the source", () => {
    expect(makeLinks(m({ kind: "writing", files: { source: {} } })).download?.href).toBe(`/api/makes/${ID}/source`);
  });
  it("writing and code makes with a source need fetched text; model kinds never do", () => {
    expect(needsSource(m({ kind: "writing" }))).toBe(true);
    for (const k of ["page", "music_code", "drawing", "scad"] as const) {
      expect(needsSource(m({ kind: k, files: { source: {} } }))).toBe(true);
      expect(needsSource(m({ kind: k }))).toBe(false);
    }
    for (const k of ["music_audio", "video", "image"] as const) expect(needsSource(m({ kind: k, files: { source: {} } }))).toBe(false);
  });
});

describe("how it was made", () => {
  it("a song shows its model, the description word for word, and the facts", () => {
    const r = makeRecipe(m({ kind: "music_audio", params: { prompt: "slow minimal ambient", duration: 45, instrumental: true } }))!;
    expect(r.line).toMatch(/ACE-Step/);
    expect(r).toMatchObject({ prompt: "slow minimal ambient", lyrics: null, facts: ["45 seconds", "instrumental"], showsCode: false });
  });
  it("a song with lyrics carries them; junk params read as nothing", () => {
    expect(makeRecipe(m({ kind: "music_audio", params: { prompt: "p", lyrics: "la la", duration: 30 } }))!.lyrics).toBe("la la");
    expect(makeRecipe(m({ kind: "music_audio", params: { prompt: 7, duration: "long" } }))).toMatchObject({ prompt: null, facts: [] });
    expect(makeRecipe(m({ kind: "music_audio" }))).toMatchObject({ prompt: null, facts: [] });
  });
  it("a video names its model and shape", () => {
    expect(makeRecipe(m({ kind: "video", params: { prompt: "rain", aspect: "9:16" } }))).toMatchObject({ prompt: "rain", facts: ["tall (9:16)"] });
  });
  it("code kinds show their code only when there is a source", () => {
    for (const k of ["drawing", "scad", "page", "music_code"] as const) {
      expect(makeRecipe(m({ kind: k, files: { source: {} } }))!.showsCode).toBe(true);
      expect(makeRecipe(m({ kind: k }))!.showsCode).toBe(false);
    }
    expect(makeRecipe(m({ kind: "scad", files: { source: {} } }))!.line).toMatch(/OpenSCAD/);
  });
  it("an old image shows its description; writing has no recipe (the text is the how)", () => {
    expect(makeRecipe(m({ kind: "image", title: "a fox at dusk" }))!.prompt).toBe("a fox at dusk");
    expect(makeRecipe(m({ kind: "writing" }))).toBeNull();
  });
});

describe("recentMakes (home strip)", () => {
  const now = new Date("2026-11-05T18:00:00Z");
  const idN = (n: number) => String(n).repeat(32).slice(0, 32);
  it("lists an interest-less ready writing from the D1 timestamp shape, newest first, linking the piece", () => {
    const out = recentMakes(
      {
        cypher: [m({ id: idN(1), kind: "writing", title: "Slime", created_at: "2026-11-05 14:00:33" })],
        gaia: [m({ id: idN(2), created_at: "2026-11-04T09:00:00Z" })],
      },
      now,
    );
    expect(out.map((r) => r.title)).toEqual(["Slime", "t"]);
    expect(out[0].href).toBe(`/companions/cypher/made#make-${idN(1)}`);
    expect(out[0].kind).toBe("writing");
  });
  it("drops pending, failed, old, legacy img_ rows, and tolerates null shelves", () => {
    const out = recentMakes(
      {
        cypher: [
          m({ id: idN(3), status: "pending" }),
          m({ id: idN(4), status: "failed" }),
          m({ id: idN(5), created_at: "2026-10-01T00:00:00Z" }),
          m({ id: "img_" + idN(6), kind: "image" }),
        ],
        drevan: null,
      },
      now,
    );
    expect(out).toEqual([]);
  });
});

describe("kindLabel (mig 0170 origin)", () => {
  it("names a captured letter and night exploration, leaves the rest as their kind", async () => {
    const { kindLabel } = await import("./makes");
    expect(kindLabel({ kind: "writing", origin_kind: "letter" })).toBe("letter");
    expect(kindLabel({ kind: "writing", origin_kind: "exploration" })).toBe("night exploration");
    expect(kindLabel({ kind: "writing", origin_kind: "kept" })).toBe("writing");
    expect(kindLabel({ kind: "writing" })).toBe("writing");
    expect(kindLabel({ kind: "music_code", origin_kind: null })).toBe("beat");
  });
});
