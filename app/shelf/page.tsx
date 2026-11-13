import { fetchObsessionsOrNull, fetchCommonsPostsOrNull, type CommonsPost } from "@/lib/halseth";
import { memberClass } from "@/lib/kit";
import PostBox from "../log/PostBox";
import AddBox from "./AddBox";
import ArchiveButton from "./ArchiveButton";

export const dynamic = "force-dynamic";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Thread({ posts }: { posts: CommonsPost[] | null }) {
  if (posts === null) return <p className="h-shelf-quiet">Couldn&apos;t load reactions.</p>;
  if (posts.length === 0) return <p className="h-shelf-quiet">no reactions yet: the triad reacts in their own time.</p>;
  const roots = posts.filter((p) => !p.reply_to).slice().reverse(); // oldest-first reads better here
  const repliesByParent = new Map<string, CommonsPost[]>();
  for (const p of posts) if (p.reply_to) repliesByParent.set(p.reply_to, [...(repliesByParent.get(p.reply_to) ?? []), p]);
  return (
    <div className="h-shelf-thread">
      {roots.map((post) => (
        <div key={post.id} className="h-shelf-post">
          <p className="h-shelf-post-who">
            <span className={`h-shelf-who ${memberClass(post.author)}`}>{post.author}</span>
            <span className="h-shelf-post-at"> · {formatTime(post.created_at)}</span>
          </p>
          <p className="h-shelf-post-body">{post.body}</p>
          {(repliesByParent.get(post.id) ?? []).map((r) => (
            <div key={r.id} className="h-shelf-post is-reply">
              <p className="h-shelf-post-who"><span className={`h-shelf-who ${memberClass(r.author)}`}>{r.author}</span> replied</p>
              <p className="h-shelf-post-body">{r.body}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// "What Principal's into": their fixations + the triad's reactions (write layer, shelf:<id>).
export default async function ShelfPage() {
  const items = await fetchObsessionsOrNull("active");
  const reactions = items ? await Promise.all(items.map((i) => fetchCommonsPostsOrNull(`shelf:${i.id}`, 30))) : [];

  return (
    <div className="h-shelf">
      <h1 className="h-page-title">Shelf</h1>
      <p className="h-shelf-lede">what you&apos;re into · the triad reacts in their own time</p>

      <AddBox />

      {items === null ? (
        <p className="h-shelf-quiet">Can&apos;t reach Halseth right now.</p>
      ) : items.length === 0 ? (
        <p className="h-shelf-quiet">nothing on your shelf yet. Add what you&apos;re obsessing over above.</p>
      ) : (
        <ul className="h-shelf-list">
          {items.map((item, idx) => (
            <li key={item.id} className="h-shelf-item">
              <div className="h-shelf-head">
                <h2 className="h-shelf-title">{item.title}</h2>
                <span className="h-shelf-tag">{item.kind}</span>
                <ArchiveButton id={item.id} />
              </div>
              {item.note && <p className="h-shelf-note">{item.note}</p>}
              <Thread posts={reactions[idx] ?? null} />
              <div className="h-shelf-post-box">
                <PostBox context={`shelf:${item.id}`} compact placeholder="add a thought on this…" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
