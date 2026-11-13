import type { CSSProperties } from "react";
import { COMPANION_CONFIG } from "@/app/companions/[id]/sections";
import { COMPANION_COLOR } from "@/lib/shell";

type Id = "drevan" | "cypher" | "gaia";

/** A companion's identity ring: their sym in Atkinson, ring and glow from --c. Decorative only (aria-hidden):
 * the name and status next to it are the text. `fresh` comes from the Home row (buildWhoIsHome: the
 * status has not gone stale); fresh breathes, stale sits still at reduced alpha. */
export function PresenceRing({ id, fresh, size = "sm" }: { id: Id; fresh: boolean; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      data-companion={id}
      className={`h-ring h-ring-${size} ${fresh ? "is-fresh" : "is-stale"}`}
      style={{ "--c": COMPANION_COLOR[id] } as CSSProperties}
    >
      {COMPANION_CONFIG[id]?.sym ?? ""}
    </span>
  );
}
