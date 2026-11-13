// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import StillToggle from "./StillToggle";
import { STILL_KEY } from "@/lib/still";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-still");
});
afterEach(cleanup);

describe("StillToggle", () => {
  it("is a button with aria-pressed, off by default, with a plain explanation and no em dash", () => {
    const { container } = render(<StillToggle />);
    const b = screen.getByRole("button", { name: /still/i });
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.className).toContain("h-btn");
    expect(container.textContent).toContain("Turns off all movement in Hearth on this device.");
    expect(container.textContent).not.toMatch(/—/);
  });
  it("flips aria-pressed, the attribute and storage both ways", () => {
    render(<StillToggle />);
    const b = screen.getByRole("button", { name: /still/i });
    fireEvent.click(b);
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.hasAttribute("data-still")).toBe(true);
    expect(localStorage.getItem(STILL_KEY)).toBe("1");
    fireEvent.click(b);
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.hasAttribute("data-still")).toBe(false);
    expect(localStorage.getItem(STILL_KEY)).toBeNull();
  });
  it("starts pressed when the device already chose Still", async () => {
    localStorage.setItem(STILL_KEY, "1");
    render(<StillToggle />);
    expect(screen.getByRole("button", { name: /still/i }).getAttribute("aria-pressed")).toBe("true");
  });
});
