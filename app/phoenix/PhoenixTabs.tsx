"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/phoenix", label: "Overview", exact: true },
  { href: "/phoenix/chat", label: "Chat", exact: false },
  // Runs/Seeds tabs intentionally omitted: autonomy runs/seeds are surfaced at /autonomous
  // and /companions/[id]/autonomy. The old Phoenix WebMind surface they'd have shown is archived
  // (see Nullsafe Phoenix/PHOENIX-RECKONING.md).
] as const;

export default function PhoenixTabs() {
  const pathname = usePathname();

  return (
    <div className="h-phx-tabs">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`h-phx-tab${active ? " is-on" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
