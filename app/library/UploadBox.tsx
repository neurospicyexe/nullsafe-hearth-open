"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadBook } from "@/lib/library-upload";

type Conflict = {
  file: File;
  message: string;
};

// Add books to the library. Uploads run one at a time; a duplicate (409) is
// held aside and asked about inline, never a browser confirm dialog.
export default function UploadBox() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null); // filename currently uploading
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // The file goes browser -> Halseth directly on a short-lived ticket (lib/library-upload.ts),
  // never through a Vercel function, whose ~4.5 MB body cap used to fail real books.
  async function uploadOne(file: File, replace: boolean): Promise<"ok" | "conflict" | "error"> {
    const result = await uploadBook(file, replace);
    if (result.kind === "conflict") {
      setConflicts((prev) => [
        ...prev.filter((c) => c.file.name !== file.name),
        { file, message: result.message },
      ]);
    } else if (result.kind === "error") {
      setErrors((prev) => [...prev, `${file.name}: ${result.message}`]);
    }
    return result.kind;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErrors([]);
    let anyOk = false;
    for (const file of Array.from(files)) {
      setBusy(file.name);
      const result = await uploadOne(file, false);
      if (result === "ok") anyOk = true;
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    if (anyOk) router.refresh();
  }

  async function resolveConflict(conflict: Conflict, replace: boolean) {
    setConflicts((prev) => prev.filter((c) => c !== conflict));
    if (!replace) return;
    setBusy(conflict.file.name);
    const result = await uploadOne(conflict.file, true);
    setBusy(null);
    if (result === "ok") router.refresh();
  }

  return (
    <div className="h-library-upload">
      <label className="h-library-upload-label">
        <span>add a book (epub or pdf)</span>
        <input
          ref={inputRef}
          type="file"
          accept=".epub,.pdf"
          multiple
          disabled={busy !== null}
          onChange={(e) => handleFiles(e.target.files)}
          className="h-library-file"
        />
        {busy && <span className="h-library-busy">uploading {busy}…</span>}
      </label>

      {conflicts.map((c) => (
        <div key={c.file.name} className="h-library-conflict">
          <span><strong>{c.file.name}</strong>: {c.message}. replace the existing copy?</span>
          <button
            type="button"
            className="h-btn is-primary is-outlined"
            onClick={() => resolveConflict(c, true)}
          >
            replace
          </button>
          <button
            type="button"
            className="h-btn"
            onClick={() => resolveConflict(c, false)}
          >
            keep existing
          </button>
        </div>
      ))}

      {errors.map((e) => (
        <p key={e} className="h-library-error">{e}</p>
      ))}
    </div>
  );
}
