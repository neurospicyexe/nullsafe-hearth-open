"use client";

import { useEffect, useState } from "react";

export default function ClientTime({ iso }: { iso: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const d = new Date(iso);
  const formattedTime = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!mounted) {
    return <span suppressHydrationWarning>{formattedTime}</span>;
  }

  return <span suppressHydrationWarning>{formattedTime}</span>;
}
