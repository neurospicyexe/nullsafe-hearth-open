import type { CSSProperties } from "react";
import { traceValid } from "@/lib/companion-page";

export type Bar = { label: string; pct: number; trace?: number[] };

const TRACE_W = 56;
const TRACE_H = 16;

/** 7 values in 0..1, oldest first, as polyline points inside a 56x16 box (1px inset). */
function tracePoints(trace: number[]): string {
  const step = (TRACE_W - 2) / (trace.length - 1);
  return trace
    .map((v, i) => {
      const c = Math.min(1, Math.max(0, v));
      return `${(1 + i * step).toFixed(1)},${(1 + (1 - c) * (TRACE_H - 2)).toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Labelled meters (0-100) in one color, each with an optional 7-day trace after the bar.
 * `name` prefixes each meter's accessible name ("Drevan heat") where several sets share a page.
 */
export function Bars({ color, bars, name }: { color: string; bars: Bar[]; name?: string }) {
  return (
    <div className="h-bars">
      {bars.map((b) => (
        <div key={b.label} className="h-bars-row">
          <span className="h-bars-label">{b.label}</span>
          <span
            className="h-bars-track"
            role="meter"
            aria-label={name ? `${name} ${b.label}` : b.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={b.pct}
          >
            <span className="h-bars-fill" style={{ width: `${b.pct}%`, "--bar-c": color } as CSSProperties} />
          </span>
          {b.trace && traceValid(b.trace) && (
            <svg
              className="h-trace"
              aria-hidden="true"
              width={TRACE_W}
              height={TRACE_H}
              viewBox={`0 0 ${TRACE_W} ${TRACE_H}`}
            >
              <polyline points={tracePoints(b.trace)} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
