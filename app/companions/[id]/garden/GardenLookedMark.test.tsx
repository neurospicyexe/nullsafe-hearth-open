// GardenLookedMark is the garden page's only write: on mount it queues one "looked" POST and flushes at once.
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const submit = vi.fn();
const flush = vi.fn();
vi.mock("@/components/shell/WriteQueueProvider", () => ({ useWriteQueue: () => ({ submit, flush }) }));
vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return { ...real, useEffect: (fn: () => void) => { fn(); } };
});

import GardenLookedMark from "./GardenLookedMark";

describe("GardenLookedMark", () => {
  it("submits one garden looked write, then flushes", () => {
    const html = renderToStaticMarkup(<GardenLookedMark />);
    expect(html).toBe("");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ key: "looked:garden:gaia", url: "/api/garden/looked", method: "POST" });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(submit.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0]);
  });
});
