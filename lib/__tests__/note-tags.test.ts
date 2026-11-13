// GET /companion-notes sends `tags` as raw D1 JSON text ('["letter"]'), while CompanionNote
// promises string[]. /mind and /threads 500'd on `tags.map`, and the letters filter
// `tags.includes("letter")` only worked as a substring match on the string (so a "newsletter"
// tag would have counted). parseNoteTags is the one boundary that makes the type true.

import { describe, it, expect } from "vitest";
import { parseNoteTags } from "../halseth";

describe("parseNoteTags", () => {
  it("parses the JSON text Halseth actually sends", () => {
    expect(parseNoteTags('["letter","reflection"]')).toEqual(["letter", "reflection"]);
  });

  it("passes a real array through, dropping non-strings", () => {
    expect(parseNoteTags(["letter", 3, null, "x"])).toEqual(["letter", "x"]);
  });

  it("returns null for empty, malformed, or non-array input rather than throwing", () => {
    expect(parseNoteTags(null)).toBeNull();
    expect(parseNoteTags("")).toBeNull();
    expect(parseNoteTags("{not json")).toBeNull();
    expect(parseNoteTags('{"a":1}')).toBeNull();
    expect(parseNoteTags(42)).toBeNull();
  });

  it("makes the letters filter exact, not a substring match", () => {
    expect(parseNoteTags('["newsletter"]')?.includes("letter")).toBe(false);
    expect(parseNoteTags('["letter"]')?.includes("letter")).toBe(true);
  });
});
