"use client";

import { useEffect } from "react";
import { partOfDay } from "@/lib/time-of-day";

/** Tints the room (globals.css, html[data-time]) from the viewer's clock. SSR leaves the attribute off: neutral room. */
export default function Atmosphere() {
  useEffect(() => {
    const tick = () => {
      document.documentElement.dataset.time = partOfDay(new Date());
    };
    tick();
    const id = setInterval(tick, 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  return null;
}
