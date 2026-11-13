"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CloseLoopButton({
  loopId,
  companionId,
}: {
  loopId: string;
  companionId: string;
}) {
  const [status, setStatus] = useState<"idle" | "closing" | "done" | "error">("idle");
  const router = useRouter();

  async function close() {
    setStatus("closing");
    try {
      const res = await fetch(`/api/mind/loop/${loopId}/close`, {
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

  if (status === "done") return <span className="h-cmp-done">closed</span>;

  return (
    <button
      onClick={close}
      disabled={status === "closing"}
      className={`h-cmp-quiet-btn${status === "error" ? " is-error" : ""}`}
    >
      {status === "closing" ? "…" : status === "error" ? "failed" : "close"}
    </button>
  );
}
