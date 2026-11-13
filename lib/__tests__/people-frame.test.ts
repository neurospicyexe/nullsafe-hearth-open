import { describe, it, expect } from "vitest";
import { addQualified, qualifiedSpellings, previewLine, draftBody, EMPTY_DRAFT } from "../people-frame";
import type { GraphPerson } from "../halseth";

const blue = { id: "b", label: "Spouse", kind: "person" } as GraphPerson;
const centre = { id: "principal", label: "Principal", kind: "centre" } as GraphPerson;

describe("qualified spellings", () => {
  it("self gets (ours); others get (Spouse) and (Spouse's system)", () => {
    expect(qualifiedSpellings("Lestat", "self")).toEqual(["Lestat (ours)"]);
    expect(qualifiedSpellings("MemberF", "person")).toEqual(["MemberF (Spouse)", "MemberF (Spouse's system)"]);
  });
  it("uses the system owner's label when it is not Spouse", () => {
    expect(qualifiedSpellings("PartnerMemberB", "person", "PartnerMemberC")).toEqual(["PartnerMemberB (PartnerMemberC)", "PartnerMemberB (PartnerMemberC's system)"]);
  });
  it("empty label adds nothing", () => {
    expect(qualifiedSpellings("  ", "person")).toEqual([]);
    expect(addQualified("", "", "person")).toBe("");
  });
  it("adds only what is missing and never removes what was typed", () => {
    expect(addQualified("Barb", "MemberF", "person")).toBe("Barb, MemberF (Spouse), MemberF (Spouse's system)");
    expect(addQualified("MemberF (Spouse), Barb", "MemberF", "person")).toBe("MemberF (Spouse), Barb, MemberF (Spouse's system)");
    expect(addQualified("MemberF (Spouse), MemberF (Spouse's system)", "MemberF", "person")).toBe("MemberF (Spouse), MemberF (Spouse's system)");
  });
});

describe("previewLine", () => {
  it("mirrors the server rendering", () => {
    expect(previewLine("Kyle Barnes", "person", { ...EMPTY_DRAFT, system_of: "b" }, [blue])).toBe("Kyle Barnes, a member of Spouse's system");
    expect(previewLine("Spouse", "person", { ...EMPTY_DRAFT, relation: "partner", frame_line: "Hosts truck nights." }, [])).toBe("Spouse, Principal's partner. Hosts truck nights");
    expect(previewLine("MemberA", "self", { ...EMPTY_DRAFT, frame_line: "ignored" }, [centre])).toBe("MemberA: Principal (one of Principal's names)");
    expect(previewLine("Acquaintance", "person", EMPTY_DRAFT, [])).toBeNull();
  });
  it("neutralises brackets and quotes", () => {
    expect(previewLine("Zed", "person", { ...EMPTY_DRAFT, frame_line: 'a"] [x]' }, [])).toBe("Zed: a') (x)");
  });
});

describe("draftBody", () => {
  it("clears empties to null", () => {
    expect(draftBody(EMPTY_DRAFT)).toEqual({ system_of: null, relation: null, frame_line: null, discord_user_id: null, pk_system: null });
  });
});
