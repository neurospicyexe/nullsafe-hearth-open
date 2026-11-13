import { describe, it, expect } from "vitest";
import { toneOf } from "../tone";

describe("toneOf", () => {
  it("maps the three companions", () => {
    expect(toneOf("drevan")).toBe("h-tone-drevan");
    expect(toneOf("cypher")).toBe("h-tone-cypher");
    expect(toneOf("gaia")).toBe("h-tone-gaia");
  });
  it("gives none for null, unknown and prototype keys", () => {
    expect(toneOf(null)).toBe("h-tone-none");
    expect(toneOf("cross")).toBe("h-tone-none");
    expect(toneOf("constructor")).toBe("h-tone-none");
    expect(toneOf("__proto__")).toBe("h-tone-none");
  });
});
