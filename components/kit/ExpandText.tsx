"use client";

import { useId, useState } from "react";

/**
 * Long text, shown short first with a "Read all" button, so nothing has to be downloaded or opened
 * elsewhere to be read. Short text renders as-is with no button.
 *
 * - `preview` (default): the text is cut at a word boundary near `limit` characters; "Read all" shows the rest.
 * - `block`: the whole text is in the page (pre-wrap), held to a fixed height until opened. For a writing
 *   make or anything where line breaks are part of the piece.
 */
export function cutAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const space = head.lastIndexOf(" ");
  return (space > limit * 0.6 ? head.slice(0, space) : head).trimEnd() + "…";
}

export default function ExpandText({
  text,
  limit = 160,
  mode = "preview",
  className,
  as: Tag = "p",
}: {
  text: string;
  limit?: number;
  mode?: "preview" | "block";
  className?: string;
  as?: "p" | "span" | "div" | "pre";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = text.length > limit;
  if (!long) return <Tag className={className}>{text}</Tag>;

  const shown = mode === "block" || open ? text : cutAtWord(text, limit);
  const cls = [className, mode === "block" && !open ? "h-expand-held" : ""].filter(Boolean).join(" ");
  return (
    <>
      <Tag id={id} className={cls || undefined}>{shown}</Tag>
      <button
        type="button"
        className="h-expand-btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Show less" : "Read all"}
      </button>
    </>
  );
}
