import { HALSETH_DOWN } from "./archive-copy";

/** Thrown when /api/search answers non-2xx: the route sends 503 only when every source is down. */
export class HalsethDownError extends Error {}

export async function fetchSearch<T>(q: string, type: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${type}`, { signal });
  if (!res.ok) throw new HalsethDownError(HALSETH_DOWN);
  return (await res.json()) as T;
}

export function searchErrorMessage(err: unknown): string {
  return err instanceof HalsethDownError ? HALSETH_DOWN : "Search unavailable";
}
