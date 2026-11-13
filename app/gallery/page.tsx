import { fetchCompanionImages } from "@/lib/halseth";
import type { ToolCall } from "@/lib/halseth";
import { imagePrompt } from "@/lib/companion-page";
import { memberClass } from "@/lib/kit";

export const dynamic = "force-dynamic";

const COMPANIONS = ["cypher", "drevan", "gaia"] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function ImageCard({ call }: { call: ToolCall }) {
  const prompt = imagePrompt(call.args_summary);
  return (
    <li>
      <figure className="h-made-item">
        {/* eslint-disable-next-line @next/next/no-img-element -- R2-served generated art, no Next loader */}
        <img src={`/api/mind/tools/image/${call.id}`} alt={prompt} loading="lazy" className="h-made-img" />
        <figcaption className="h-made-caption">
          <q>{prompt}</q>
          <span className="h-rooms-age"> {formatTime(call.created_at)}</span>
        </figcaption>
      </figure>
    </li>
  );
}

export default async function GalleryPage() {
  const perCompanion = await Promise.all(COMPANIONS.map((c) => fetchCompanionImages(c, 40)));
  const sections = COMPANIONS.map((id, i) => ({ id, images: perCompanion[i] }));
  const reached = sections.filter((s) => s.images !== null);
  const total = reached.reduce((n, s) => n + (s.images?.length ?? 0), 0);
  const unreached = sections.filter((s) => s.images === null);

  return (
    <div className="h-rooms">
      <h1 className="h-page-title">Gallery</h1>
      {reached.length === 0 ? (
        <p className="h-rooms-quiet">Can&apos;t reach Halseth right now.</p>
      ) : (
        <>
          <p className="h-rooms-lede">images the triad has generated · {total} so far</p>
          {unreached.map((s) => (
            <p key={s.id} className="h-rooms-quiet">Can&apos;t load {s.id}&apos;s images right now.</p>
          ))}
          {total === 0 ? (
            <p className="h-rooms-quiet">
              Nothing made yet. A companion makes one with <code>cy: imagine &lt;prompt&gt;</code> (once Principal
              flips their <code>tools_enabled</code> gate).
            </p>
          ) : (
            reached.filter((s) => (s.images?.length ?? 0) > 0).map(({ id, images }) => (
              <section key={id} className="h-rooms-section">
                <h2 className={`h-rooms-h2 ${memberClass(id)}`}>
                  {id} <span className="h-rooms-count">({images!.length})</span>
                </h2>
                <ul className="h-made-grid">
                  {images!.map((call) => <ImageCard key={call.id} call={call} />)}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
