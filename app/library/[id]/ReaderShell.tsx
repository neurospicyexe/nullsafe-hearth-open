"use client";

import dynamic from "next/dynamic";
import type { BookAnnotation, BookProgress } from "@/lib/halseth";

// epubjs touches window at render time — the reader must never SSR.
// (`ssr: false` is only legal inside a client component, hence this shell.)
const Reader = dynamic(() => import("./Reader"), {
  ssr: false,
  loading: () => <p className="h-empty">opening the book…</p>,
});

export default function ReaderShell(props: {
  bookId: string;
  fileType: "epub" | "pdf";
  initialProgress: BookProgress | null;
  initialAnnotations: BookAnnotation[];
}) {
  return <Reader {...props} />;
}
