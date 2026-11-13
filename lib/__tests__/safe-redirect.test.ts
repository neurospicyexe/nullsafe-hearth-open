import { describe, it, expect } from "vitest";
import { sanitizeRedirectTarget } from "../safe-redirect.js";

describe("sanitizeRedirectTarget", () => {
  it("allows a normal same-origin path", () => {
    expect(sanitizeRedirectTarget("/companions/cypher")).toBe("/companions/cypher");
  });

  it("defaults to / when null", () => {
    expect(sanitizeRedirectTarget(null)).toBe("/");
  });

  it("defaults to / when empty", () => {
    expect(sanitizeRedirectTarget("")).toBe("/");
  });

  it("rejects a bare protocol-relative URL", () => {
    expect(sanitizeRedirectTarget("//evil.com")).toBe("/");
  });

  it("rejects an absolute URL", () => {
    expect(sanitizeRedirectTarget("https://evil.com")).toBe("/");
  });

  it("rejects the backslash bypass (WHATWG URL parser normalizes \\ to /)", () => {
    expect(sanitizeRedirectTarget("/\\evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("\\/evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("\\\\evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("/\\/evil.com")).toBe("/");
  });
});
