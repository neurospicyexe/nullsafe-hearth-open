"use client";

import { useState, useEffect } from "react";

export default function LiveFeedImage({ src: baseSrc, currentRoom }: { src: string; currentRoom: string }) {
  const [ts, setTs] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTs(Date.now());
      setError(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const fullSrc = ts !== null ? `${baseSrc}?t=${ts}` : baseSrc;

  if (error) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--h-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
          Awaiting feed for {currentRoom}...
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fullSrc}
      alt={`Current view of ${currentRoom}`}
      style={{
        width: "100%", height: "100%", position: "absolute", inset: 0, objectFit: "cover",
        background: "var(--h-surface)", border: "none",
      }}
      onError={() => setError(true)}
    />
  );
}
