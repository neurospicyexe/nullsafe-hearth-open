"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createWriteQueue } from "@/lib/write-queue";

type Queue = ReturnType<typeof createWriteQueue>;

const QueueContext = createContext<Queue | null>(null);

function realStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // private window, blocked site data
  }
}

export function WriteQueueProvider({ children }: { children: ReactNode }) {
  const [queue] = useState<Queue>(() =>
    createWriteQueue({
      // Wrapped so the queue's unbound calls never hit "Illegal invocation".
      fetch: (input, init) => fetch(input, init),
      storage: realStorage(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    }),
  );
  const pathname = usePathname();

  // Retry anything a previous visit left behind.
  useEffect(() => {
    void queue.restore();
  }, [queue]);

  // Leaving the page, hiding the tab, or navigating sends waiting writes now.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") queue.flush();
    };
    const onPageHide = () => queue.flush();
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [queue]);

  useEffect(() => {
    queue.flush();
  }, [pathname, queue]);

  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>;
}

export function useWriteQueue(): Queue {
  const q = useContext(QueueContext);
  if (!q) throw new Error("useWriteQueue must be used inside WriteQueueProvider");
  return q;
}
