// Pure phrasing for the Imps page. The Worker sends plain errand phrases already (no trigger text ever reaches
// Hearth); this file only arranges them into sentences, so it is testable without a render.

export const IMP_ORDER = ["iris", "nimbus", "hex", "mossling", "rock"] as const;

export const IMP_LABEL: Record<string, string> = {
  iris: "Iris", nimbus: "Nimbus", hex: "Hex", mossling: "Mossling", rock: "Rock",
};

/** What each imp does NOW, said plainly. Mirrors VALID_ERRANDS in halseth src/librarian/executors/errands.ts. */
export const IMP_DOES: Record<string, string> = {
  iris: "feeds Sol, marks cooling interests",
  nimbus: "checks for gaps",
  hex: "leaves a pointer for a sibling who has said yes",
  mossling: "sorts a tray, tends Sol, checks the care lane",
  rock: "fetches rows and vault notes, counts loops",
};

export const COMPANION_NAME: Record<string, string> = { drevan: "Drevan", cypher: "Cypher", gaia: "Gaia" };

export function companionName(id: string): string {
  return COMPANION_NAME[id.toLowerCase()] ?? id;
}

export function impLabel(imp: string): string {
  return IMP_LABEL[imp.toLowerCase()] ?? imp;
}

export interface OutingParts {
  /** "checked for gaps" / "rode along on a reply" / "left a pointer for a sibling" */
  action: string;
  /** "for" (the companion it ran for) or "sent by" (Hex: the sender, who is the only trace) */
  link: "for" | "sent by";
}

export function outingParts(o: { imp: string; kind: "errand" | "reply"; errand: string | null }): OutingParts {
  if (o.kind === "reply") return { action: "rode along on a reply", link: "for" };
  const errand = o.errand ?? "ran an errand";
  if (o.imp.toLowerCase() === "hex" && errand === "left a pointer") return { action: "left a pointer for a sibling", link: "sent by" };
  return { action: errand, link: "for" };
}

/** "2h ago" style. Coarse on purpose; the exact time is not the point on this page. */
export function agoText(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "a while ago";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
