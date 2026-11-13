/** Manual "no motion" switch, per device. The inline script in app/layout.tsx reads the same key before paint. */
export const STILL_KEY = "hearth.still";

export function readStill(): boolean {
  try {
    return localStorage.getItem(STILL_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStill(on: boolean): void {
  try {
    if (on) localStorage.setItem(STILL_KEY, "1");
    else localStorage.removeItem(STILL_KEY);
  } catch {
    /* storage blocked: the attribute still flips for this page view */
  }
}
