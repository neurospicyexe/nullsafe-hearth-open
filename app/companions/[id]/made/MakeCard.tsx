import type { Make } from "@/lib/halseth";
import { ageLabel } from "@/lib/home-model";
import { kindLabel, inlineImage, makeLinks, makeRecipe, makeUrl, playerUrl } from "@/lib/makes";
import MakePlayer from "./MakePlayer";
import ExpandText from "@/components/kit/ExpandText";

// One make on the shelf. Rendering rules: raster images through the inline proxy (an SVG drawing shows
// its PNG, never its source), media in native controls, writing as escaped text, and companion HTML /
// Strudel only behind a click, framed from their own CSP-locked routes. `source` is the text of a writing.
// Downloads open in a new tab: Hearth installs as a standalone app (manifest display: standalone), where a
// file opened in the same view has no back button and strands you outside Hearth (found 11-11).
export default function MakeCard({ make, source, now }: { make: Make; source: string | null; now: Date }) {
  const age = ageLabel(make.created_at, now);
  const links = makeLinks(make);
  const img = inlineImage(make);
  const ready = make.status === "ready";
  const recipe = makeRecipe(make);

  return (
    <li id={`make-${make.id}`} className="h-make" data-kind={make.kind} data-status={make.status}>
      <div className="h-make-head">
        <span className="h-make-kind">{kindLabel(make)}</span>
        <h2 className="h-make-title">{make.title}</h2>
      </div>

      {make.status === "pending" && <p className="h-companion-quiet">Still being made.</p>}
      {make.status === "failed" && (
        <p className="h-msg is-warn">
          Didn&apos;t come out{make.fail_reason ? `: ${make.fail_reason}` : "."}
        </p>
      )}

      {img && (
        // eslint-disable-next-line @next/next/no-img-element -- R2-served art through the proxy, no Next loader
        <img src={img} alt={make.title} loading="lazy" className="h-make-img" />
      )}
      {ready && make.kind === "music_audio" && make.files.file && (
        <audio controls preload="none" src={makeUrl(make.id, "file", true)} className="h-make-media" />
      )}
      {ready && make.kind === "video" && make.files.file && (
        <video controls playsInline preload="metadata" src={makeUrl(make.id, "file", true)} className="h-make-video" />
      )}
      {ready && make.kind === "writing" && (
        <ExpandText as="pre" mode="block" limit={900} className="h-make-text" text={source ?? "The text could not be loaded."} />
      )}
      {ready && make.kind === "page" && <MakePlayer title={make.title} src={playerUrl("page", make.id)} label="open it" />}
      {ready && make.kind === "music_code" && (
        <MakePlayer title={make.title} src={playerUrl("music_code", make.id)} label="play" />
      )}

      {(links.download || links.source) && (
        <div className="h-make-actions">
          {links.download && (
            <a className="h-btn is-primary is-outlined h-make-dl" href={links.download.href} download target="_blank" rel="noopener">
              {links.download.label}
            </a>
          )}
          {links.source && (
            <a className="h-btn h-make-dl" href={links.source.href} download target="_blank" rel="noopener">
              {links.source.label}
            </a>
          )}
        </div>
      )}

      {make.why && <p className="h-make-why">{make.why}</p>}
      {recipe && (
        <details className="h-make-how">
          <summary>How it was made</summary>
          <p className="h-make-how-line">{recipe.line}</p>
          {recipe.prompt && (
            <blockquote className="h-make-how-prompt">
              <span className="h-make-label">{make.kind === "image" ? "described as" : "the description"}</span>
              {recipe.prompt}
            </blockquote>
          )}
          {recipe.lyrics && (
            <blockquote className="h-make-how-prompt">
              <span className="h-make-label">lyrics</span>
              {recipe.lyrics}
            </blockquote>
          )}
          {recipe.facts.length > 0 && <p className="h-make-meta">{recipe.facts.map((f) => <span key={f}>{f}</span>)}</p>}
          {recipe.showsCode && (
            <>
              <span className="h-make-label">{recipe.codeLabel}</span>
              <pre className="h-make-code">{source ?? "The code could not be loaded."}</pre>
            </>
          )}
        </details>
      )}
      {make.heard_back && <p className="h-make-heard"><span className="h-make-label">heard back</span> {make.heard_back}</p>}
      <p className="h-make-meta">
        {make.interest_name && <span>for {make.interest_name}</span>}
        {make.version > 1 && <span>version {make.version}</span>}
        {age && <span>{age}</span>}
      </p>
    </li>
  );
}
