import Link from "next/link";
import type { RecentMake } from "@/lib/makes";
import { toneOf } from "@/lib/tone";
import { ageLabel } from "@/lib/home-model";

// Home strip: what they made lately, each line opening that piece on the maker's Made shelf. Renders
// nothing when there is nothing recent.
export default function RecentMakes({ makes, now }: { makes: RecentMake[]; now: Date }) {
  if (makes.length === 0) return null;
  return (
    <section aria-label="Made lately" className="h-home-section">
      <h2 className="h-home-h2">Made lately</h2>
      <ul className="h-think-list">
        {makes.map((m) => {
          const age = ageLabel(m.at, now);
          return (
            <li key={m.key} className="h-think-line">
              <b className={`h-think-name ${toneOf(m.companion)}`}>{m.name}</b> made a {m.kind}:{" "}
              <Link href={m.href} className="h-think-made">{m.title}</Link>
              {age && <span className="h-think-age"> {age}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
