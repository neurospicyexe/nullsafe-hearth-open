// @vitest-environment jsdom
// RecommendForm through the real write queue: confirm at once, undo in grace, keep the fields and
// say Halseth's own words on a refusal.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/club" }));

import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import RecommendForm from "./RecommendForm";

let sent: RequestInit[] = [];
let respond: () => Promise<Response>;

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  refresh.mockClear();
  try { window.localStorage.clear(); } catch { /* none */ }
  respond = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(init);
    return respond();
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function fill() {
  render(<WriteQueueProvider><RecommendForm roundId="r1" /></WriteQueueProvider>);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Moss" } });
  fireEvent.click(screen.getByRole("button", { name: "Recommend" }));
}

describe("RecommendForm", () => {
  it("confirms at once, sends after the grace window and refreshes", async () => {
    fill();
    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByRole("button", { name: "undo" })).toBeTruthy();
    await pass(5000);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String(sent[0].body))).toMatchObject({ title: "Moss", media_kind: "other" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("undo brings the form back with the title kept", async () => {
    fill();
    fireEvent.click(screen.getByRole("button", { name: "undo" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Moss");
    await pass(6000);
    expect(sent).toHaveLength(0);
  });

  it("a refusal shows Halseth's words and keeps the fields", async () => {
    respond = async () => new Response(JSON.stringify({ error: "round is not gathering" }), { status: 409 });
    fill();
    await pass(5000);
    expect(screen.getByText("round is not gathering")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Moss");
  });

  it("a server error says Didn't save. and keeps the fields", async () => {
    respond = async () => new Response("{}", { status: 503 });
    fill();
    await pass(5000);
    expect(screen.getByText("Didn't save.")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Moss");
  });
});
