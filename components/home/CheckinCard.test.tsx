// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import CheckinCard from "./CheckinCard";
import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import { FOLD_KEY, foldMarker } from "@/lib/checkin";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const today = new Date();
const row = { id: "row-today-12345", source: "hearth", spoons: 5, pain: 4, pain_where: "hips", notes: "slow morning", mood: null, recorded_at: today.toISOString() };

function mount() {
  return render(<WriteQueueProvider><CheckinCard /></WriteQueueProvider>);
}
function stubBiometrics(rows: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => rows })));
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("CheckinCard", () => {
  it("opens with spoons 0-12, pain 0-10, where, how it is, and Check in disabled until one field is set", async () => {
    stubBiometrics([]);
    mount();
    await screen.findByText("How it is");
    expect(screen.getAllByRole("button", { name: /^\d+ spoons$/ })).toHaveLength(13);
    expect(screen.getAllByRole("button", { name: /^pain \d+$/ })).toHaveLength(11);
    expect(screen.getByPlaceholderText("where, or what kind")).toBeTruthy();
    const go = screen.getByRole("button", { name: "Check in" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "pain 0" }));
    expect(go.disabled).toBe(false);
  });

  it("shows today's existing row as one line with an edit button, and edit reopens the form filled", async () => {
    stubBiometrics([row]);
    mount();
    await screen.findByText("edit");
    expect(screen.getByText(/slow morning/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check in" })).toBeNull();
    fireEvent.click(screen.getByText("edit"));
    expect((screen.getByPlaceholderText("where, or what kind") as HTMLInputElement).value).toBe("hips");
    expect(screen.getByRole("button", { name: "pain 4" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("folds for the day after not now, per device", async () => {
    stubBiometrics([]);
    mount();
    fireEvent.click(await screen.findByText("not now"));
    expect(window.localStorage.getItem(FOLD_KEY)).toBe(foldMarker(new Date()));
    expect(screen.queryByText("How it is")).toBeNull();
    cleanup();
    stubBiometrics([]);
    mount();
    await screen.findByText("check in");
    expect(screen.queryByText("How it is")).toBeNull();
  });

  it("still opens when localStorage throws and Halseth is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    mount();
    await waitFor(() => expect(screen.getByText("How it is")).toBeTruthy());
    spy.mockRestore();
  });
});
