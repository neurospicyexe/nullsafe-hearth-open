// The Shelf page's honesty about Halseth: unreachable is said, never shown as an empty shelf.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CommonsPost, Obsession } from "@/lib/halseth";

let items: Obsession[] | null = null;
let posts: CommonsPost[] | null = null;
vi.mock("@/lib/halseth", () => ({
  fetchObsessionsOrNull: async () => items,
  fetchCommonsPostsOrNull: async () => posts,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/shelf" }));
vi.mock("@/components/shell/WriteQueueProvider", () => ({ useWriteQueue: () => ({ submit: vi.fn(), flush: vi.fn() }) }));

import ShelfPage from "./page";

const item: Obsession = {
  id: "o1", title: "Severance", kind: "show", note: "the hallway music", status: "active",
  created_at: "2026-10-30T00:00:00Z", updated_at: "2026-10-30T00:00:00Z",
};

beforeEach(() => {
  items = null;
  posts = null;
});

describe("ShelfPage", () => {
  it("Halseth down reads Can't reach Halseth right now., not an empty shelf", async () => {
    const html = renderToStaticMarkup(await ShelfPage());
    expect(html).toContain("Can&#x27;t reach Halseth right now.");
    expect(html).not.toContain("nothing on your shelf yet");
  });

  it("a successful empty read says nothing on your shelf yet", async () => {
    items = [];
    const html = renderToStaticMarkup(await ShelfPage());
    expect(html).toContain("nothing on your shelf yet");
  });

  it("an item shows its note, archive control and the reaction thread", async () => {
    items = [item];
    posts = [{ id: "p1", author: "drevan", context: "shelf:o1", body: "the goats", reply_to: null, created_at: "2026-10-30T00:00:00Z" }];
    const html = renderToStaticMarkup(await ShelfPage());
    expect(html).toContain("Severance");
    expect(html).toContain("the hallway music");
    expect(html).toContain("archive");
    expect(html).toContain("the goats");
    expect(html).toContain("is-drevan");
  });

  it("reactions that failed to load are said, not shown as none", async () => {
    items = [item];
    const html = renderToStaticMarkup(await ShelfPage());
    expect(html).toContain("Couldn&#x27;t load reactions.");
    expect(html).not.toContain("no reactions yet");
  });
});
