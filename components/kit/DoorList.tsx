import Link from "next/link";
import type { Door } from "@/lib/shell";

/** A plain list of doors to other pages. Each row is a 44px+ tap target; `count` > 0 shows a "new" pill. */
export default function DoorList({ doors }: { doors: Door[] }) {
  return (
    <ul className="h-doors">
      {doors.map((d) => (
        <li key={d.href}>
          <Link href={d.href} className="h-door">
            <span className="h-door-top">
              <span className="h-door-label">{d.label}</span>
              {d.count !== undefined && d.count > 0 && (
                <>
                  <span className="h-door-count" aria-hidden="true">
                    {d.count}
                  </span>
                  <span className="sr-only">{` ${d.count} new`}</span>
                </>
              )}
            </span>
            {d.hint && <span className="h-door-hint">{d.hint}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
