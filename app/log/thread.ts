import type { CommonsPost } from "@/lib/halseth";

// Lives outside page.tsx on purpose: Next validates the export surface of a page file, so a helper
// exported from there for testing is a build error waiting to happen.

/** A post plus who it answers -- the flattened form the thread renders. */
export interface ThreadPost {
  post: CommonsPost;
  /** Author of the parent, when the parent is not the root of the thread. */
  answering: string | null;
}

/**
 * Every transitive descendant of `rootId`, oldest first.
 *
 * Flattened deliberately. The old /log render read `repliesByParent` only inside `roots.map`, so a
 * post whose parent was itself a reply was written, acked by the API, and then displayed NOWHERE --
 * and a reply to a companion's reply is exactly the reply Principal wants to write. A flat
 * chronological thread with "replied to X" lines also reads better under load than deep nesting.
 *
 * `visited` is shared across roots by the caller so one post can never render twice, and it doubles
 * as a cycle guard. reply_to is FK-validated at write time and a cycle shouldn't be constructible,
 * but an infinite loop here takes the whole page down -- cheap insurance, not a claim about cycles.
 */
export function collectThread(
  rootId: string,
  repliesByParent: Map<string, CommonsPost[]>,
  visited: Set<string>,
): ThreadPost[] {
  const out: ThreadPost[] = [];
  const walk = (parentId: string, parentAuthor: string | null) => {
    for (const child of repliesByParent.get(parentId) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      out.push({ post: child, answering: parentAuthor });
      walk(child.id, child.author);
    }
  };
  walk(rootId, null);
  return out.sort((a, b) => a.post.created_at.localeCompare(b.post.created_at));
}

/** Index every reply by its parent id, each bucket oldest-first. */
export function groupReplies(posts: CommonsPost[]): Map<string, CommonsPost[]> {
  const byParent = new Map<string, CommonsPost[]>();
  for (const p of posts) {
    if (!p.reply_to) continue;
    const arr = byParent.get(p.reply_to) ?? [];
    arr.push(p);
    byParent.set(p.reply_to, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return byParent;
}
