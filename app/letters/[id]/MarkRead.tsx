"use client";

import { useEffect } from "react";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

// Opening a letter marks it read. Queued so a flaky connection retries; flushed at once.
export default function MarkRead({ id }: { id: string }) {
  const { submit, flush } = useWriteQueue();
  useEffect(() => {
    submit({ key: `read-${id}`, url: "/api/inbox/read", method: "POST", body: { ids: [id] } });
    flush();
  }, [id, submit, flush]);
  return null;
}
