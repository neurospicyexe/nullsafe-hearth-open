import Link from "next/link";
import type { NeedsStripModel } from "@/lib/home-model";

/** "N things need you ›" to /needs, with the newest two. Hidden at zero (the model is null). */
export default function NeedsStrip({ model }: { model: NeedsStripModel | null }) {
  if (!model) return null;
  return (
    <Link href="/needs" className="h-needs-strip" aria-label={model.headline}>
      <span className="h-needs-strip-top">
        <span>{model.headline}</span>
        <span aria-hidden="true">›</span>
      </span>
      <ul className="h-needs-strip-items">
        {model.items.map((i) => (
          <li key={i.key}>
            <span>{i.who}{i.text ? `: ${i.text}` : ""}</span>
            {i.when && <span>{i.when}</span>}
          </li>
        ))}
      </ul>
    </Link>
  );
}
