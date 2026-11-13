"use client";

import { useEffect } from "react";
import { useWriteQueue } from "@/components/shell/WriteQueueProvider";

// Records "Principal opened Gaia's garden" after the server render. Mount only, flushed at once (the
// queue's undo window is wrong for this write), same shape as LookedMark. Renders nothing.
export default function GardenLookedMark() {
  const { submit, flush } = useWriteQueue();
  useEffect(() => {
    submit({ key: "looked:garden:gaia", url: "/api/garden/looked", method: "POST" });
    flush();
  }, [submit, flush]);
  return null;
}
