import Link from "next/link";
import { fetchBook } from "@/lib/halseth";
import ReaderShell from "./ReaderShell";

export const dynamic = "force-dynamic";

// One book, opened, full-screen (AppShell hides the tab bar and spoons strip here). The reader itself is
// client-only (epubjs needs window); this server component fetches the book + marginalia and hands them down.
export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await fetchBook(id);

  if (!detail?.book) {
    return (
      <div className="h-reader">
        <header className="h-reader-bar">
          <Link href="/library" className="h-reader-back">← the library</Link>
          <div className="h-reader-heading">
            <h1 className="h-reader-title">The Library</h1>
          </div>
        </header>
        <p className="h-reader-quiet">couldn&apos;t open that book: it may have been removed, or Halseth is unreachable.</p>
      </div>
    );
  }

  const { book, progress, annotations } = detail;

  return (
    <div className="h-reader">
      <header className="h-reader-bar">
        <Link href="/library" className="h-reader-back">← the library</Link>
        <div className="h-reader-heading">
          <h1 className="h-reader-title">{book.title}</h1>
          <p className="h-reader-author">
            {book.author ?? "unknown author"}
            {book.finished_at ? " · finished" : ""}
          </p>
        </div>
      </header>

      <div className="h-reader-body">
        <ReaderShell
          bookId={book.id}
          fileType={book.file_type}
          initialProgress={progress}
          initialAnnotations={annotations}
        />
      </div>
    </div>
  );
}
