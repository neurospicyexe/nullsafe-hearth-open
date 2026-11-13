// @vitest-environment jsdom
// The Pages group renders from the query alone: it must show before the fetch, and when Halseth is down.
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import SearchOverlay from "./SearchOverlay";

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

describe("SearchOverlay Pages group", () => {
  it("shows matching pages with the fetch down (503) beside the Halseth-down line", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    render(<SearchOverlay open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "facts" } });
    // Visible immediately, before the 300ms debounce fires a fetch.
    expect(screen.getByText("PAGES")).toBeTruthy();
    expect(screen.getByText("Facts")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("Can't reach Halseth right now.").length).toBeGreaterThan(0));
    expect(screen.getByText("Facts")).toBeTruthy();
  });

  it("shows pages when the fetch rejects outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net")));
    render(<SearchOverlay open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "tray" } });
    await waitFor(() => expect(screen.getAllByText("Search unavailable").length).toBeGreaterThan(0));
    expect(screen.getByText("Tray")).toBeTruthy();
  });

  it("tapping a page navigates to it and closes", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const onClose = vi.fn();
    render(<SearchOverlay open onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "facts" } });
    fireEvent.click(screen.getByText("Facts"));
    expect(push).toHaveBeenCalledWith("/facts");
    expect(onClose).toHaveBeenCalled();
  });

  it("no Pages group for an empty query", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SearchOverlay open onClose={() => {}} />);
    expect(screen.queryByText("PAGES")).toBeNull();
  });
});
