// /library says so when Halseth cannot be reached, instead of looking like an empty shelf.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({ fetchBooksOrNull: vi.fn() }));
vi.mock("@/lib/halseth", () => m);
vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import LibraryPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("/library", () => {
  it("says Can't reach Halseth right now. when the fetch is null", async () => {
    m.fetchBooksOrNull.mockResolvedValue(null);
    const html = renderToStaticMarkup(await LibraryPage());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("no books yet");
  });
  it("says no books yet when Halseth answered with none", async () => {
    m.fetchBooksOrNull.mockResolvedValue([]);
    const html = renderToStaticMarkup(await LibraryPage());
    expect(html).toContain("no books yet");
    expect(html).not.toContain("Can&#x27;t reach");
  });
});
