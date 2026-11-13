import { describe, it, expect } from "vitest";
import { outingParts, agoText, IMP_ORDER, IMP_DOES, companionName } from "../imps";

describe("outingParts", () => {
  it("errands keep the Worker's phrase and run 'for' the companion", () => {
    expect(outingParts({ imp: "nimbus", kind: "errand", errand: "checked for gaps" })).toEqual({ action: "checked for gaps", link: "for" });
    expect(outingParts({ imp: "rock", kind: "errand", errand: "fetched" })).toEqual({ action: "fetched", link: "for" });
  });
  it("Hex's pointer names the sender, not a receiver", () => {
    expect(outingParts({ imp: "hex", kind: "errand", errand: "left a pointer" })).toEqual({ action: "left a pointer for a sibling", link: "sent by" });
  });
  it("a reply ride is a ride-along, and a missing phrase is a plain errand", () => {
    expect(outingParts({ imp: "mossling", kind: "reply", errand: null }).action).toBe("rode along on a reply");
    expect(outingParts({ imp: "iris", kind: "errand", errand: null }).action).toBe("ran an errand");
  });
});

describe("agoText", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  it("is coarse", () => {
    expect(agoText("2026-11-06T11:59:40Z", now)).toBe("just now");
    expect(agoText("2026-11-06T11:15:00Z", now)).toBe("45m ago");
    expect(agoText("2026-11-06T10:00:00Z", now)).toBe("2h ago");
    expect(agoText("2026-11-03T12:00:00Z", now)).toBe("3d ago");
    expect(agoText("garbage", now)).toBe("a while ago");
  });
});

describe("registry", () => {
  it("every imp has a plain description; companion names are capitalised", () => {
    for (const k of IMP_ORDER) expect(IMP_DOES[k]).toBeTruthy();
    expect(companionName("drevan")).toBe("Drevan");
  });
});
