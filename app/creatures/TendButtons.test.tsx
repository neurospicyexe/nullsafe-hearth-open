// @vitest-environment jsdom
// TendButtons through the real write queue: each tend confirms at once in the past tense, can be
// undone in the grace window, keeps the words on a failure and refreshes when it lands.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/creatures" }));

import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import TendButtons from "./TendButtons";

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

function mount() {
  render(<WriteQueueProvider><TendButtons creatureId="sol" /></WriteQueueProvider>);
}

describe("TendButtons", () => {
  it("renders the four tends as buttons", () => {
    mount();
    for (const a of ["feed", "play", "talk", "give"]) {
      expect(screen.getByRole("button", { name: a })).toBeTruthy();
    }
  });

  it.each([
    ["feed", "Fed"],
    ["play", "Played"],
    ["talk", "Talked"],
    ["give", "Gave"],
  ])("a %s tap confirms as %s with undo, then sends and refreshes", async (action, past) => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(screen.getByRole("button", { name: past })).toBeTruthy();
    expect(screen.getByRole("button", { name: `undo ${action}` })).toBeTruthy();
    await pass(5000);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("/api/creatures/sol");
    expect(sent[0].init.method).toBe("POST");
    expect(JSON.parse(String(sent[0].init.body))).toEqual({ action });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: `undo ${action}` })).toBeNull();
  });

  it("undo cancels the tend before it is sent", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    fireEvent.click(screen.getByRole("button", { name: "undo feed" }));
    expect(screen.getByRole("button", { name: "feed" })).toBeTruthy();
    await pass(6000);
    expect(sent).toHaveLength(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("two taps are two tends; undo takes back only the newest", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    await pass(1);
    fireEvent.click(screen.getByRole("button", { name: "Fed" }));
    fireEvent.click(screen.getByRole("button", { name: "undo feed" }));
    await pass(6000);
    expect(sent).toHaveLength(1);
  });

  it("a give with words carries the note, and the note clears once it lands", async () => {
    mount();
    const box = screen.getByLabelText("With words") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "  a blue button  " } });
    fireEvent.click(screen.getByRole("button", { name: "give" }));
    await pass(5000);
    expect(JSON.parse(String(sent[0].init.body))).toEqual({ action: "give", note: "a blue button" });
    expect(box.value).toBe("");
  });

  it("a failure keeps the words and says Didn't save.", async () => {
    respond = async () => new Response("{}", { status: 503 });
    mount();
    const box = screen.getByLabelText("With words") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "talk" }));
    await pass(5000);
    expect(screen.getByText("Didn't save.")).toBeTruthy();
    expect(box.value).toBe("hello");
    expect(screen.getByRole("button", { name: "talk" })).toBeTruthy();
  });

  it("a second tap after a retryable failure supersedes the stored write: one tend lands", async () => {
    respond = async () => new Response("{}", { status: 503 });
    const view = render(<WriteQueueProvider><TendButtons creatureId="sol" /></WriteQueueProvider>);
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    await pass(5000);
    expect(screen.getByText("Didn't save.")).toBeTruthy();
    respond = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    await pass(1);
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    await pass(5000);
    expect(sent).toHaveLength(2);
    view.unmount();
    // The next Hearth open: the provider's restore() sends whatever is still stored.
    render(<WriteQueueProvider><TendButtons creatureId="sol" /></WriteQueueProvider>);
    await pass(100);
    expect(sent).toHaveLength(2);
    expect(window.localStorage.length).toBe(0);
  });

  it("a failed tend left alone is retried once on the next open", async () => {
    respond = async () => new Response("{}", { status: 503 });
    const view = render(<WriteQueueProvider><TendButtons creatureId="sol" /></WriteQueueProvider>);
    fireEvent.click(screen.getByRole("button", { name: "play" }));
    await pass(5000);
    view.unmount();
    respond = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    render(<WriteQueueProvider><TendButtons creatureId="sol" /></WriteQueueProvider>);
    await pass(100);
    expect(sent).toHaveLength(2);
    expect(JSON.parse(String(sent[1].init.body))).toEqual({ action: "play" });
  });

  it("a refusal shows Halseth's own words", async () => {
    respond = async () => new Response(JSON.stringify({ error: "creature not found" }), { status: 404 });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "play" }));
    await pass(5000);
    expect(screen.getByText("creature not found")).toBeTruthy();
  });

  it("a milestone fired by the tend stays on screen as written", async () => {
    respond = async () =>
      new Response(JSON.stringify({ milestones_fired: [{ text: "He lands on your hand." }] }), { status: 200 });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    await pass(5000);
    expect(screen.getByRole("status").textContent).toBe("✦ He lands on your hand.");
  });
});
