"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MetabolizeButton({
  noteId,
  companionId,
}: {
  noteId: string;
  companionId: string;
}) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const router = useRouter();

  async function metabolize() {
    setStatus("working");
    try {
      const res = await fetch(`/api/mind/note/${noteId}/metabolize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companion_id: companionId }),
      });
      if (!res.ok) throw new Error();
      // Halseth answers 200 {ok:false} when no row changed (already done, or not this companion's).
      const data = await res.json().catch(() => null);
      if (data && data.ok === false) throw new Error();
      setStatus("done");
      router.refresh();
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  if (status === "done") return <span className="h-cmp-done">metabolized</span>;

  return (
    <button
      onClick={metabolize}
      disabled={status === "working"}
      className={`h-cmp-quiet-btn${status === "error" ? " is-error" : ""}`}
    >
      {status === "working" ? "…" : status === "error" ? "failed" : "metabolize"}
    </button>
  );
}
