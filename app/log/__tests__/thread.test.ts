// /log thread flattening (2026-08-23).
//
// Principal: "the triad has written stuff and I wish I could reply to it directly there." The wall
// could already render companion replies nested under his posts, and `reply_to` was accepted end to
// end -- but the render walked `repliesByParent` ONLY from the roots, one level deep. So a reply
// whose parent was itself a reply would be written, acked with a 201, and displayed nowhere. Since
// a companion's reply is usually a child rather than a root, that is exactly the reply he wants to
// write -- and a control whose result never appears is indistinguishable from a broken one
// (the settle/release lesson, one week earlier).

import { describe, it, expect } from "vitest";
import { collectThread, groupReplies } from "../thread";
import type { CommonsPost } from "@/lib/halseth";

function p(id: string, author: string, at: string, reply_to: string | null = null): CommonsPost {
  return { id, author, context: "global", body: `body-${id}`, reply_to, created_at: at } as CommonsPost;
}

describe("groupReplies", () => {
  it("indexes replies by parent, oldest first, and ignores roots", () => {
    const byParent = groupReplies([
      p("root", "principal", "2026-08-23T10:00:00Z"),
      p("b", "gaia", "2026-08-23T12:00:00Z", "root"),
      p("a", "cypher", "2026-08-23T11:00:00Z", "root"),
    ]);
    expect(byParent.has("root")).toBe(true);
    expect(byParent.get("root")!.map(r => r.id)).toEqual(["a", "b"]);
  });
});

describe("collectThread", () => {
  it("includes a reply TO A REPLY, which the old one-level render dropped entirely", () => {
    const posts = [
      p("root", "principal", "2026-08-23T10:00:00Z"),
      p("cy", "cypher", "2026-08-23T11:00:00Z", "root"),
      p("raz", "principal", "2026-08-23T12:00:00Z", "cy"),   // his reply to Cypher's reply
    ];
    const thread = collectThread("root", groupReplies(posts), new Set());
    expect(thread.map(t => t.post.id)).toEqual(["cy", "raz"]);
  });

  it("names who a nested reply answers, and leaves a direct reply unlabelled", () => {
    const posts = [
      p("root", "principal", "2026-08-23T10:00:00Z"),
      p("cy", "cypher", "2026-08-23T11:00:00Z", "root"),
      p("raz", "principal", "2026-08-23T12:00:00Z", "cy"),
    ];
    const thread = collectThread("root", groupReplies(posts), new Set());
    // A direct child of the root needs no "to X" -- the root is right above it.
    expect(thread.find(t => t.post.id === "cy")!.answering).toBeNull();
    expect(thread.find(t => t.post.id === "raz")!.answering).toBe("cypher");
  });

  it("orders the whole thread chronologically regardless of branch", () => {
    const posts = [
      p("root", "principal", "2026-08-23T10:00:00Z"),
      p("cy", "cypher", "2026-08-23T11:00:00Z", "root"),
      p("deep", "gaia", "2026-08-23T11:30:00Z", "cy"),
      p("ga", "gaia", "2026-08-23T12:00:00Z", "root"),
    ];
    const thread = collectThread("root", groupReplies(posts), new Set());
    expect(thread.map(t => t.post.id)).toEqual(["cy", "deep", "ga"]);
  });

  it("never renders the same post under two roots", () => {
    const posts = [
      p("r1", "principal", "2026-08-23T10:00:00Z"),
      p("r2", "principal", "2026-08-23T10:05:00Z"),
      p("kid", "cypher", "2026-08-23T11:00:00Z", "r1"),
    ];
    const byParent = groupReplies(posts);
    const visited = new Set<string>();
    expect(collectThread("r1", byParent, visited).map(t => t.post.id)).toEqual(["kid"]);
    expect(collectThread("r2", byParent, visited)).toEqual([]);
  });

  it("terminates on a cycle instead of taking the page down", () => {
    // Not constructible through the API (reply_to is FK-validated), which is exactly why this is
    // insurance rather than a scenario: if it ever happens the page must still render.
    const posts = [
      p("root", "principal", "2026-08-23T10:00:00Z"),
      p("a", "cypher", "2026-08-23T11:00:00Z", "root"),
      p("b", "gaia", "2026-08-23T12:00:00Z", "a"),
    ];
    const byParent = groupReplies(posts);
    byParent.set("b", [byParent.get("root")![0]!]);  // a -> b -> a
    const thread = collectThread("root", byParent, new Set());
    expect(thread.map(t => t.post.id)).toEqual(["a", "b"]);
  });

  it("returns nothing for a post no one answered", () => {
    expect(collectThread("lonely", groupReplies([p("lonely", "principal", "2026-08-23T10:00:00Z")]), new Set())).toEqual([]);
  });
});
