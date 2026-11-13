"use client";

import { useEffect } from "react";

// Registers public/sw.js (the offline page for the home-screen app). Production only: next dev serves
// changing bundles and a worker there only gets in the way. Failure is silent and harmless -- Hearth
// works exactly as before without it.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
