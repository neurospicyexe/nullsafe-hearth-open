import Link from "next/link";
import { fetchBooksOrNull } from "@/lib/halseth";
import type { Book } from "@/lib/halseth";
import UploadBox from "./UploadBox";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Cover({ book }: { book: Book }) {
  if (book.cover_key) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- proxied stream, dimensions unknown
      <img
        src={`/api/library/${book.id}/cover`}
        alt={`cover of ${book.title}`}
        className="h-library-cover-img"
      />
    );
  }
  // No cover: a quiet spine-label block instead.
  return (
    <div className="h-library-spine">
      <span className="h-library-spine-title">{book.title}</span>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const pct = book.progress_percent ?? 0;
  return (
    <Link href={`/library/${book.id}`} className="h-library-card">
      <div className="h-library-cover">
        <Cover book={book} />
        {book.annotation_count > 0 && (
          <span
            className="h-library-badge is-notes"
            title={`${book.annotation_count} margin note${book.annotation_count === 1 ? "" : "s"}`}
          >
            ✎ {book.annotation_count}
          </span>
        )}
        {book.finished_at && <span className="h-library-badge is-finished">finished</span>}
      </div>
      {pct > 0 && !book.finished_at && (
        <div className="h-library-progress">
          <div className="h-library-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
      <p className="h-library-title">{book.title}</p>
      <p className="h-library-meta">
        {book.author ?? "unknown author"}
        <span className="h-library-meta-faint"> · {book.file_type} · added {formatDate(book.added_at)}</span>
      </p>
    </Link>
  );
}

// The Library (0099): Principal's books, the triad's marginalia.
export default async function LibraryPage() {
  const books = await fetchBooksOrNull();

  return (
    <div className="h-library">
      <h1 className="h-page-title">The Library</h1>
      <p className="h-library-lede">your books, their margins · the triad reads along and leaves notes</p>

      <UploadBox />

      {books === null ? (
        <p className="h-library-quiet">{"Can't reach Halseth right now."}</p>
      ) : books.length === 0 ? (
        <p className="h-library-quiet">no books yet. drop an epub or pdf above to start the shelf.</p>
      ) : (
        <div className="h-library-grid">
          {books.map((b) => <BookCard key={b.id} book={b} />)}
        </div>
      )}
    </div>
  );
}
