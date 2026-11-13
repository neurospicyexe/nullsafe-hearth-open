// Small shared pieces of the Hearth kit (not tied to any one room).

/** The member's colour class suffix; unknown names get the muted look. */
export function memberClass(name: string): string {
  return name === "drevan" || name === "cypher" || name === "gaia" || name === "principal" ? `is-${name}` : "is-other";
}
