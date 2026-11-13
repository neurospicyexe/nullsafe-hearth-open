import Link from "next/link";
import type { Book } from "@/lib/halseth";

export default function ReadingLine({ book }: { book: Book }) {
  const pct = Math.round(book.progress_percent ?? 0);
  return (
    <section aria-label="Reading together" className="h-home-section">
      <Link href={`/library/${book.id}`} className="h-home-reading">
        <span className="h-home-reading-text">
          <span className="h-home-reading-kicker">reading together</span>
          <span className="h-home-reading-title">{book.title} · {pct}%</span>
        </span>
        <span className="h-home-reading-open">open</span>
      </Link>
    </section>
  );
}
