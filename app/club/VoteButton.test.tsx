// @vitest-environment jsdom
// VoteButton under the real WriteQueueProvider and one round's ClubVoteProvider, rendered by React
// into jsdom. Fake timers drive the 5s grace window; fetch is stubbed so the wire can be read.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/club" }));

import { WriteQueueProvider } from "@/components/shell/WriteQueueProvider";
import { ClubVoteProvider } from "./ClubVote";
import VoteButton from "./VoteButton";

type Sent = { url: string; init: RequestInit };
let sent: Sent[] = [];
let respond: () => Promise<Response>;

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  refresh.mockClear();
  try { window.localStorage.clear(); } catch { /* none */ }
  respond = json(200, { ok: true });
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

/** Picks a and b in round r1, with Principal's committed vote on `serverPick`. */
function round(serverPick: string | null) {
  render(
    <WriteQueueProvider>
      <ClubVoteProvider serverPick={serverPick}>
        <div data-testid="a"><VoteButton roundId="r1" recommendationId="a" voted={serverPick === "a"} /></div>
        <div data-testid="b"><VoteButton roundId="r1" recommendationId="b" voted={serverPick === "b"} /></div>
      </ClubVoteProvider>
    </WriteQueueProvider>,
  );
  return { a: within(screen.getByTestId("a")), b: within(screen.getByTestId("b")) };
}

const tap = (scope: ReturnType<typeof within>, name: string) => fireEvent.click(scope.getByRole("button", { name }));
const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const bodies = () => sent.map((s) => ({ method: s.init.method, body: JSON.parse(String(s.init.body)) }));

describe("VoteButton", () => {
  it("shows the committed vote with Remove vote, and Vote for this elsewhere", () => {
    const { a, b } = round("a");
    expect(a.getByText("Your vote")).toBeTruthy();
    expect(a.getByRole("button", { name: "Remove vote" })).toBeTruthy();
    expect(b.getByRole("button", { name: "Vote for this" })).toBeTruthy();
    expect(b.queryByText("Your vote")).toBeNull();
  });

  it("changing a committed vote takes the mark off A at once and sends only B", async () => {
    const { a, b } = round("a");
    tap(b, "Vote for this");
    expect(b.getByText("Voted")).toBeTruthy();
    expect(b.getByRole("button", { name: "undo" })).toBeTruthy();
    expect(a.queryByText("Your vote")).toBeNull();
    expect(a.queryByRole("button", { name: "Remove vote" })).toBeNull();
    expect(a.getByRole("button", { name: "Vote for this" })).toBeTruthy();
    expect(sent).toHaveLength(0);
    await pass(5000);
    expect(bodies()).toEqual([{ method: "POST", body: { recommendation_id: "b" } }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(b.getByText("Your vote")).toBeTruthy(); // kept until fresh page data arrives
    expect(a.queryByText("Your vote")).toBeNull();
  });

  it("A then B inside the grace window: A reverts and only B is sent", async () => {
    const { a, b } = round(null);
    tap(a, "Vote for this");
    expect(a.getByText("Voted")).toBeTruthy();
    tap(b, "Vote for this");
    expect(a.queryByText("Voted")).toBeNull();
    expect(a.getByRole("button", { name: "Vote for this" })).toBeTruthy();
    await pass(5000);
    expect(bodies()).toEqual([{ method: "POST", body: { recommendation_id: "b" } }]);
  });

  it("undo after a change puts the previous pick back on every button and sends nothing", async () => {
    const { a, b } = round("a");
    tap(b, "Vote for this");
    tap(b, "undo");
    expect(a.getByText("Your vote")).toBeTruthy();
    expect(b.getByRole("button", { name: "Vote for this" })).toBeTruthy();
    await pass(6000);
    expect(sent).toHaveLength(0);
  });

  it("remove then undo keeps the vote and sends nothing", async () => {
    const { a } = round("a");
    tap(a, "Remove vote");
    expect(a.getByText("Vote removed")).toBeTruthy();
    tap(a, "undo");
    expect(a.getByText("Your vote")).toBeTruthy();
    await pass(6000);
    expect(sent).toHaveLength(0);
  });

  it("Remove vote sends DELETE with an empty body", async () => {
    const { a } = round("a");
    tap(a, "Remove vote");
    await pass(5000);
    expect(bodies()).toEqual([{ method: "DELETE", body: {} }]);
    expect(a.getByRole("button", { name: "Vote for this" })).toBeTruthy();
  });

  it("undo leaves once the write is sent, before Halseth answers", async () => {
    respond = () => new Promise<Response>(() => {}); // Halseth never answers
    const { b } = round("a");
    tap(b, "Vote for this");
    expect(b.getByRole("button", { name: "undo" })).toBeTruthy();
    await pass(4900);
    expect(b.getByRole("button", { name: "undo" })).toBeTruthy();
    await pass(400);
    expect(sent).toHaveLength(1);
    expect(b.queryByRole("button", { name: "undo" })).toBeNull();
    expect(b.getByText("Your vote")).toBeTruthy();
  });

  it("a 409 says voting has closed, offers no control, and restores the previous pick", async () => {
    respond = json(409, { error: "no round is accepting votes" });
    const { a, b } = round("a");
    tap(b, "Vote for this");
    await pass(5000);
    expect(b.getByText("Voting has closed.")).toBeTruthy();
    expect(b.queryByRole("button")).toBeNull();
    expect(a.getByText("Your vote")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("another refusal shows Halseth's own words and keeps the control", async () => {
    respond = json(400, { error: "no voting for your own pick" });
    const { b } = round(null);
    tap(b, "Vote for this");
    await pass(5000);
    expect(b.getByText("no voting for your own pick")).toBeTruthy();
    expect(b.getByRole("button", { name: "Vote for this" })).toBeTruthy();
  });

  it("a server error says Didn't save.", async () => {
    respond = json(503, { error: "upstream" });
    const { b } = round(null);
    tap(b, "Vote for this");
    await pass(5000);
    expect(b.getByText("Didn't save.")).toBeTruthy();
    expect(b.getByRole("button", { name: "Vote for this" })).toBeTruthy();
  });
});
