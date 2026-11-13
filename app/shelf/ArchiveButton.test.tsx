// @vitest-environment jsdom
// ArchiveButton through the real write queue: Archived at once with undo, the unchanged PATCH body.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/shelf" }));

import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import ArchiveButton from "./ArchiveButton";

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

describe("ArchiveButton", () => {
  it("shows Archived with undo, then sends the unchanged PATCH and refreshes", async () => {
    render(<WriteQueueProvider><ArchiveButton id="o1" /></WriteQueueProvider>);
    fireEvent.click(screen.getByRole("button", { name: "archive" }));
    expect(screen.getByText("Archived")).toBeTruthy();
    expect(screen.getByRole("button", { name: "undo" })).toBeTruthy();
    await pass(5000);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("/api/shelf");
    expect(sent[0].init.method).toBe("PATCH");
    expect(sent[0].init.body).toBe(JSON.stringify({ id: "o1", status: "archived" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("undo keeps the item and sends nothing", async () => {
    render(<WriteQueueProvider><ArchiveButton id="o1" /></WriteQueueProvider>);
    fireEvent.click(screen.getByRole("button", { name: "archive" }));
    fireEvent.click(screen.getByRole("button", { name: "undo" }));
    expect(screen.getByRole("button", { name: "archive" })).toBeTruthy();
    await pass(6000);
    expect(sent).toHaveLength(0);
  });

  it("a tap after a retryable failure supersedes the stored write (stable key): one archive lands", async () => {
    respond = async () => new Response("{}", { status: 503 });
    const view = render(<WriteQueueProvider><ArchiveButton id="o1" /></WriteQueueProvider>);
    fireEvent.click(screen.getByRole("button", { name: "archive" }));
    await pass(5000);
    respond = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    fireEvent.click(screen.getByRole("button", { name: "archive" }));
    await pass(5000);
    expect(sent).toHaveLength(2);
    view.unmount();
    render(<WriteQueueProvider><ArchiveButton id="o1" /></WriteQueueProvider>);
    await pass(100);
    expect(sent).toHaveLength(2);
    expect(window.localStorage.length).toBe(0);
  });

  it("a failure brings the control back and says Didn't save.", async () => {
    respond = async () => new Response("{}", { status: 503 });
    render(<WriteQueueProvider><ArchiveButton id="o1" /></WriteQueueProvider>);
    fireEvent.click(screen.getByRole("button", { name: "archive" }));
    await pass(5000);
    expect(screen.getByText("Didn't save.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "archive" })).toBeTruthy();
  });
});
