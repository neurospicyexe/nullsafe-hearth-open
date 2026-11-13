// @vitest-environment jsdom
// PostBox through the real write queue: "Posted" at once with undo, the unchanged /api/commons
// payload, and the typed text kept when the write does not land.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/log" }));

import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import PostBox from "./PostBox";

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
const text = () => (screen.getByLabelText("Your thought") as HTMLTextAreaElement).value;

function post(props: { context?: string; replyTo?: string | null } = {}) {
  render(<WriteQueueProvider><PostBox {...props} /></WriteQueueProvider>);
  fireEvent.change(screen.getByLabelText("Your thought"), { target: { value: "  a half-idea  " } });
  fireEvent.click(screen.getByRole("button", { name: props.replyTo ? "reply" : "post" }));
}

describe("PostBox", () => {
  it("confirms Posted with undo at once, then sends the unchanged payload and refreshes", async () => {
    post({ context: "club:r1" });
    expect(screen.getByText("Posted")).toBeTruthy();
    expect(screen.getByRole("button", { name: "undo" })).toBeTruthy();
    await pass(5000);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("/api/commons");
    expect(sent[0].init.method).toBe("POST");
    expect(sent[0].init.body).toBe(JSON.stringify({ body: "a half-idea", context: "club:r1", reply_to: null }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(text()).toBe("");
  });

  it("a reply carries reply_to and the default context", async () => {
    post({ replyTo: "p9" });
    await pass(5000);
    expect(sent[0].init.body).toBe(JSON.stringify({ body: "a half-idea", context: "global", reply_to: "p9" }));
  });

  it("undo brings the box back with the text kept and sends nothing", async () => {
    post();
    fireEvent.click(screen.getByRole("button", { name: "undo" }));
    expect(text()).toBe("  a half-idea  ");
    await pass(6000);
    expect(sent).toHaveLength(0);
  });

  it("a 503 keeps the text, says Didn't save., and a second submit lands once", async () => {
    respond = async () => new Response("{}", { status: 503 });
    post();
    await pass(5000);
    expect(screen.getByText("Didn't save.")).toBeTruthy();
    expect(text()).toBe("  a half-idea  ");
    expect(refresh).not.toHaveBeenCalled();
    respond = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    await pass(1);
    fireEvent.click(screen.getByRole("button", { name: "post" }));
    await pass(5000);
    expect(sent).toHaveLength(2);
    expect(text()).toBe("");
    cleanup();
    // The next Hearth open: restore() finds nothing left to resend.
    render(<WriteQueueProvider><PostBox /></WriteQueueProvider>);
    await pass(100);
    expect(sent).toHaveLength(2);
    expect(window.localStorage.length).toBe(0);
  });

  it("a refusal shows Halseth's own words and keeps the text", async () => {
    respond = async () => new Response(JSON.stringify({ error: "body required" }), { status: 400 });
    post();
    await pass(5000);
    expect(screen.getByText("body required")).toBeTruthy();
    expect(text()).toBe("  a half-idea  ");
  });
});
