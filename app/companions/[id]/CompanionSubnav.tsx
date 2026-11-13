"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CompanionId } from "@/lib/halseth";
import { COMPANION_NAME, companionPills, subnavFor } from "@/lib/companion-page";
import { COMPANION_COLOR } from "@/lib/shell";

/**
 * Over every page of a companion's tab: their name in their hue, the pill row
 * (Now . Mind . Letters . Made . Thinking), and, inside Mind, the current door's sibling routes.
 */
export default function CompanionSubnav({ id }: { id: CompanionId }) {
  const pathname = usePathname() ?? "";
  const pills = companionPills(id, pathname);
  const siblings = subnavFor(id, pathname)?.links ?? [];
  return (
    <div className="h-ctab" style={{ "--c": COMPANION_COLOR[id] } as React.CSSProperties}>
      <nav className="h-ctab-pills" aria-label={`${COMPANION_NAME[id]} pages`}>
        <span className="h-ctab-name">{COMPANION_NAME[id]}</span>
        <ul className="h-ctab-list">
          {pills.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className="h-ctab-pill" aria-current={p.current ? "page" : undefined}>
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {siblings.length > 0 && (
        <ul className="h-ctab-siblings" aria-label="In this part of their mind">
          {siblings.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="h-subnav-link" aria-current={l.current ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
