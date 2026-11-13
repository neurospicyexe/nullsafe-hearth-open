// Render test for /library/[id] (Hearth P4 Task 2): the page hands the book to ReaderShell, and a
// missing book renders a message (not notFound) today.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let detail: unknown = null;
vi.mock("@/lib/halseth", () => ({
  fetchBook: vi.fn(async () => detail),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  usePathname: () => "/library/book1",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("./ReaderShell", () => ({
  default: ({ bookId }: { bookId: string }) => <div data-reader={bookId} />,
}));

import { fetchBook } from "@/lib/halseth";
import BookPage from "./page";

const render = async (id = "book1") =>
  renderToStaticMarkup(await BookPage({ params: Promise.resolve({ id }) }));

beforeEach(() => {
  detail = null;
  vi.mocked(fetchBook).mockClear();
});

describe("/library/[id]", () => {
  it("renders the title and the reader stub for the book", async () => {
    detail = {
      book: { id: "book1", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", file_type: "epub", finished_at: null },
      progress: null,
      annotations: [],
    };
    const html = await render();
    expect(fetchBook).toHaveBeenCalledWith("book1");
    expect(html).toContain("The Left Hand of Darkness");
    expect(html).toContain('data-reader="book1"');
    expect(html).toContain('href="/library"');
  });

  it("still mounts the reader for a finished book with no author", async () => {
    detail = {
      book: { id: "book1", title: "T", author: null, file_type: "pdf", finished_at: "2026-10-01" },
      progress: null,
      annotations: [],
    };
    const html = await render();
    expect(html).toContain('data-reader="book1"');
    expect(html).toMatch(/<header class="h-reader-bar"><a [^>]*href="\/library"/);
  });

  it("renders a message with a back link, not notFound, when the book is missing", async () => {
    detail = null;
    const html = await render();
        expect(html).toContain('href="/library"');
    expect(html).not.toContain("data-reader");
  });

  it("treats a payload without a book the same way", async () => {
    detail = { book: null, progress: null, annotations: [] };
    const html = await render();
        expect(html).not.toContain("data-reader");
  });
});
