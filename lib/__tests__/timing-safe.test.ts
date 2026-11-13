import { describe, it, expect } from "vitest";
import { safeCompare } from "../timing-safe.js";

describe("safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("Bearer abc123", "Bearer abc123")).toBe(true);
  });

  it("returns false for mismatched strings of the same length", () => {
    expect(safeCompare("Bearer abc123", "Bearer xyz789")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(safeCompare("short", "a much longer string")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
  });
});
