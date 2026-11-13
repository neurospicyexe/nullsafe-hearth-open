// Browser-side library upload (2026-09-27). Two hops, and the file itself never touches a
// Vercel function (their ~4.5 MB request-body cap used to fail every real book silently):
//
//   1. POST /api/library/upload-ticket   -> { upload_url, ticket }  (cookie-gated, server side)
//   2. PUT  <upload_url>?ticket=…&filename=…[&replace=true]  body = the raw file, to Halseth
//
// A fresh ticket per attempt: tickets are single-use, so the "replace?" retry mints its own.

export type UploadResult =
  | { kind: "ok" }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

type Fetch = typeof fetch;

function errorText(body: unknown, status: number): string {
  const b = body as { error?: string; reason?: string };
  if (b?.error && b.reason) return `${b.error} (${b.reason})`;
  return b?.error ?? `failed (${status})`;
}

export async function uploadBook(file: File, replace: boolean, fetchImpl: Fetch = fetch): Promise<UploadResult> {
  let upload_url: string;
  let ticket: string;
  try {
    const res = await fetchImpl("/api/library/upload-ticket", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { kind: "error", message: `could not start upload: ${errorText(body, res.status)}` };
    ({ upload_url, ticket } = body as { upload_url: string; ticket: string });
    if (!upload_url || !ticket) return { kind: "error", message: "could not start upload: no ticket returned" };
  } catch {
    return { kind: "error", message: "network error" };
  }

  const url = new URL(upload_url);
  url.searchParams.set("ticket", ticket);
  url.searchParams.set("filename", file.name);
  if (replace) url.searchParams.set("replace", "true");

  try {
    const res = await fetchImpl(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/epub+zip") },
      body: file,
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      const b = body as { hint?: string; error?: string };
      return { kind: "conflict", message: b.hint ?? b.error ?? "already on the shelf" };
    }
    if (res.status === 413) {
      const max = (body as { max_bytes?: number }).max_bytes;
      return { kind: "error", message: `too large${max ? ` (limit ${Math.round(max / 1_000_000)} MB)` : ""}` };
    }
    if (!res.ok) return { kind: "error", message: errorText(body, res.status) };
    return { kind: "ok" };
  } catch {
    return { kind: "error", message: "network error" };
  }
}
