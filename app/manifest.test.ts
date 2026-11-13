import { describe, it, expect } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("opens the installed app at Home", () => {
    expect(manifest().start_url).toBe("/");
  });
});
