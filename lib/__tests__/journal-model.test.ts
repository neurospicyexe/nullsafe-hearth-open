import { describe, it, expect } from "vitest";
import { isLetterRow } from "../journal-model";

describe("isLetterRow", () => {
  it("is true for letter tags in JSON text or array form", () => {
    expect(isLetterRow('["letter"]')).toBe(true);
    expect(isLetterRow('["x","letter_to_principal"]')).toBe(true);
    expect(isLetterRow(["a", "letter"])).toBe(true);
  });
  it("is false for other tags, null, undefined and bad JSON", () => {
    expect(isLetterRow('["journal"]')).toBe(false);
    expect(isLetterRow(null)).toBe(false);
    expect(isLetterRow(undefined)).toBe(false);
    expect(isLetterRow("not json")).toBe(false);
  });
  it("a dropped row is not a letter row, whatever its tags", () => {
    expect(isLetterRow('["letter"]', "dropped")).toBe(false);
    expect(isLetterRow('["letter_to_principal"]', "dropped")).toBe(false);
    expect(isLetterRow('["letter"]', "kept")).toBe(true);
    expect(isLetterRow('["letter"]', null)).toBe(true);
  });
});
