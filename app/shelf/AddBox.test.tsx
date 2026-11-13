// @vitest-environment jsdom
// AddBox through the real write queue: "Added" at once with undo, the same /api/shelf payload as
// before (cy: into depends on it), and the typed text kept when the write does not land.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/shelf" }));

import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import AddBox from "./AddBox";

let sent: Array<{ url: string; init: RequestInit }> = [];
let respond: () => Promise<Response>;

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  refresh.mockClear();
  try { window.localStorage.clear(); } catch { /* none */ }
  respond = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return respond();
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function fill(note = "") {
  render(<WriteQueueProvider><AddBox /></WriteQueueProvider>);
  fireEvent.change(screen.getByLabelText("What you're into"), { target: { value: "  Severance  " } });
  fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "show" } });
  if (note) fireEvent.change(screen.getByLabelText("Note"), { target: { value: note } });
  fireEvent.click(screen.getByRole("button", { name: "add to shelf" }));
}

const title = () => (screen.getByLabelText("What you're into") as HTMLInputElement).value;

describe("AddBox", () => {
  it("shows Added with undo at once, then sends the unchanged payload and refreshes", async () => {
    fill();
    expect(screen.getByText("Added")).toBeTruthy();
    expect(screen.getByRole("button", { name: "undo" })).toBeTruthy();
    await pass(5000);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("/api/shelf");
    expect(sent[0].init.method).toBe("POST");
    expect(sent[0].init.body).toBe(JSON.stringify({ title: "Severance", kind: "show", note: null }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(title()).toBe("");
  });

  it("a note goes through trimmed", async () => {
    fill("  the hallway music  ");
    await pass(5000);
    expect(sent[0].init.body).toBe(JSON.stringify({ title: "Severance", kind: "show", note: "the hallway music" }));
  });

  it("undo brings the box back with the text kept and sends nothing", async () => {
    fill();
    fireEvent.click(screen.getByRole("button", { name: "undo" }));
    expect(title()).toBe("  Severance  ");
    await pass(6000);
    expect(sent).toHaveLength(0);
  });

  it("a failure keeps the typed text and says Didn't save.", async () => {
    respond = async () => new Response("{}", { status: 502 });
    fill("why");
    await pass(5000);
    expect(screen.getByText("Didn't save.")).toBeTruthy();
    expect(title()).toBe("  Severance  ");
    expect((screen.getByLabelText("Note") as HTMLInputElement).value).toBe("why");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a second submit after a retryable failure supersedes the stored write: one item lands", async () => {
    respond = async () => new Response("{}", { status: 503 });
    fill();
    await pass(5000);
    expect(screen.getByText("Didn't save.")).toBeTruthy();
    respond = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    await pass(1);
    fireEvent.click(screen.getByRole("button", { name: "add to shelf" }));
    await pass(5000);
    expect(sent).toHaveLength(2);
    cleanup();
    // The next Hearth open: the provider's restore() sends whatever is still stored.
    render(<WriteQueueProvider><AddBox /></WriteQueueProvider>);
    await pass(100);
    expect(sent).toHaveLength(2);
    expect(window.localStorage.length).toBe(0);
  });

  it("a refusal (dropped) is not reused: the next add gets a fresh key", async () => {
    respond = async () => new Response(JSON.stringify({ error: "nope" }), { status: 400 });
    fill();
    await pass(5000);
    expect(window.localStorage.length).toBe(0);
  });

  it("a refusal shows Halseth's own words and keeps the text", async () => {
    respond = async () => new Response(JSON.stringify({ error: "title required" }), { status: 400 });
    fill();
    await pass(5000);
    expect(screen.getByText("title required")).toBeTruthy();
    expect(title()).toBe("  Severance  ");
  });
});
