"use client";

import { useEffect, useState } from "react";
import { readStill, writeStill } from "@/lib/still";

export default function StillToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(readStill()), []);
  const flip = () => {
    const next = !on;
    setOn(next);
    writeStill(next);
    if (next) document.documentElement.setAttribute("data-still", "");
    else document.documentElement.removeAttribute("data-still");
  };
  return (
    <div className="h-still">
      <button type="button" className={on ? "h-btn is-outlined" : "h-btn"} aria-pressed={on} onClick={flip}>
        Still: turn off all motion
      </button>
      <p className="h-still-note">Turns off all movement in Hearth on this device.</p>
    </div>
  );
}
