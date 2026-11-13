// Pure helpers for /people (B49 slice 1). The authoritative line is built by Halseth
// (halseth/src/graph/people.ts renderFrameLine); previewLine mirrors it so Principal sees what the bots
// will be told before saving. Care words are checked by Halseth at save and shown as a warning.

import type { GraphPerson, PersonKind } from "@/lib/halseth";

export const RELATIONS = ["partner", "family", "friend", "kid", "pet", "other"] as const;
export const FRAME_LINE_MAX = 200;
const RELATION_WORD: Record<string, string> = { partner: "partner", family: "family", friend: "friend", kid: "kid", pet: "pet" };

export interface FrameDraft {
  system_of: string;
  relation: string;
  frame_line: string;
  discord_user_id: string;
  pk_system: string;
}
export const EMPTY_DRAFT: FrameDraft = { system_of: "", relation: "", frame_line: "", discord_user_id: "", pk_system: "" };

export const draftOf = (p: GraphPerson): FrameDraft => ({
  system_of: p.system_of ?? "", relation: p.relation ?? "", frame_line: p.frame_line ?? "",
  discord_user_id: p.discord_user_id ?? "", pk_system: p.pk_system ?? "",
});

/** Empty string clears (null); the rest is sent as typed. */
export const draftBody = (d: FrameDraft) => ({
  system_of: d.system_of || null, relation: d.relation || null, frame_line: d.frame_line.trim() || null,
  discord_user_id: d.discord_user_id.trim() || null, pk_system: d.pk_system || null,
});

const clean = (s: string) => s.replace(/"/g, "'").replace(/\[/g, "(").replace(/\]/g, ")").replace(/\s+/g, " ").trim();

/** The line the bots will render for this entry, or null when there is nothing to say. */
export function previewLine(label: string, kind: PersonKind, d: FrameDraft, owners: GraphPerson[]): string | null {
  const name = label.trim();
  if (!name) return null;
  if (kind === "self") return clean(`${name}: Principal (one of Principal's names)`);
  const owner = owners.find((o) => o.id === d.system_of);
  let identity: string | null = null;
  if (owner && owner.kind !== "centre") identity = `${name}, a member of ${owner.label}'s system`;
  else if (owner) identity = `${name}, a member of Principal's system`;
  else if (d.relation && RELATION_WORD[d.relation]) identity = `${name}, Principal's ${RELATION_WORD[d.relation]}`;
  const line = d.frame_line.trim().replace(/[.!\s]+$/, "");
  const parts = identity ? [identity, line] : line ? [`${name}: ${line}`] : [];
  const out = parts.filter(Boolean).join(". ");
  return out ? clean(out) : null;
}

/** Qualified spellings for a name that is also a character. Self: "X (ours)". Otherwise "X (Owner)"
 *  and "X (Owner's system)" (the bots label Spouse's turns that way, so companions may copy it);
 *  Owner is the chosen system owner's label, else Spouse. */
export function qualifiedSpellings(label: string, kind: PersonKind, ownerLabel?: string | null): string[] {
  const l = label.trim();
  if (!l) return [];
  if (kind === "self") return [`${l} (ours)`];
  const o = ownerLabel?.trim() || "Spouse";
  return [`${l} (${o})`, `${l} (${o}'s system)`];
}

/** Append what is missing to the comma-separated spellings; never remove what Principal typed. */
export function addQualified(raw: string, label: string, kind: PersonKind, ownerLabel?: string | null): string {
  const have = raw.split(",").map((x) => x.trim()).filter(Boolean);
  const add = qualifiedSpellings(label, kind, ownerLabel).filter((q) => !have.includes(q));
  return add.length ? [...have, ...add].join(", ") : raw;
}
