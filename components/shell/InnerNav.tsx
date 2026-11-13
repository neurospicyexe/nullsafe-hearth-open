"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { innerNavFor } from "@/lib/shell";

/**
 * The inner-page header, one place for every page inside Us and the cellar: "‹ <hub>" in a fixed
 * spot, then the pages next door in the same group (a row that scrolls sideways on a phone).
 * Which pages get one is lib/shell.ts's innerNavFor; nothing is added per page.
 */
export default function InnerNav() {
  const nav = innerNavFor(usePathname() ?? "/");
  if (!nav) return null;
  return (
    <nav className="h-inner" aria-label={`${nav.back.label} pages`}>
      <Link href={nav.back.href} className="h-inner-back">
        <span aria-hidden="true">‹</span> {nav.back.label}
      </Link>
      <ul className="h-inner-links">
        {nav.links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="h-inner-link" aria-current={l.current ? "page" : undefined}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
