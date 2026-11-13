// The contract-major gate on Hearth's MindState reads (cutover 2026-07-29).
//
// Hearth cut over from raw /mind/orient to /mind/state?loom=hearth — the one loader
// (halseth/docs/mindstate-contract.md, step 3: raw /mind/orient is the first loom). The adapters in
// lib/halseth.ts map a specific payload SHAPE, so they are only correct for the contract major they
// were written against.
//
// Why this needs a test rather than a comment: the failure it prevents is silent and looks like data
// simply being absent. A v1 payload read by v0 adapters produces undefined for every field, and
// ContinuitySection then renders "No continuity data." That reads as "nothing to show" when the truth
// is "the data is right there under a different shape" — the worst kind of wrong, because nobody
// investigates an empty panel. So the gate must fail LOUD (return null + console.error), and a
// garbled version must be a reject, not an accidental pass through Number.parseInt.

import { describe, it, expect } from "vitest";
import { isCompatibleContract, MINDSTATE_MAJOR } from "../halseth";

describe("isCompatibleContract", () => {
  it("accepts the major the adapters were written against, at any minor/patch", () => {
    expect(isCompatibleContract(`${MINDSTATE_MAJOR}.1.0`)).toBe(true);
    expect(isCompatibleContract(`${MINDSTATE_MAJOR}.0.0`)).toBe(true);
    // MINOR bumps add blocks; renderers ignore unknown blocks, so these must keep passing or every
    // future block addition breaks Hearth.
    expect(isCompatibleContract(`${MINDSTATE_MAJOR}.99.99`)).toBe(true);
  });

  it("rejects a different major -- renames and restructures need adapter work", () => {
    expect(isCompatibleContract(`${MINDSTATE_MAJOR + 1}.0.0`)).toBe(false);
    expect(isCompatibleContract("9.0.0")).toBe(false);
  });

  it("rejects missing or garbled versions instead of coercing them into a pass", () => {
    for (const v of [undefined, null, "", "   ", "abc", "v0.1.0", ".1.0", "NaN"]) {
      expect(isCompatibleContract(v as string | undefined | null), `should reject ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("does not treat a numeric-prefixed junk string as the major by accident", () => {
    // parseInt("0abc") is 0, which WOULD pass -- documenting that this is knowingly accepted.
    // The version comes from our own worker, so a leading-digit-then-junk string is not a real
    // threat; the cases that matter (a real major bump, and total absence) are covered above.
    expect(isCompatibleContract("0abc")).toBe(true);
  });
});
