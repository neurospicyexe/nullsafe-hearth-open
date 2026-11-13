// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/dreams" }));

const submit = vi.fn();
vi.mock("@/components/shell/WriteQueueProvider", () => ({ useWriteQueue: () => ({ submit, flush: vi.fn() }) }));

import SeedForm from "./SeedForm";

let resolveDone: (v: unknown) => void;
let undo: ReturnType<typeof vi.fn>;
let waiting: boolean;

beforeEach(() => {
  refresh.mockClear();
  waiting = true;
  undo = vi.fn(() => { waiting = false; resolveDone("undone"); });
  submit.mockReset();
  submit.mockImplementation(() => ({
    undo, waiting: () => waiting,
    done: new Promise((r) => { resolveDone = r; }),
  }));
});
afterEach(cleanup);

const text = () => screen.getByLabelText("Dream seed") as HTMLTextAreaElement;
function fill(withCompanion = false) {
  render(<SeedForm />);
  fireEvent.change(text(), { target: { value: "  moss and rain  " } });
  if (withCompanion) fireEvent.change(screen.getByLabelText("For"), { target: { value: "gaia" } });
  fireEvent.click(screen.getByRole("button", { name: "Inject" }));
}

describe("SeedForm", () => {
  it("disables Inject on empty text", () => {
    render(<SeedForm />);
    expect((screen.getByRole("button", { name: "Inject" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("sends one write with key prefix, method, url and trimmed body", () => {
    fill();
    expect(submit).toHaveBeenCalledTimes(1);
    const w = submit.mock.calls[0][0];
    expect(w.key).toMatch(/^dream-seed-\d+$/);
    expect(w.method).toBe("POST");
    expect(w.url).toBe("/api/dream-seeds");
    expect(w.body).toEqual({ content: "moss and rain" });
    expect(screen.getByText("Seed left")).toBeTruthy();
  });
  it("includes for_companion when chosen", () => {
    fill(true);
    expect(submit.mock.calls[0][0].body).toEqual({ content: "moss and rain", for_companion: "gaia" });
  });
  it("undo restores the text and sends nothing more", async () => {
    fill();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "undo" })); });
    expect(undo).toHaveBeenCalled();
    expect(text().value).toBe("  moss and rain  ");
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("a failed result keeps the text and shows the failure line", async () => {
    fill();
    await act(async () => { resolveDone({ ok: false, status: 409, json: { error: "nope" }, dropped: true }); });
    expect(screen.getByText("nope")).toBeTruthy();
    expect(text().value).toBe("  moss and rain  ");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("success refreshes and clears", async () => {
    fill();
    await act(async () => { resolveDone({ ok: true, status: 200, json: {} }); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(text().value).toBe("");
  });
});
