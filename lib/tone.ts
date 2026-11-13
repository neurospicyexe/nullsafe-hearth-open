const COMPANIONS = { drevan: true, cypher: true, gaia: true } as const;

export function isCompanionKey(id: string | null | undefined): id is keyof typeof COMPANIONS {
  return typeof id === "string" && Object.hasOwn(COMPANIONS, id);
}

/** CSS tone class for a companion id; anything else (null, "cross", "constructor") is h-tone-none. */
export function toneOf(id: string | null | undefined): string {
  return isCompanionKey(id) ? `h-tone-${id}` : "h-tone-none";
}

/** Like toneOf, but Principal (a commons/log member, not a companion) gets the lamp. */
export function memberToneOf(id: string | null | undefined): string {
  return id === "principal" ? "h-tone-principal" : toneOf(id);
}
