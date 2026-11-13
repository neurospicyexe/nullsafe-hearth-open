// lib/app-icon.tsx -- the Hearth mark (◈) drawn as SVG shapes for every icon size (2026-10-27).
//
// The old icons rendered the "◈" character through next/og, whose bundled font has no glyph for it,
// so every icon could come out as an empty box. Shapes render the same everywhere. `inset` is the share
// of the canvas left as margin: iOS and favicons use a small one; a maskable Android icon needs the mark
// inside the central 80% safe zone, so it passes a larger one.

import { ImageResponse } from "next/og";

export const ICON_BG = "#0e0b08";
export const ICON_FG = "#e8a83e";

export function renderAppIcon(size: number, inset = 0.16): ImageResponse {
  const m = Math.round(size * inset);
  const c = size / 2;
  const r = c - m;               // outer diamond half-diagonal
  const stroke = Math.max(1.5, size * 0.055);
  const ri = r * 0.48;           // inner filled diamond
  const diamond = (h: number) => `M ${c} ${c - h} L ${c + h} ${c} L ${c} ${c + h} L ${c - h} ${c} Z`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: ICON_BG }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <path d={diamond(r - stroke / 2)} fill="none" stroke={ICON_FG} strokeWidth={stroke} strokeLinejoin="round" />
          <path d={diamond(ri)} fill={ICON_FG} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
