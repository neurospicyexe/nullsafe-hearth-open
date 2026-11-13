// The companions' thinking (B62 F). Pure: no React, no fetching.
import type { CompanionId, Interest, InterestEvent, ThinkingItem } from "./halseth";
import { COMPANION_IDS, COMPANION_NAME } from "./companion-page";

export const THINKING_FRAMING =
  "These are the reasons they give, the way a person gives one. Not a readout of the model.";

const PRONOUN: Record<CompanionId, { they: string; self: string }> = {
  cypher: { they: "he", self: "himself" },
  drevan: { they: "he", self: "himself" },
  gaia: { they: "she", self: "herself" },
};

export function isPrivate(v: boolean | number | null | undefined): boolean {
  return v === true || v === 1;
}

/** Drop a leading "because" the companion already wrote; our own lead-in supplies it. */
function bare(why: string): string {
  return why.trim().replace(/^because[\s,:]+/i, "");
}

export interface ThinkingLine {
  id: string;
  companion: CompanionId;
  name: string;
  /** Text before the subject, e.g. "picked up". */
  verb: string;
  subject: string;
  /** Text after the subject (why clause, private note or cooled note); "" when none. */
  tail: string;
  href: string | null;
  /** Where "made something" goes: the maker's Made shelf. Only set for a made line. */
  madeHref: string | null;
  at: string;
}

/** The words of a made line that link to the shelf; the rest of the verb ("for") stays plain. */
export const MADE_LINK_TEXT = "made something";

const VERB: Record<string, string> = {
  born: "picked up",
  picked_up: "picked up",
  returned: "went back to",
  made: "made something for",
  cooled: "cooled on",
  put_down: "put down",
  like: "likes",
  dislike: "does not like",
  refusal: "refused",
};

const WHY_LEAD: Record<string, string> = {
  born: "because",
  picked_up: "because",
  returned: "because",
  made: "because",
  put_down: "because",
  like: "because",
  dislike: "because",
  refusal: "because",
};

export function isCompanionId(v: unknown): v is CompanionId {
  return typeof v === "string" && (COMPANION_IDS as readonly string[]).includes(v);
}

export function thinkingLine(item: ThinkingItem): ThinkingLine | null {
  if (!item || !isCompanionId(item.companion_id) || !item.subject) return null;
  const c = item.companion_id;
  const verb = VERB[item.kind];
  if (!verb) return null;
  let tail = "";
  if (item.kind === "cooled") {
    tail = " (hasn't come back in a while)";
  } else if (isPrivate(item.why_private)) {
    tail = `; ${PRONOUN[c].they} kept the why to ${PRONOUN[c].self}`;
  } else if (item.why && item.why.trim()) {
    tail = `: ${WHY_LEAD[item.kind] ?? "because"} ${bare(item.why)}`;
  }
  return {
    id: item.id,
    companion: c,
    name: COMPANION_NAME[c],
    verb,
    subject: item.subject,
    tail,
    href: item.interest_id ? `/companions/${c}/thinking/${encodeURIComponent(item.interest_id)}` : null,
    madeHref: item.kind === "made" ? `/companions/${c}/made` : null,
    at: item.created_at,
  };
}

export function thinkingLines(items: ThinkingItem[] | null, max?: number): ThinkingLine[] {
  const out: ThinkingLine[] = [];
  for (const it of items ?? []) {
    const l = thinkingLine(it);
    if (l) out.push(l);
    if (max && out.length >= max) break;
  }
  return out;
}

/** Trail step wording: the event as a short heading plus its why (or the private note). */
export function trailStep(e: InterestEvent, c: CompanionId): { label: string; why: string } {
  const labels: Record<string, string> = {
    born: "Picked it up",
    returned: "Came back to it",
    made: "Made something",
    cooled: "Cooled",
    put_down: "Put it down",
  };
  const label = labels[e.kind] ?? e.kind.replace(/_/g, " ");
  if (e.kind === "cooled") return { label, why: "Hadn't come back in a while." };
  if (isPrivate(e.why_private)) return { label, why: `${COMPANION_NAME[c]} kept the why to ${PRONOUN[c].self}.` };
  return { label, why: e.why && e.why.trim() ? bare(e.why) : "" };
}

const STATUS_LABEL: Record<Interest["status"], string> = {
  active: "Following",
  resting: "Resting",
  put_down: "Put down",
};

export function statusLabel(s: Interest["status"]): string {
  return STATUS_LABEL[s] ?? s;
}

export function groupInterests(list: Interest[]): { heading: string; interests: Interest[] }[] {
  const groups: { heading: string; status: Interest["status"] }[] = [
    { heading: "Following", status: "active" },
    { heading: "Resting", status: "resting" },
    { heading: "Things put down", status: "put_down" },
  ];
  return groups
    .map((g) => ({ heading: g.heading, interests: list.filter((i) => i.status === g.status) }))
    .filter((g) => g.interests.length > 0);
}

/** Heat band as a quiet word; null for a put-down interest (heat is moot). */
export function bandWord(i: Interest): string | null {
  if (i.status === "put_down") return null;
  return i.band === "warm" || i.band === "cooling" || i.band === "cold" ? i.band : null;
}
