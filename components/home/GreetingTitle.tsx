"use client";

import { useEffect, useState } from "react";
import { greeting } from "@/lib/home-model";

/** Header title for Home: weekday + part of day, from the viewer's clock (server time zone would be wrong). */
export default function GreetingTitle() {
  const [text, setText] = useState("Hearth");
  useEffect(() => {
    const tick = () => setText(greeting(new Date()));
    tick();
    const id = setInterval(tick, 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  return <>{text}</>;
}
