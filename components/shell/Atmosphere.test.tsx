// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Atmosphere from "./Atmosphere";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.documentElement.dataset.time;
});

describe("Atmosphere", () => {
  it("sets data-time on mount and refreshes every 5 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1, 20, 58));
    expect(document.documentElement.dataset.time).toBeUndefined();
    render(<Atmosphere />);
    expect(document.documentElement.dataset.time).toBe("evening");
    vi.advanceTimersByTime(5 * 60_000);
    expect(document.documentElement.dataset.time).toBe("night");
  });
  it("renders nothing", () => {
    const { container } = render(<Atmosphere />);
    expect(container.innerHTML).toBe("");
  });
});
