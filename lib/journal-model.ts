// Mirrors LETTER_WHERE in halseth/src/handlers/principal-inbox.ts: a row tagged `letter` or
// `letter_to_principal` belongs to the letters door, not the journal. Kept free of lib/halseth
// imports so it stays pure (tags arrive as raw D1 JSON text, or as an array once parsed).
const LETTER_TAGS = ["letter", "letter_to_principal"];

// A dropped row is excluded by LETTER_WHERE (review_state != 'dropped'), so the letters door does not
// list it: it stays a journal row, with its "dropped" badge, rather than vanishing from everywhere.
export function isLetterRow(
  tags: string | string[] | null | undefined,
  reviewState?: string | null,
): boolean {
  if (reviewState === "dropped") return false;
  let parsed: unknown = tags;
  if (typeof tags === "string") {
    try {
      parsed = JSON.parse(tags);
    } catch {
      return false;
    }
  }
  return Array.isArray(parsed) && parsed.some((t) => typeof t === "string" && LETTER_TAGS.includes(t));
}
