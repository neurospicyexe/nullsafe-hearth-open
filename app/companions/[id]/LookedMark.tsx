"use client";

import { useEffect } from "react";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";
import type { CompanionId } from "@/lib/halseth";

// Records "Principal looked at this companion's page" AFTER the server render: this render shows the
// counts read before the write, and a reload shows zeros. Mount only; flushed at once (the queue's
// undo window is wrong for this write). Renders nothing.
export default function LookedMark({ id }: { id: CompanionId }) {
  const { submit, flush } = useWriteQueue();
  useEffect(() => {
    submit({ key: `looked:${id}`, url: `/api/companions/${id}/looked`, method: "POST" });
    flush();
  }, [id, submit, flush]);
  return null;
}
