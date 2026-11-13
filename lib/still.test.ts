// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { STILL_KEY, readStill, writeStill } from "./still";

describe("still", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("uses the documented key", () => expect(STILL_KEY).toBe("hearth.still"));
  it("reads false by default and true after write", () => {
    expect(readStill()).toBe(false);
    writeStill(true);
    expect(localStorage.getItem(STILL_KEY)).toBe("1");
    expect(readStill()).toBe(true);
    writeStill(false);
    expect(localStorage.getItem(STILL_KEY)).toBeNull();
    expect(readStill()).toBe(false);
  });
  it("survives storage that throws", () => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    expect(readStill()).toBe(false);
    Storage.prototype.getItem = get;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    expect(() => writeStill(true)).not.toThrow();
    Storage.prototype.setItem = set;
  });
});
