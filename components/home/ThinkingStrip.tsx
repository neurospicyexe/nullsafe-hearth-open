import Link from "next/link";
import type { ThinkingLine } from "@/lib/thinking";
import { toneOf } from "@/lib/tone";
import { ageLabel } from "@/lib/home-model";
import { MADE_LINK_TEXT } from "@/lib/thinking";

/** One thinking line: the name carries the companion hue, the sentence stays in ink. */
export function ThinkingLineItem({ line, now }: { line: ThinkingLine; now: Date }) {
  const age = ageLabel(line.at, now);
  const subject = line.href ? (
    <Link href={line.href} className="h-think-subject">{line.subject}</Link>
  ) : (
    <b className="h-think-subject">{line.subject}</b>
  );
  // "made something" opens the maker's Made shelf; the interest it came from stays on the subject.
  const verb =
    line.madeHref && line.verb.startsWith(MADE_LINK_TEXT) ? (
      <>
        <Link href={line.madeHref} className="h-think-made">{MADE_LINK_TEXT}</Link>
        {line.verb.slice(MADE_LINK_TEXT.length)}
      </>
    ) : (
      line.verb
    );
  return (
    <li className="h-think-line">
      <b className={`h-think-name ${toneOf(line.companion)}`}>{line.name}</b> {verb} {subject}
      {line.tail}
      {age && <span className="h-think-age"> {age}</span>}
    </li>
  );
}

// Home strip. No items (nothing yet, or Halseth has not deployed the endpoint): render nothing at
// all. A strip announcing its own emptiness on the front page is noise; it appears the day there
// is something to read.
export default function ThinkingStrip({ lines, now }: { lines: ThinkingLine[]; now: Date }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label="What they are thinking about" className="h-home-section">
      <h2 className="h-home-h2">What they are thinking about</h2>
      <ul className="h-think-list">
        {lines.map((l) => (
          <ThinkingLineItem key={l.id} line={l} now={now} />
        ))}
      </ul>
    </section>
  );
}
