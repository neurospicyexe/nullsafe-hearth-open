"use client";

import { useState } from "react";

// Companion-made HTML and Strudel never run until Principal taps play, and only inside an iframe whose
// sandbox grants scripts and nothing else: no same-origin, so it cannot read Hearth's cookies or call
// its APIs. `src` is a Hearth route that serves the code with its own strict CSP.
export default function MakePlayer({ title, src, label = "play" }: { title: string; src: string; label?: string }) {
  const [on, setOn] = useState(false);
  if (!on) {
    return (
      <button type="button" className="h-btn is-outlined h-make-play" onClick={() => setOn(true)}>
        {label}
      </button>
    );
  }
  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      src={src}
      className="h-make-frame"
      referrerPolicy="no-referrer"
    />
  );
}
