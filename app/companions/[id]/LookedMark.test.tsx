// LookedMark is the companion page's only write: on mount it queues one "looked" POST through the
// write queue and flushes at once. No DOM here, so useEffect runs inline during the server render.
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const submit = vi.fn();
const flush = vi.fn();
vi.mock("@/components/shell/WriteQueueProvider", () => ({ useWriteQueue: () => ({ submit, flush }) }));
vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return { ...real, useEffect: (fn: () => void) => { fn(); } };
});

import LookedMark from "./LookedMark";

describe("LookedMark", () => {
  it("submits one looked write for this companion, then flushes", () => {
    const html = renderToStaticMarkup(<LookedMark id="cypher" />);
    expect(html).toBe("");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ key: "looked:cypher", url: "/api/companions/cypher/looked", method: "POST" });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(submit.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0]);
  });
});
