/** Hand a query from any page to the shell's search overlay. */
export const SEARCH_EVENT = "hearth:search";

export function openSearch(q: string, target: EventTarget = window): void {
  target.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: { q } }));
}

export function searchDetail(e: Event): string {
  const detail = (e as CustomEvent<unknown>).detail;
  if (!detail || typeof detail !== "object") return "";
  const q = (detail as { q?: unknown }).q;
  return typeof q === "string" ? q.trim() : "";
}
